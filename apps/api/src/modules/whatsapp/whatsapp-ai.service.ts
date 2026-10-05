import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { AIToolDefinition, ChatMessage, IStorageProvider } from '../../common/interfaces';
import { STORAGE_PROVIDER } from '../../providers/storage/storage.module';
import { EventBusService, PlatformEvents, MessageCreatedPayload } from '../../common/events';
import { ChatGateway } from '../../gateways/chat.gateway';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { AppointmentService } from '../appointment/appointment.service';
import { FollowUpTaskService } from '../follow-up-task/follow-up-task.service';
import { NotificationService } from '../notification/notification.service';
import { CallingService } from '../calling/calling.service';
import { genderPromptRule, resolveAgentGender, resolveCallingSettings } from '../calling/calling-settings';
import { dateToWords } from '../calling/speech-text';
import { TwilioWhatsAppSender } from './twilio-whatsapp.sender';
import { BookingForm, WhatsAppAiSettings, fillTemplate, resolveWhatsAppSettings } from './whatsapp-settings';

/** Twilio's form-encoded inbound message. */
export interface InboundForm {
  MessageSid?: string;
  SmsMessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  ProfileName?: string;
  NumMedia?: string;
  ButtonText?: string;
  Latitude?: string;
  Longitude?: string;
  [k: string]: any;
}

const WHATSAPP_AGENT_ID = 'whatsapp';
const MAX_HISTORY = 30;
const MAX_IMAGES_FOR_VISION = 3;
const MAX_TOOL_ROUNDS = 4;

type Pending = { timer: NodeJS.Timeout | null; processing: boolean; again: boolean };

/**
 * Two-way WhatsApp for every lead. A message from the customer lands here
 * (Twilio webhook), is stored on a `whatsapp` conversation against the lead,
 * and - unless a human has taken over - answered by the AI with full context:
 * the lead's stage, what was said on the AI calls, meetings on the books,
 * the knowledge base, the media library and the booking forms.
 *
 * The AI can look at pictures the customer sends, send pictures back, book
 * meetings and callbacks, trigger an AI call, hand over to a human and run a
 * booking form field by field until only the payment is left - then it shares
 * the payment link.
 */
@Injectable()
export class WhatsAppAiService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppAiService.name);
  private readonly pending = new Map<string, Pending>();

  /**
   * A teammate typed a reply in the dashboard (ConversationService stores it
   * and emits MESSAGE_CREATED): deliver it on WhatsApp and pause the AI.
   * Event-driven so ConversationModule need not import this module.
   */
  onModuleInit() {
    this.bus.on<MessageCreatedPayload>(PlatformEvents.MESSAGE_CREATED, (p) => void this.onAgentMessage(p));
  }

  private async onAgentMessage({ tenantId, conversationId, message }: MessageCreatedPayload) {
    try {
      const m = message?.toObject?.() ?? message;
      if (!m || m.sender !== 'agent' || m.externalId || m.type === 'tool_result') return;
      const conv: any = await this.conversationModel.findOne({ _id: conversationId, tenantId, channel: 'whatsapp' }).lean();
      if (!conv) return;
      const r = await this.sender.send(tenantId, conv.visitorId, m.content || '');
      await this.messageModel.updateOne({ _id: m._id }, { $set: { externalId: r.sid || `local-${m._id}`, deliveryError: r.ok ? undefined : r.error } });
      if (conv.mode !== 'human') {
        await this.conversationModel.updateOne({ _id: conv._id }, { $set: { mode: 'human', assignedUserId: m.senderId || conv.assignedUserId } });
        this.chatGateway.emitConversationUpdate(conversationId, { mode: 'human' });
      }
      if (!r.ok) this.logger.warn(`Teammate's WhatsApp reply not delivered: ${r.error}`);
    } catch (err: any) {
      this.logger.warn(`Agent WhatsApp relay failed: ${err?.message}`);
    }
  }

  constructor(
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('CallLog') private readonly callModel: Model<any>,
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    @InjectModel('FollowUpTask') private readonly taskModel: Model<any>,
    @InjectModel('WhatsAppMedia') private readonly mediaModel: Model<any>,
    @InjectModel('BookingRequest') private readonly bookingModel: Model<any>,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly configService: ConfigService,
    private readonly aiFactory: AIProviderFactory,
    private readonly knowledge: KnowledgeBaseService,
    private readonly appointments: AppointmentService,
    private readonly tasks: FollowUpTaskService,
    private readonly notifications: NotificationService,
    private readonly calling: CallingService,
    private readonly sender: TwilioWhatsAppSender,
    private readonly bus: EventBusService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // ─── Settings ─────────────────────────────────────────────────────

  async getSettings(
    tenantId: string,
  ): Promise<WhatsAppAiSettings & { companyName: string; timezone: string; callingAgentName: string; gender: 'female' | 'male' }> {
    const tenant: any = await this.tenantModel.findById(tenantId).select('whatsappSettings callingSettings settings name').lean();
    const s = resolveWhatsAppSettings(tenant?.whatsappSettings);
    const calling = resolveCallingSettings(tenant?.callingSettings);
    return {
      ...s,
      companyName: calling.assistant.companyName || tenant?.name || 'our team',
      timezone: tenant?.settings?.timezone || 'Asia/Kolkata',
      callingAgentName: calling.assistant.agentName,
      // 'auto' follows the calling agent, which in turn follows its voice
      gender: s.agentGender === 'female' || s.agentGender === 'male' ? s.agentGender : resolveAgentGender(calling.assistant),
    };
  }

  async updateSettings(tenantId: string, patch: Record<string, any>) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('whatsappSettings').lean();
    const merged = resolveWhatsAppSettings({ ...(tenant?.whatsappSettings || {}), ...patch });
    await this.tenantModel.updateOne({ _id: tenantId }, { $set: { whatsappSettings: merged } });
    return this.getSettings(tenantId);
  }

  async status(tenantId: string) {
    const [settings, sender, media, bookings] = await Promise.all([
      this.getSettings(tenantId),
      this.sender.senderStatus(tenantId),
      this.mediaModel.countDocuments({ tenantId }),
      this.bookingModel.countDocuments({ tenantId, status: { $in: ['submitted', 'payment_sent'] } }),
    ]);
    return {
      enabled: settings.enabled,
      sender,
      inboundUrl: this.sender.inboundUrl(tenantId),
      statusUrl: this.sender.statusCallbackUrl(tenantId),
      mediaCount: media,
      openBookings: bookings,
      signatureCheck: process.env.WHATSAPP_VERIFY_SIGNATURE !== 'false',
    };
  }

  configureWebhook(tenantId: string) {
    return this.sender.configureSenderWebhook(tenantId);
  }

  // ─── Media library ────────────────────────────────────────────────

  private bucket(): string {
    return this.configService.get<string>('storage.s3.bucket') || 'ai-lead-gen-uploads';
  }

  private mediaSecret(): string {
    return this.configService.get<string>('encryption.key') || this.configService.get<string>('jwt.accessSecret') || 'dev';
  }

  private sign(id: string): string {
    return createHmac('sha256', this.mediaSecret()).update(id).digest('base64url').slice(0, 32);
  }

  verifyMediaSig(id: string, sig: string): boolean {
    const a = Buffer.from(this.sign(id));
    const b = Buffer.from(String(sig || ''));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Public (signed) URL Twilio and the dashboard can fetch a file from. */
  mediaUrl(kind: 'lib' | 'msg', id: string): string {
    const base = (this.configService.get<string>('app.publicApiUrl') || 'http://localhost:4000').replace(/\/+$/, '');
    const prefix = (this.configService.get<string>('app.prefix') || '/api/v1').replace(/\/+$/, '');
    return `${base}${prefix}/whatsapp/media/${kind}/${id}?s=${this.sign(id)}`;
  }

  async listMedia(tenantId: string) {
    const items: any[] = await this.mediaModel.find({ tenantId }).sort({ createdAt: -1 }).limit(200).lean();
    return items.map((m) => ({ ...m, url: this.mediaUrl('lib', String(m._id)) }));
  }

  async addMedia(tenantId: string, userId: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }, meta: { title?: string; description?: string; tags?: string }) {
    if (!file?.buffer?.length) throw new BadRequestException('No file');
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const key = `whatsapp/${tenantId}/library/${randomUUID()}.${ext}`;
    await this.storage.upload({ bucket: this.bucket(), key, body: file.buffer, contentType: file.mimetype });
    const doc = await this.mediaModel.create({
      tenantId,
      title: (meta.title || file.originalname).trim().slice(0, 120),
      description: (meta.description || '').trim().slice(0, 600),
      tags: String(meta.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
      storageKey: key,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: userId,
    });
    return { ...doc.toObject(), url: this.mediaUrl('lib', String(doc._id)) };
  }

  async updateMedia(tenantId: string, id: string, patch: { title?: string; description?: string; tags?: string[] }) {
    const set: any = {};
    if (typeof patch.title === 'string') set.title = patch.title.trim().slice(0, 120);
    if (typeof patch.description === 'string') set.description = patch.description.trim().slice(0, 600);
    if (Array.isArray(patch.tags)) set.tags = patch.tags.filter((t) => typeof t === 'string').slice(0, 10);
    const doc = await this.mediaModel.findOneAndUpdate({ _id: id, tenantId }, { $set: set }, { new: true }).lean();
    if (!doc) throw new NotFoundException('Media not found');
    return { ...doc, url: this.mediaUrl('lib', String((doc as any)._id)) };
  }

  async removeMedia(tenantId: string, id: string) {
    const doc: any = await this.mediaModel.findOne({ _id: id, tenantId });
    if (!doc) throw new NotFoundException('Media not found');
    await this.storage.delete(this.bucket(), doc.storageKey).catch(() => undefined);
    await this.mediaModel.deleteOne({ _id: id });
    return { deleted: true };
  }

  /** Bytes + type for the public media route. */
  async readMedia(kind: 'lib' | 'msg', id: string): Promise<{ body: Buffer; contentType: string } | null> {
    let key: string | undefined;
    let type: string | undefined;
    if (kind === 'lib') {
      const m: any = await this.mediaModel.findById(id).select('storageKey mimeType').lean();
      key = m?.storageKey;
      type = m?.mimeType;
    } else {
      const m: any = await this.messageModel.findById(id).select('attachment').lean();
      key = m?.attachment?.storageKey;
      type = m?.attachment?.mimeType;
    }
    if (!key) return null;
    const file = await this.storage.download(this.bucket(), key);
    return { body: file.body, contentType: type || file.contentType || 'application/octet-stream' };
  }

  // ─── Inbound ──────────────────────────────────────────────────────

  /** Twilio posted a customer message. Store it, then answer after a short pause. */
  async handleInbound(tenantId: string, form: InboundForm) {
    const phone = TwilioWhatsAppSender.normalise(form.From || '');
    if (!phone) return;
    const settings = await this.getSettings(tenantId);
    const text = String(form.Body || form.ButtonText || '').trim();
    const numMedia = parseInt(String(form.NumMedia || '0'), 10) || 0;
    const externalId = form.MessageSid || form.SmsMessageSid;
    if (externalId && (await this.messageModel.exists({ tenantId, externalId }))) return; // Twilio retried

    const lead = await this.findOrCreateLead(tenantId, phone, form.ProfileName);
    const conversation = await this.findOrCreateConversation(tenantId, lead, phone);

    // Store the text + every attachment as messages (pictures are copied to our storage)
    const created: any[] = [];
    if (text || numMedia === 0) {
      created.push(
        await this.messageModel.create({
          tenantId,
          conversationId: String(conversation._id),
          sender: 'visitor',
          senderId: phone,
          content: text || (form.Latitude ? `[location ${form.Latitude},${form.Longitude}]` : '[empty message]'),
          type: 'text',
          externalId,
        }),
      );
    }
    for (let i = 0; i < Math.min(numMedia, 5); i++) {
      const url = form[`MediaUrl${i}`];
      const ctype = String(form[`MediaContentType${i}`] || 'application/octet-stream');
      if (!url) continue;
      const file = await this.sender.downloadMedia(tenantId, url);
      let storageKey: string | undefined;
      if (file) {
        const ext = (ctype.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
        storageKey = `whatsapp/${tenantId}/${conversation._id}/${randomUUID()}.${ext}`;
        await this.storage.upload({ bucket: this.bucket(), key: storageKey, body: file.buffer, contentType: file.contentType }).catch((err) => {
          this.logger.warn(`Could not store WhatsApp media: ${err?.message}`);
          storageKey = undefined;
        });
      }
      const isImage = ctype.startsWith('image/');
      const msg = await this.messageModel.create({
        tenantId,
        conversationId: String(conversation._id),
        sender: 'visitor',
        senderId: phone,
        content: i === 0 && text && numMedia > 0 && !created.length ? text : isImage ? '[photo]' : `[file: ${ctype}]`,
        type: isImage ? 'image' : 'file',
        externalId: i === 0 && !created.length ? externalId : undefined,
        attachment: storageKey ? { fileName: url.split('/').pop(), mimeType: ctype, fileSize: file?.buffer.length, storageKey } : { fileName: url.split('/').pop(), mimeType: ctype, fileUrl: url },
      });
      if (storageKey) await this.messageModel.updateOne({ _id: msg._id }, { $set: { 'attachment.fileUrl': this.mediaUrl('msg', String(msg._id)) } });
      created.push(msg);
    }

    await this.conversationModel.updateOne({ _id: conversation._id }, { $inc: { messageCount: created.length }, $set: { lastInboundAt: new Date() } });
    await this.leadModel.updateOne({ _id: lead._id }, { $set: { lastActivityAt: new Date(), lastContactedAt: new Date(), 'customFields.whatsappLastMessage': (text || '[media]').slice(0, 200) } });
    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'whatsapp_received',
      description: `WhatsApp from lead: ${(text || (numMedia ? `${numMedia} attachment(s)` : '')).slice(0, 160)}`,
      newValue: { conversationId: String(conversation._id) },
    });
    for (const m of created) {
      const plain = m.toObject();
      this.chatGateway.emitNewMessage(String(conversation._id), plain);
      this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId: String(conversation._id), message: plain });
    }

    // Human on the chat? Tell them, do not answer automatically.
    const convNow: any = await this.conversationModel.findById(conversation._id).lean();
    const wantsHuman = this.matchesHandoff(text, settings.handoffKeywords);
    if (convNow.mode === 'human' && settings.pauseWhenHuman) {
      await this.notifyTeam(tenantId, lead, convNow, `WhatsApp from ${this.leadName(lead)}`, text || '[attachment]', 'whatsapp_message');
      return;
    }
    if (!settings.enabled) {
      await this.notifyTeam(tenantId, lead, convNow, `WhatsApp from ${this.leadName(lead)} (AI replies off)`, text || '[attachment]', 'whatsapp_message');
      return;
    }
    if (wantsHuman) {
      await this.handToHuman(tenantId, lead, convNow, settings, 'The customer asked for a person');
      return;
    }

    this.scheduleReply(tenantId, String(conversation._id), settings.replyDelaySeconds);
  }

  private matchesHandoff(text: string, keywords: string[]): boolean {
    const t = (text || '').toLowerCase();
    if (!t) return false;
    return keywords.some((k) => k && t.includes(k.toLowerCase()));
  }

  private async findOrCreateLead(tenantId: string, phone: string, profileName?: string) {
    const digits = phone.replace(/\D/g, '');
    const tail = digits.slice(-10);
    let lead: any = await this.leadModel
      .findOne({ tenantId, deletedAt: null, $or: [{ phone }, { phone: new RegExp(`${tail}$`) }] })
      .sort({ updatedAt: -1 });
    if (lead) return lead;
    const parts = (profileName || '').trim().split(/\s+/).filter(Boolean);
    lead = await this.leadModel.create({
      tenantId,
      firstName: parts[0] || 'WhatsApp',
      lastName: parts.slice(1).join(' ') || (parts[0] ? '' : `lead ${tail.slice(-4)}`),
      phone,
      source: 'whatsapp',
      status: 'contacted',
      lastActivityAt: new Date(),
      customFields: { whatsappProfileName: profileName || '' },
    });
    await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'created', description: 'Lead created from an incoming WhatsApp message' });
    // The lead is chatting with us right now - no auto-dial on top of that
    this.bus.emit(PlatformEvents.LEAD_CREATED, { tenantId, lead, skipAutoCall: true });
    return lead;
  }

  private async findOrCreateConversation(tenantId: string, lead: any, phone: string) {
    let conv: any = await this.conversationModel
      .findOne({ tenantId, channel: 'whatsapp', leadId: String(lead._id), status: { $in: ['active', 'handed_off'] }, deletedAt: null })
      .sort({ createdAt: -1 });
    if (conv) return conv;
    conv = await this.conversationModel.create({
      tenantId,
      agentId: WHATSAPP_AGENT_ID,
      channel: 'whatsapp',
      leadId: String(lead._id),
      visitorId: phone,
      status: 'active',
      mode: 'bot',
      assignedUserId: lead.assignedTo || undefined,
      visitorInfo: { firstName: lead.firstName, lastName: lead.lastName, phone, email: lead.email, company: lead.company },
    });
    await this.leadModel.updateOne({ _id: lead._id }, { $addToSet: { conversationIds: String(conv._id) } });
    this.bus.emit(PlatformEvents.CONVERSATION_CREATED, { tenantId, conversation: conv });
    return conv;
  }

  // ─── Reply scheduling (batch the customer's quick-fire messages) ──

  private scheduleReply(tenantId: string, conversationId: string, delaySeconds: number) {
    const key = conversationId;
    const p = this.pending.get(key) || { timer: null, processing: false, again: false };
    if (p.processing) {
      p.again = true;
      this.pending.set(key, p);
      return;
    }
    if (p.timer) clearTimeout(p.timer);
    p.timer = setTimeout(() => void this.runReply(tenantId, conversationId), Math.max(0, delaySeconds) * 1000);
    p.timer.unref?.();
    this.pending.set(key, p);
  }

  private async runReply(tenantId: string, conversationId: string) {
    const p = this.pending.get(conversationId) || { timer: null, processing: false, again: false };
    p.timer = null;
    p.processing = true;
    p.again = false;
    this.pending.set(conversationId, p);
    try {
      await this.reply(tenantId, conversationId);
    } catch (err: any) {
      this.logger.error(`WhatsApp reply failed for conversation ${conversationId}: ${err?.message}`);
    } finally {
      const q = this.pending.get(conversationId);
      if (q) {
        q.processing = false;
        if (q.again) {
          q.again = false;
          this.scheduleReply(tenantId, conversationId, 1);
        } else {
          this.pending.delete(conversationId);
        }
      }
    }
  }

  // ─── The AI turn ──────────────────────────────────────────────────

  async reply(tenantId: string, conversationId: string, opts: { force?: boolean } = {}) {
    const conversation: any = await this.conversationModel.findOne({ _id: conversationId, tenantId });
    if (!conversation) return;
    const settings = await this.getSettings(tenantId);
    if (!opts.force && (conversation.mode === 'human' && settings.pauseWhenHuman)) return;
    const lead: any = await this.leadModel.findOne({ _id: conversation.leadId, tenantId });
    if (!lead) return;

    const history: any[] = (
      await this.messageModel.find({ conversationId, type: { $ne: 'tool_result' } }).sort({ createdAt: -1 }).limit(MAX_HISTORY).lean()
    ).reverse();
    const lastUser = [...history].reverse().find((m) => m.sender === 'visitor');
    if (!lastUser) return;
    // Nothing new since our last answer
    const lastBot = [...history].reverse().find((m) => m.sender !== 'visitor');
    if (lastBot && new Date(lastBot.createdAt) > new Date(lastUser.createdAt) && !opts.force) return;

    const [context, knowledge, media, booking, forms] = await Promise.all([
      this.leadContext(tenantId, lead),
      settings.useKnowledgeBase ? this.knowledgeFor(tenantId, history) : Promise.resolve(''),
      settings.sendMedia ? this.mediaModel.find({ tenantId }).select('title description tags mimeType').limit(60).lean() : Promise.resolve([]),
      this.bookingModel.findOne({ tenantId, leadId: String(lead._id), status: 'collecting' }).sort({ updatedAt: -1 }).lean(),
      Promise.resolve(settings.bookings.enabled ? settings.bookings.forms : []),
    ]);

    const system = this.systemPrompt(settings, lead, context, knowledge, media as any[], forms, booking);
    const messages: ChatMessage[] = [{ role: 'system', content: system }];
    let imagesUsed = 0;
    for (const m of history) {
      const role = m.sender === 'visitor' ? 'user' : 'assistant';
      const msg: ChatMessage = { role, content: m.content || '' };
      if (m.sender === 'visitor' && m.type === 'image' && m.attachment?.storageKey && imagesUsed < MAX_IMAGES_FOR_VISION) {
        // Only the most recent pictures go to the model (cost); older ones stay as "[photo]"
        const recentImages = history.filter((h) => h.sender === 'visitor' && h.type === 'image' && h.attachment?.storageKey).slice(-MAX_IMAGES_FOR_VISION);
        if (recentImages.some((h) => String(h._id) === String(m._id))) {
          const data = await this.imageDataUrl(m.attachment.storageKey, m.attachment.mimeType);
          if (data) {
            msg.images = [data];
            msg.content = m.content && m.content !== '[photo]' ? m.content : 'Please look at this picture and respond to it.';
            imagesUsed++;
          }
        }
      }
      if (m.sender === 'agent') msg.content = `[Human teammate wrote]: ${msg.content}`;
      messages.push(msg);
    }

    const provider = await this.aiFactory.getProviderForTenant(tenantId);
    const tools = this.toolDefinitions(settings, forms, (media as any[]).length > 0);
    const mediaToSend: { id: string; caption?: string }[] = [];
    const state = { lead, conversation, settings, forms, mediaToSend, handedOver: false, paymentText: '' };

    let finalText = '';
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await provider.chatCompletion(messages, { tools, temperature: 0.5, maxTokens: 700 });
      if (result.finishReason === 'tool_calls' && result.toolCalls?.length) {
        const outputs: string[] = [];
        for (const tc of result.toolCalls) {
          const out = await this.runTool(tenantId, state, tc.name, tc.arguments || {});
          outputs.push(`Tool "${tc.name}" result: ${out}`);
          await this.messageModel.create({
            tenantId,
            conversationId,
            sender: 'bot',
            content: `[Tool: ${tc.name}]`,
            type: 'tool_result',
            toolCall: { toolName: tc.name, toolInput: tc.arguments, toolOutput: this.safeJson(out) },
          });
        }
        messages.push({ role: 'assistant', content: result.content || `[Called: ${result.toolCalls.map((t) => t.name).join(', ')}]` });
        messages.push({
          role: 'user',
          content: `Tool execution results:\n${outputs.join('\n')}\n\nNow write the WhatsApp reply to the customer (do not mention tools). If a tool failed, say what you can do instead.`,
        });
        if (state.handedOver) {
          finalText = result.content || '';
          break;
        }
        continue;
      }
      finalText = (result.content || '').trim();
      break;
    }
    if (state.handedOver) return;
    finalText = this.toWhatsAppText(finalText);
    if (!finalText && !mediaToSend.length) finalText = 'Got it - let me check and get back to you shortly.';
    if (state.paymentText) {
      // The model usually quotes the link itself; add only what is missing (link and/or note)
      const [linkLine, ...noteLines] = state.paymentText.split('\n');
      const linkUrl = (linkLine.match(/https?:\/\/\S+/) || [])[0];
      const pieces: string[] = [];
      if (!linkUrl || !finalText.includes(linkUrl)) pieces.push(linkLine);
      const note = noteLines.join('\n').trim();
      if (note && !finalText.includes(note)) pieces.push(note);
      if (pieces.length) finalText = `${finalText}\n\n${pieces.join('\n')}`.trim();
    }

    await this.sendBotMessages(tenantId, conversation, lead, finalText, mediaToSend);
  }

  /**
   * Models write Markdown; WhatsApp understands *bold*, _italic_ and plain
   * URLs only. Convert the common bits so customers never see ** or [text](url).
   */
  private toWhatsAppText(text: string): string {
    return String(text || '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => (label.trim().toLowerCase().includes('link') ? url : `${label}: ${url}`))
      .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private safeJson(s: string): any {
    try {
      return JSON.parse(s);
    } catch {
      return { result: s };
    }
  }

  private async imageDataUrl(key: string, mime?: string): Promise<string | null> {
    try {
      const file = await this.storage.download(this.bucket(), key);
      if (!file?.body?.length || file.body.length > 6 * 1024 * 1024) return null;
      return `data:${mime || file.contentType || 'image/jpeg'};base64,${file.body.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** Send the AI's reply: text first, then each picture with a caption. */
  private async sendBotMessages(tenantId: string, conversation: any, lead: any, text: string, media: { id: string; caption?: string }[]) {
    const conversationId = String(conversation._id);
    const to = conversation.visitorId || lead.phone;
    const sentMsgs: any[] = [];
    if (text) {
      const r = await this.sender.send(tenantId, to, text);
      const msg = await this.messageModel.create({
        tenantId,
        conversationId,
        sender: 'bot',
        content: text,
        type: 'text',
        externalId: r.sid,
        deliveryError: r.ok ? undefined : r.error,
      });
      sentMsgs.push(msg);
      if (!r.ok) this.logger.warn(`WhatsApp reply not delivered to ${to}: ${r.error}`);
    }
    for (const m of media) {
      const doc: any = await this.mediaModel.findOne({ _id: m.id, tenantId }).lean();
      if (!doc) continue;
      const url = this.mediaUrl('lib', String(doc._id));
      const r = await this.sender.send(tenantId, to, m.caption || doc.title || '', url);
      const msg = await this.messageModel.create({
        tenantId,
        conversationId,
        sender: 'bot',
        content: m.caption || doc.title || '[image]',
        type: doc.mimeType?.startsWith('image/') ? 'image' : 'file',
        externalId: r.sid,
        attachment: { fileName: doc.title, fileUrl: url, mimeType: doc.mimeType, fileSize: doc.size, storageKey: doc.storageKey },
        deliveryError: r.ok ? undefined : r.error,
      });
      sentMsgs.push(msg);
      if (r.ok) await this.mediaModel.updateOne({ _id: doc._id }, { $inc: { sentCount: 1 } });
    }
    await this.conversationModel.updateOne({ _id: conversation._id }, { $inc: { messageCount: sentMsgs.length }, $set: { lastBotReplyAt: new Date() } });
    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'whatsapp_sent',
      description: `AI replied on WhatsApp: ${(text || `${media.length} picture(s)`).slice(0, 160)}`,
      newValue: { conversationId },
    });
    for (const m of sentMsgs) {
      const plain = m.toObject();
      this.chatGateway.emitNewMessage(conversationId, plain);
      this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: plain });
    }
  }

  /** A teammate typed a reply in the dashboard: deliver it on WhatsApp and pause the AI. */
  async sendHumanMessage(tenantId: string, conversation: any, content: string, userId: string, pauseAi = true) {
    const to = conversation.visitorId;
    const r = await this.sender.send(tenantId, to, content);
    if (!r.ok) throw new BadRequestException(`WhatsApp not delivered: ${r.error}`);
    if (pauseAi && conversation.mode !== 'human') {
      await this.conversationModel.updateOne({ _id: conversation._id }, { $set: { mode: 'human', assignedUserId: userId } });
    }
    return r;
  }

  async setMode(tenantId: string, conversationId: string, mode: 'bot' | 'human', userId?: string) {
    const conv: any = await this.conversationModel.findOne({ _id: conversationId, tenantId, channel: 'whatsapp' });
    if (!conv) throw new NotFoundException('WhatsApp conversation not found');
    await this.conversationModel.updateOne({ _id: conv._id }, { $set: { mode, ...(mode === 'human' && userId ? { assignedUserId: userId } : {}) } });
    this.chatGateway.emitConversationUpdate(conversationId, { mode });
    return { mode };
  }

  // ─── Context for the prompt ───────────────────────────────────────

  private leadName(lead: any): string {
    return `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'there';
  }

  private async leadContext(tenantId: string, lead: any): Promise<string> {
    const fmt = (d: any) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '');
    const lines: string[] = [];
    lines.push(`Name: ${this.leadName(lead)}${lead.company ? ` (${lead.company})` : ''}`);
    lines.push(`Pipeline stage: ${lead.status || 'new'}${lead.temperature ? `, ${lead.temperature} lead` : ''}; source: ${lead.source || 'unknown'}`);
    const req = lead.customFields?.requirement || lead.customFields?.description || lead.aiCallInsights?.requirement;
    if (req) lines.push(`What they asked about: ${req}`);
    if (lead.aiCallInsights?.budget) lines.push(`Budget: ${lead.aiCallInsights.budget}`);
    if (lead.aiCallInsights?.timeline) lines.push(`Timeline: ${lead.aiCallInsights.timeline}`);
    if (lead.assignedTo) {
      const u: any = await this.userModel.findById(lead.assignedTo).select('firstName lastName phone').lean();
      if (u) lines.push(`Their salesperson: ${`${u.firstName || ''} ${u.lastName || ''}`.trim()}${u.phone ? ` (${u.phone})` : ''}`);
    }
    const calls: any[] = await this.callModel
      .find({ tenantId, leadId: String(lead._id), status: { $in: ['completed', 'no_answer', 'busy', 'voicemail'] } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('createdAt type outcome summary analysis')
      .lean();
    for (const c of calls) {
      const who = c.type === 'human_outbound' || c.type === 'manual' ? 'our salesperson' : 'our AI agent';
      lines.push(`- Call ${fmt(c.createdAt)} by ${who}: ${(c.outcome || 'no result').replace(/_/g, ' ')}${c.summary ? ` - ${c.summary}` : ''}${c.analysis?.objections?.length ? ` (objections: ${c.analysis.objections.join('; ')})` : ''}`);
    }
    const appts: any[] = await this.appointmentModel.find({ tenantId, leadId: String(lead._id) }).sort({ startTime: -1 }).limit(3).select('title startTime status meetingLink conferenceLink').lean();
    for (const a of appts) {
      if (a.status === 'scheduled' || a.status === 'confirmed') lines.push(`- Meeting booked for ${fmt(a.startTime)}${a.meetingLink || a.conferenceLink ? ` (link: ${a.meetingLink || a.conferenceLink})` : ''}`);
      else if (a.status === 'no_show') lines.push(`- They missed the meeting on ${fmt(a.startTime)} - a new time is needed`);
      else if (a.status === 'completed') lines.push(`- Meeting held on ${fmt(a.startTime)}`);
    }
    const tasks: any[] = await this.taskModel.find({ tenantId, leadId: String(lead._id), status: 'pending' }).sort({ dueAt: 1 }).limit(3).select('title dueAt').lean();
    for (const t of tasks) lines.push(`- Our team's pending action: ${t.title} (due ${fmt(t.dueAt)})`);
    const bookings: any[] = await this.bookingModel.find({ tenantId, leadId: String(lead._id), status: { $ne: 'collecting' } }).sort({ createdAt: -1 }).limit(3).lean();
    for (const b of bookings) lines.push(`- Booking "${b.formName}" status: ${b.status.replace('_', ' ')}${b.paymentLink ? ` (payment link: ${b.paymentLink})` : ''}`);
    return lines.join('\n').slice(0, 3000);
  }

  private async knowledgeFor(tenantId: string, history: any[]): Promise<string> {
    const recent = history
      .filter((m) => m.sender === 'visitor')
      .slice(-3)
      .map((m) => m.content)
      .join(' ')
      .slice(0, 500);
    if (!recent.trim()) return '';
    try {
      const chunks: any[] = await this.knowledge.searchKnowledge(tenantId, recent, undefined, 5);
      if (!chunks?.length) return '';
      return chunks.map((c: any, i: number) => `[${i + 1}] ${(c.content || '').slice(0, 700)}`).join('\n');
    } catch {
      return '';
    }
  }

  private systemPrompt(
    s: WhatsAppAiSettings & { companyName: string; timezone: string; callingAgentName: string; gender: 'female' | 'male' },
    lead: any,
    context: string,
    knowledge: string,
    media: any[],
    forms: BookingForm[],
    booking: any,
  ): string {
    const agent = s.agentName || s.callingAgentName || 'Priya';
    const now = new Date().toLocaleString('en-IN', { timeZone: s.timezone, dateStyle: 'full', timeStyle: 'short' });
    const language =
      s.language === 'hi'
        ? 'Reply in Hindi (Devanagari).'
        : s.language === 'en'
          ? 'Reply in English.'
          : s.language === 'hi-en'
            ? 'Reply in natural Hinglish (Hindi written in Latin letters mixed with English).'
            : 'Reply in the language the customer writes in (English, Hindi or Hinglish) - mirror them.';
    const parts: string[] = [
      `You are ${agent}, the ${s.gender === 'female' ? 'female' : 'male'} WhatsApp assistant of ${s.companyName}. You are chatting with a customer (lead) on WhatsApp. Be warm, concise and human - short messages (1-4 lines), no corporate jargon, at most one question per message, emojis sparingly. ${language}`,
      genderPromptRule(s.gender, s.language),
      `Current date/time: ${now} (${s.timezone}, year ${new Date().getFullYear()}). Resolve "tomorrow", "kal", "next Monday" against this.`,
      `What we offer: ${s.instructions || 'See the knowledge base and context below.'}`,
      `CUSTOMER CONTEXT (from calls, meetings and our CRM - use it, do not ask again for what you already know):\n${context}`,
    ];
    if (knowledge) parts.push(`KNOWLEDGE BASE (use for facts; if something is not here, say you will confirm with the team instead of inventing):\n${knowledge}`);
    if (media.length) {
      parts.push(
        `MEDIA LIBRARY - pictures/files you can send with send_media (id - title: description):\n` +
          media.map((m: any) => `${m._id} - ${m.title}${m.description ? `: ${m.description}` : ''}${m.tags?.length ? ` [${m.tags.join(', ')}]` : ''}`).join('\n') +
          `\nSend a picture when it genuinely helps (customer asks to see options, prices, the place, the product). Max ${s.maxMediaPerReply} per reply.`,
      );
    }
    if (forms.length) {
      parts.push(
        `BOOKING FORMS - when the customer wants to book/order, run the matching form: ask for the missing fields ONE or TWO at a time in a natural way, save what they give with save_booking_details (every time you learn something), and call submit_booking once every required field is filled. Do NOT ask for anything not in the form. Never collect card numbers, OTPs or passwords - payment happens only through the payment link we share.\n` +
          forms
            .map(
              (f) =>
                `- form "${f.key}" (${f.name}): ${f.description || ''}\n  fields: ${f.fields
                  .map((x) => `${x.key}${x.required ? '*' : ''} = ${x.label}${x.type === 'choice' && x.options.length ? ` [${x.options.join(' | ')}]` : ''}${x.hint ? ` (${x.hint})` : ''}`)
                  .join('; ')}${f.paymentLink ? '\n  payment: a fixed payment link is shared automatically on submit' : '\n  payment: our team shares the payment link after reviewing'}`,
            )
            .join('\n'),
      );
      if (booking) {
        const form = forms.find((f) => f.key === booking.formKey);
        const missing = form ? form.fields.filter((x) => x.required && (booking.fields?.[x.key] === undefined || booking.fields?.[x.key] === '')).map((x) => x.label) : [];
        parts.push(`BOOKING IN PROGRESS: form "${booking.formKey}", collected so far: ${JSON.stringify(booking.fields || {})}. Still missing: ${missing.length ? missing.join(', ') : 'nothing - call submit_booking now'}.`);
      }
    }
    parts.push(
      [
        'RULES:',
        '- You can see pictures the customer sends: describe what you see when relevant and answer their question about it (a screenshot, a document, a product photo, a location).',
        s.allowBooking
          ? '- Book meetings with book_appointment (confirm date + time first), schedule callbacks with schedule_callback, and when the customer prefers to talk, offer an immediate call with request_call_now.'
          : '- Do not book meetings yourself; offer to have the team call.',
        '- If the customer asks for a human, is angry, or you cannot help after two tries: handoff_to_human.',
        '- Use update_lead whenever you learn their requirement, budget, timeline or that they are not interested.',
        '- Never promise prices, availability or documents you do not have. Never share internal notes or tool names.',
        '- Formatting: this is WhatsApp, not Markdown. Use *single asterisks* for bold, plain URLs (no [text](url)), no headings, short lines.',
        '- Everything the customer asks for that needs a person (custom quote, documents, refunds) -> handoff_to_human with a clear reason.',
      ].join('\n'),
    );
    return parts.join('\n\n');
  }

  // ─── Tools ────────────────────────────────────────────────────────

  private toolDefinitions(s: WhatsAppAiSettings, forms: BookingForm[], hasMedia: boolean): AIToolDefinition[] {
    const tools: AIToolDefinition[] = [
      {
        name: 'update_lead',
        description: 'Record what you learned about the customer: requirement, budget, timeline, interest.',
        parameters: {
          type: 'object',
          properties: {
            requirement: { type: 'string' },
            budget: { type: 'string' },
            timeline: { type: 'string' },
            interest: { type: 'string', enum: ['interested', 'not_interested', 'unsure'] },
            notes: { type: 'string' },
          },
        },
      },
      {
        name: 'handoff_to_human',
        description: 'Hand this chat to a human teammate. Use when asked for a person, for complaints, refunds, custom quotes, or anything you cannot do.',
        parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
      },
    ];
    if (s.allowBooking) {
      tools.push(
        {
          name: 'book_appointment',
          description: 'Book (or move) a meeting / site visit / demo for the customer once the date and time are agreed.',
          parameters: {
            type: 'object',
            properties: {
              startTime: { type: 'string', description: 'ISO 8601 with timezone offset, e.g. 2026-10-07T11:00:00+05:30' },
              notes: { type: 'string' },
            },
            required: ['startTime'],
          },
        },
        {
          name: 'schedule_callback',
          description: 'Schedule a phone call from us at a specific time the customer asked for.',
          parameters: {
            type: 'object',
            properties: { callbackAt: { type: 'string', description: 'ISO 8601 with timezone offset' }, reason: { type: 'string' } },
            required: ['callbackAt'],
          },
        },
        {
          name: 'request_call_now',
          description: 'Have our AI agent call the customer right now (within calling hours) because they prefer talking.',
          parameters: { type: 'object', properties: { reason: { type: 'string' } } },
        },
      );
    }
    if (hasMedia && s.sendMedia && s.maxMediaPerReply > 0) {
      tools.push({
        name: 'send_media',
        description: 'Attach pictures/files from the media library to your reply. Pass the ids from the MEDIA LIBRARY list.',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'object', properties: { id: { type: 'string' }, caption: { type: 'string' } }, required: ['id'] },
            },
          },
          required: ['items'],
        },
      });
    }
    if (forms.length) {
      tools.push(
        {
          name: 'save_booking_details',
          description: 'Save booking form fields the customer has given so far (partial is fine). Returns what is still missing.',
          parameters: {
            type: 'object',
            properties: {
              formKey: { type: 'string', enum: forms.map((f) => f.key) },
              fields: { type: 'object', description: 'field key -> value', additionalProperties: true },
            },
            required: ['formKey', 'fields'],
          },
        },
        {
          name: 'submit_booking',
          description: 'Submit the booking once every required field is filled. Returns the payment link to share (or says the team will send it).',
          parameters: { type: 'object', properties: { formKey: { type: 'string', enum: forms.map((f) => f.key) } }, required: ['formKey'] },
        },
      );
    }
    return tools;
  }

  private async runTool(
    tenantId: string,
    state: { lead: any; conversation: any; settings: WhatsAppAiSettings & { companyName: string; timezone: string }; forms: BookingForm[]; mediaToSend: { id: string; caption?: string }[]; handedOver: boolean; paymentText: string },
    name: string,
    args: Record<string, any>,
  ): Promise<string> {
    const { lead, conversation, settings } = state;
    const leadId = String(lead._id);
    try {
      switch (name) {
        case 'update_lead': {
          const set: any = { lastActivityAt: new Date() };
          if (args.requirement) set['customFields.requirement'] = String(args.requirement).slice(0, 500);
          if (args.budget) set['aiCallInsights.budget'] = String(args.budget).slice(0, 120);
          if (args.timeline) set['aiCallInsights.timeline'] = String(args.timeline).slice(0, 120);
          if (args.interest === 'interested' && ['new', 'contacted'].includes(lead.status)) set.status = 'interested';
          if (args.interest === 'not_interested' && !['won', 'lost', 'meeting'].includes(lead.status)) set.status = 'lost';
          await this.leadModel.updateOne({ _id: lead._id }, { $set: set });
          if (set.status && set.status !== lead.status) {
            await this.activityModel.create({ tenantId, leadId, type: 'status_changed', description: `Status changed from ${lead.status} to ${set.status} (WhatsApp conversation)`, oldValue: lead.status, newValue: set.status });
            lead.status = set.status;
          }
          if (args.notes) await this.activityModel.create({ tenantId, leadId, type: 'note_added', description: `WhatsApp AI note: ${String(args.notes).slice(0, 300)}` });
          return JSON.stringify({ success: true });
        }
        case 'handoff_to_human': {
          await this.handToHuman(tenantId, lead, conversation, settings, String(args.reason || 'Customer needs a person'));
          state.handedOver = true;
          return JSON.stringify({ success: true, message: 'A teammate has been notified and will continue this chat.' });
        }
        case 'book_appointment': {
          const at = new Date(args.startTime);
          if (Number.isNaN(at.getTime())) return JSON.stringify({ success: false, error: 'Invalid date/time - ask the customer for a clear date and time.' });
          if (at.getTime() < Date.now() - 5 * 60_000) return JSON.stringify({ success: false, error: 'That time is in the past. Ask for a future slot.' });
          const calling = await this.calling.getSettings(tenantId);
          const duration = calling.inCallBooking.meetingDurationMinutes || 30;
          const existing: any = await this.appointments.openForLead(tenantId, leadId);
          let appt: any;
          let rescheduled = false;
          if (existing) {
            appt = await this.appointments.reschedule(tenantId, String(existing._id), {
              startTime: at.toISOString(),
              endTime: new Date(at.getTime() + duration * 60_000).toISOString(),
              reason: 'New time agreed on WhatsApp',
              title: `Meeting with ${this.leadName(lead)}`,
              ...(args.notes ? { description: String(args.notes).slice(0, 1000) } : {}),
            } as any);
            rescheduled = true;
          } else {
            appt = await this.appointments.create(tenantId, {
              title: `Meeting with ${this.leadName(lead)}`,
              description: args.notes || 'Booked by the WhatsApp AI assistant',
              assignedTo: lead.assignedTo || '',
              startTime: at.toISOString(),
              endTime: new Date(at.getTime() + duration * 60_000).toISOString(),
              leadId,
              attendee: { name: this.leadName(lead), email: lead.email, phone: lead.phone },
              bookedBy: 'ai',
            } as any);
          }
          await this.tasks
            .create(tenantId, { leadId, title: `Meeting with ${this.leadName(lead)}`, description: args.notes, type: 'meeting', priority: 'high', dueAt: at, assignedTo: lead.assignedTo, source: 'ai' }, 'ai')
            .catch(() => undefined);
          if (!['won', 'lost', 'meeting'].includes(lead.status)) {
            await this.leadModel.updateOne({ _id: lead._id }, { $set: { status: 'meeting', lastActivityAt: new Date() } });
            await this.activityModel.create({ tenantId, leadId, type: 'status_changed', description: `Status changed from ${lead.status} to meeting (booked on WhatsApp)`, oldValue: lead.status, newValue: 'meeting' });
          }
          await this.activityModel.create({ tenantId, leadId, type: 'ai_next_action', description: `WhatsApp AI ${rescheduled ? 'rescheduled the meeting' : 'booked a meeting'} for ${at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' })}`, newValue: { appointmentId: String(appt._id) } });
          return JSON.stringify({
            success: true,
            rescheduled,
            when: at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' }),
            spoken: dateToWords(at, settings.timezone),
            meetingLink: appt.meetingLink || appt.conferenceLink || undefined,
          });
        }
        case 'schedule_callback': {
          const at = new Date(args.callbackAt);
          if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return JSON.stringify({ success: false, error: 'Need a valid future date/time.' });
          const calling = await this.calling.getSettings(tenantId);
          if (calling.enabled && lead.phone) {
            await this.calling.queueAiCall(tenantId, lead, 'callback', { at, settings: calling });
          } else {
            await this.tasks.create(tenantId, { leadId, title: `Call back ${this.leadName(lead)}`, description: args.reason, type: 'call', priority: 'normal', dueAt: at, assignedTo: lead.assignedTo, source: 'ai' }, 'ai');
          }
          await this.activityModel.create({ tenantId, leadId, type: 'ai_next_action', description: `Callback scheduled on WhatsApp for ${at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' })}`, newValue: { reason: args.reason } });
          return JSON.stringify({ success: true, when: at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' }) });
        }
        case 'request_call_now': {
          const calling = await this.calling.getSettings(tenantId);
          if (!calling.enabled || !lead.phone) return JSON.stringify({ success: false, error: 'AI calling is off - offer a callback from the team instead.' });
          const call: any = await this.calling.queueAiCall(tenantId, lead, 'whatsapp_request', { delaySeconds: 0, settings: calling });
          const scheduled = call?.scheduledAt && new Date(call.scheduledAt).getTime() > Date.now() + 60_000;
          return JSON.stringify({
            success: true,
            message: scheduled
              ? `Outside calling hours - the call is scheduled for ${new Date(call.scheduledAt).toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' })}.`
              : 'The call is being placed within a minute.',
          });
        }
        case 'send_media': {
          const items: any[] = Array.isArray(args.items) ? args.items : [];
          const valid: { id: string; caption?: string }[] = [];
          for (const it of items.slice(0, settings.maxMediaPerReply)) {
            const id = String(it?.id || '');
            if (!/^[a-f\d]{24}$/i.test(id)) continue;
            if (!(await this.mediaModel.exists({ _id: id, tenantId }))) continue;
            valid.push({ id, caption: typeof it.caption === 'string' ? it.caption.slice(0, 300) : undefined });
          }
          state.mediaToSend.splice(0, state.mediaToSend.length, ...valid);
          return JSON.stringify({ success: valid.length > 0, attached: valid.length, note: valid.length ? 'They will be sent right after your text reply - do not describe them as links.' : 'No valid media ids.' });
        }
        case 'save_booking_details': {
          const form = state.forms.find((f) => f.key === args.formKey);
          if (!form) return JSON.stringify({ success: false, error: 'Unknown form' });
          const fields = this.cleanFields(form, args.fields || {});
          const existing: any = await this.bookingModel.findOne({ tenantId, leadId, formKey: form.key, status: 'collecting' }).sort({ updatedAt: -1 });
          const merged = { ...(existing?.fields || {}), ...fields };
          let doc: any = existing;
          if (existing) {
            existing.fields = merged;
            existing.markModified('fields');
            await existing.save();
          } else {
            doc = await this.bookingModel.create({ tenantId, leadId, conversationId: String(conversation._id), formKey: form.key, formName: form.name, fields: merged, status: 'collecting', assignedTo: form.notifyUserId || lead.assignedTo || undefined });
          }
          const missing = form.fields.filter((x) => x.required && (merged[x.key] === undefined || merged[x.key] === '')).map((x) => `${x.key} (${x.label})`);
          return JSON.stringify({ success: true, bookingId: String(doc._id), saved: merged, missing, readyToSubmit: missing.length === 0 });
        }
        case 'submit_booking': {
          const form = state.forms.find((f) => f.key === args.formKey);
          if (!form) return JSON.stringify({ success: false, error: 'Unknown form' });
          const doc: any = await this.bookingModel.findOne({ tenantId, leadId, formKey: form.key, status: 'collecting' }).sort({ updatedAt: -1 });
          if (!doc) return JSON.stringify({ success: false, error: 'Nothing collected yet - save the details first.' });
          const missing = form.fields.filter((x) => x.required && (doc.fields?.[x.key] === undefined || doc.fields?.[x.key] === '')).map((x) => x.label);
          if (missing.length) return JSON.stringify({ success: false, error: `Still missing: ${missing.join(', ')}` });
          const result = await this.submitBooking(tenantId, lead, conversation, form, doc, settings);
          if (result.paymentText) state.paymentText = result.paymentText;
          return JSON.stringify({ success: true, bookingId: String(doc._id), summary: doc.fields, payment: result.paymentLink ? `Share this payment link: ${result.paymentLink}` : 'No fixed link - tell the customer our team will send the payment link shortly on WhatsApp.' });
        }
        default:
          return JSON.stringify({ success: false, error: 'Unknown tool' });
      }
    } catch (err: any) {
      this.logger.warn(`WhatsApp tool ${name} failed: ${err?.message}`);
      return JSON.stringify({ success: false, error: String(err?.message || 'failed').slice(0, 200) });
    }
  }

  private cleanFields(form: BookingForm, raw: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const f of form.fields) {
      const v = raw[f.key];
      if (v === undefined || v === null || v === '') continue;
      if (f.type === 'number') {
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (Number.isFinite(n)) out[f.key] = n;
      } else if (f.type === 'choice' && f.options.length) {
        const match = f.options.find((o) => o.toLowerCase() === String(v).toLowerCase()) || f.options.find((o) => String(v).toLowerCase().includes(o.toLowerCase()));
        out[f.key] = match || String(v).slice(0, 200);
      } else {
        out[f.key] = String(v).slice(0, 300);
      }
    }
    return out;
  }

  // ─── Bookings ─────────────────────────────────────────────────────

  private async submitBooking(tenantId: string, lead: any, conversation: any, form: BookingForm, doc: any, settings: { companyName: string }) {
    const leadId = String(lead._id);
    const vars = { ...doc.fields, leadName: this.leadName(lead), phone: lead.phone, bookingId: String(doc._id), amount: doc.fields?.amount ?? doc.fields?.price ?? '' };
    const paymentLink = form.paymentLink ? fillTemplate(form.paymentLink, vars, true) : '';
    const paymentNote = form.paymentNote ? fillTemplate(form.paymentNote, vars, false) : '';
    doc.status = paymentLink ? 'payment_sent' : 'submitted';
    doc.submittedAt = new Date();
    if (paymentLink) {
      doc.paymentLink = paymentLink;
      doc.paymentLinkSentAt = new Date();
    }
    const amount = Number(doc.fields?.amount ?? doc.fields?.price);
    if (Number.isFinite(amount)) doc.amount = amount;
    await doc.save();

    const summary = form.fields
      .filter((f) => doc.fields?.[f.key] !== undefined && doc.fields?.[f.key] !== '')
      .map((f) => `${f.label}: ${doc.fields[f.key]}`)
      .join('\n');
    const assignee = form.notifyUserId || lead.assignedTo || undefined;
    const task = await this.tasks
      .create(
        tenantId,
        {
          leadId,
          title: `Booking request: ${form.name} - ${this.leadName(lead)}`,
          description: `${summary}\n\n${paymentLink ? `Payment link shared: ${paymentLink}` : 'Send the payment link from the Bookings page.'}`,
          type: 'other',
          priority: 'high',
          dueAt: new Date(Date.now() + 30 * 60_000),
          assignedTo: assignee,
          source: 'ai',
        },
        'ai',
      )
      .catch(() => null);
    if (task) {
      doc.taskId = String(task._id);
      await doc.save();
    }
    await this.notifications.notifyTenant(
      tenantId,
      {
        title: `New booking on WhatsApp: ${form.name}`,
        body: `${this.leadName(lead)} · ${lead.phone}\n${summary.slice(0, 300)}`,
        type: 'follow_up',
        data: { leadId, bookingId: String(doc._id), conversationId: String(conversation._id) },
      },
      { assignedTo: assignee },
    );
    await this.activityModel.create({ tenantId, leadId, type: 'ai_next_action', description: `Booking submitted on WhatsApp (${form.name}): ${summary.replace(/\n/g, ', ').slice(0, 200)}`, newValue: { bookingId: String(doc._id) } });
    if (!['won', 'lost'].includes(lead.status) && ['new', 'contacted'].includes(lead.status)) {
      await this.leadModel.updateOne({ _id: lead._id }, { $set: { status: 'interested', temperature: 'hot', lastActivityAt: new Date() } });
    }
    const paymentText = paymentLink ? `💳 Payment link: ${paymentLink}${paymentNote ? `\n${paymentNote}` : ''}` : paymentNote;
    return { paymentLink, paymentText };
  }

  async listBookings(tenantId: string, filters: { status?: string; leadId?: string }, ownerId?: string) {
    const q: any = { tenantId };
    if (filters.status) q.status = filters.status;
    if (filters.leadId) q.leadId = filters.leadId;
    if (ownerId) q.assignedTo = ownerId;
    const docs: any[] = await this.bookingModel.find(q).sort({ createdAt: -1 }).limit(200).lean();
    const leadIds = [...new Set(docs.map((d) => d.leadId))];
    const leads: any[] = leadIds.length ? await this.leadModel.find({ _id: { $in: leadIds } }).select('firstName lastName phone email').lean() : [];
    const byId = new Map(leads.map((l) => [String(l._id), l]));
    return docs.map((d) => ({ ...d, lead: byId.get(String(d.leadId)) || null }));
  }

  /** Team updates: add/replace the payment link (sent to the customer at once), mark paid / confirmed / cancelled. */
  async updateBooking(tenantId: string, id: string, patch: { paymentLink?: string; status?: string; notes?: string; amount?: number }, userId: string) {
    const doc: any = await this.bookingModel.findOne({ _id: id, tenantId });
    if (!doc) throw new NotFoundException('Booking not found');
    const lead: any = await this.leadModel.findById(doc.leadId);
    const conv: any = doc.conversationId ? await this.conversationModel.findById(doc.conversationId).lean() : null;
    if (typeof patch.notes === 'string') doc.notes = patch.notes.slice(0, 1000);
    if (Number.isFinite(patch.amount as number)) doc.amount = patch.amount;
    if (patch.paymentLink && patch.paymentLink.trim()) {
      doc.paymentLink = patch.paymentLink.trim();
      doc.paymentLinkSentAt = new Date();
      if (['collecting', 'submitted'].includes(doc.status)) doc.status = 'payment_sent';
      if (lead?.phone) {
        const text = `Hi ${lead.firstName || ''}, here is the payment link for your ${doc.formName || 'booking'}${doc.amount ? ` (₹${doc.amount})` : ''}:\n${doc.paymentLink}\n\nReply here once done and we will confirm right away.`;
        const r = await this.sender.send(tenantId, conv?.visitorId || lead.phone, text);
        if (conv) {
          const msg = await this.messageModel.create({ tenantId, conversationId: String(conv._id), sender: 'agent', senderId: userId, content: text, type: 'text', externalId: r.sid, deliveryError: r.ok ? undefined : r.error });
          this.chatGateway.emitNewMessage(String(conv._id), msg.toObject());
        }
        await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'whatsapp_sent', description: `Payment link sent on WhatsApp for ${doc.formName}`, performedBy: userId, newValue: { bookingId: String(doc._id) } });
      }
    }
    if (patch.status && ['paid', 'confirmed', 'cancelled', 'submitted', 'payment_sent'].includes(patch.status)) {
      doc.status = patch.status;
      if (patch.status === 'paid') doc.paidAt = new Date();
      if (patch.status === 'confirmed') doc.confirmedAt = new Date();
      if ((patch.status === 'paid' || patch.status === 'confirmed') && lead?.phone) {
        const text = patch.status === 'paid' ? `Payment received, thank you ${lead.firstName || ''}! 🙏 Your ${doc.formName || 'booking'} is being processed - we will share the confirmation shortly.` : `Your ${doc.formName || 'booking'} is confirmed ✅ Thank you, ${lead.firstName || ''}! Reply here if you need anything.`;
        const r = await this.sender.send(tenantId, conv?.visitorId || lead.phone, text);
        if (conv) {
          const msg = await this.messageModel.create({ tenantId, conversationId: String(conv._id), sender: 'agent', senderId: userId, content: text, type: 'text', externalId: r.sid, deliveryError: r.ok ? undefined : r.error });
          this.chatGateway.emitNewMessage(String(conv._id), msg.toObject());
        }
        if (patch.status === 'confirmed' && lead && !['won', 'lost'].includes(lead.status)) {
          await this.leadModel.updateOne({ _id: lead._id }, { $set: { status: 'won', lastActivityAt: new Date() } });
        }
      }
      if (doc.taskId && ['paid', 'confirmed', 'cancelled'].includes(patch.status)) {
        await this.taskModel.updateOne({ _id: doc.taskId, status: 'pending' }, { $set: { status: patch.status === 'cancelled' ? 'cancelled' : 'done', completedAt: new Date() } }).catch(() => undefined);
      }
    }
    await doc.save();
    return doc;
  }

  // ─── Handoff + team notifications ─────────────────────────────────

  private async handToHuman(tenantId: string, lead: any, conversation: any, settings: { companyName: string }, reason: string) {
    await this.conversationModel.updateOne({ _id: conversation._id }, { $set: { mode: 'human', status: 'handed_off', handoffReason: reason, handedOffAt: new Date() } });
    this.chatGateway.emitConversationUpdate(String(conversation._id), { mode: 'human', status: 'handed_off' });
    const owner = lead.assignedTo || undefined;
    await this.tasks
      .create(tenantId, { leadId: String(lead._id), title: `Reply on WhatsApp: ${this.leadName(lead)}`, description: reason, type: 'whatsapp', priority: 'high', dueAt: new Date(Date.now() + 15 * 60_000), assignedTo: owner, source: 'ai' }, 'ai')
      .catch(() => undefined);
    await this.notifyTeam(tenantId, lead, conversation, `WhatsApp needs a human: ${this.leadName(lead)}`, reason, 'whatsapp_handoff');
    await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'ai_next_action', description: `WhatsApp chat handed to the team: ${reason}`, newValue: { conversationId: String(conversation._id) } });
    const text = `Sure - I'm looping in ${owner ? 'your contact at' : 'a teammate from'} ${settings.companyName}. They'll reply here shortly. 🙏`;
    const r = await this.sender.send(tenantId, conversation.visitorId || lead.phone, text);
    const msg = await this.messageModel.create({ tenantId, conversationId: String(conversation._id), sender: 'bot', content: text, type: 'text', externalId: r.sid });
    this.chatGateway.emitNewMessage(String(conversation._id), msg.toObject());
  }

  private async notifyTeam(tenantId: string, lead: any, conversation: any, title: string, body: string, kind: string) {
    await this.notifications
      .notifyTenant(
        tenantId,
        { title, body: (body || '').slice(0, 300), type: 'follow_up', data: { leadId: String(lead._id), conversationId: String(conversation._id), kind } },
        { assignedTo: lead.assignedTo || conversation.assignedUserId || undefined },
      )
      .catch(() => undefined);
    if (lead.assignedTo) {
      await this.notifications
        .create(tenantId, { userId: lead.assignedTo, title, body: (body || '').slice(0, 200), type: 'follow_up', channel: 'push', data: { leadId: String(lead._id), conversationId: String(conversation._id) } })
        .catch(() => undefined);
    }
  }

  // ─── Delivery status (Twilio StatusCallback) ─────────────────────

  async handleStatus(tenantId: string, form: Record<string, any>) {
    const sid = form.MessageSid || form.SmsSid;
    if (!sid) return;
    const status = form.MessageStatus || form.SmsStatus;
    const set: any = { deliveryStatus: status };
    if (form.ErrorCode) set.deliveryError = `${form.ErrorCode} ${form.ErrorMessage || ''}`.trim();
    await this.messageModel.updateOne({ tenantId, externalId: sid }, { $set: set });
  }
}
