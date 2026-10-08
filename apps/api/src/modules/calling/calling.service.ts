import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { CredentialsService } from '../credentials/credentials.service';
import { NotificationService } from '../notification/notification.service';
import { AssignmentService } from '../lead/assignment.service';
import { FollowUpTaskService } from '../follow-up-task/follow-up-task.service';
import { AppointmentService } from '../appointment/appointment.service';
import { SubscriptionService } from '../billing/subscription.service';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { EventBusService, PlatformEvents, LeadCreatedPayload, LeadUpdatedPayload, CallPayload, AppointmentPayload } from '../../common/events';
import { VapiProvider } from './providers/vapi.provider';
import { TwilioVoiceProvider } from './providers/twilio-voice.provider';
import { VoiceCallEvent, VoiceToolCall } from './providers/voice-provider.interface';
import { CallAnalysis, CallAnalysisService } from './call-analysis.service';
import {
  CallingSettings,
  isWithinCallingHours,
  nextCallingSlot,
  pickPlaybook,
  renderTemplate,
  resolveCallingSettings,
} from './calling-settings';
import { CallQueryDto, LogManualCallDto } from './dto';
import { AI_ASSIGNABLE_STATUSES } from '../../common/constants/pipeline';
import { dateToWords } from './speech-text';

const MAX_DIALS_PER_TICK = 20;
const STALE_DIALING_MS = 2 * 60_000;
/** After this long in flight, ask Vapi directly whether the call ended (lost webhook). */
const RECONCILE_AFTER_MS = 90_000;
/** A call we never heard back about, and cannot reconcile, is closed out after this long. */
const STALE_IN_PROGRESS_MS = 20 * 60_000;
const NO_CONTACT = new Set(['no_answer', 'voicemail', 'busy']);

type Actor = { userId: string; role: string };

/**
 * The AI calling engine.
 *
 *   lead created -> queued call -> Vapi dials -> report webhook -> analysis
 *   -> pipeline stage / temperature / assignment / WhatsApp / follow-up task
 *
 * Human calls (Twilio bridge, manual log) join the same path after the
 * transcript exists, so every call ends with a next step on the lead.
 */
@Injectable()
export class CallingService implements OnModuleInit {
  private readonly logger = new Logger(CallingService.name);

  constructor(
    @InjectModel('CallLog') private readonly callModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('FollowUpTask') private readonly taskModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
    private readonly notifications: NotificationService,
    private readonly assignment: AssignmentService,
    private readonly tasks: FollowUpTaskService,
    private readonly appointments: AppointmentService,
    private readonly subscriptions: SubscriptionService,
    private readonly aiFactory: AIProviderFactory,
    private readonly analysis: CallAnalysisService,
    private readonly vapi: VapiProvider,
    private readonly twilio: TwilioVoiceProvider,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit() {
    this.bus.on<LeadCreatedPayload>(PlatformEvents.LEAD_CREATED, (p) => this.onLeadCreated(p));
    this.bus.on<LeadUpdatedPayload>(PlatformEvents.LEAD_UPDATED, (p) => this.onLeadUpdated(p));
    this.bus.on<AppointmentPayload>(PlatformEvents.APPOINTMENT_NO_SHOW, (p) => this.onAppointmentNoShow(p));
  }

  // ─── Settings ─────────────────────────────────────────────────────

  async getSettings(tenantId: string): Promise<CallingSettings & { timezone: string }> {
    const tenant: any =
      tenantId && tenantId !== 'all'
        ? await this.tenantModel.findById(tenantId).select('callingSettings settings name').lean()
        : null;
    const settings = resolveCallingSettings(tenant?.callingSettings);
    if (!settings.assistant.companyName && tenant?.name) settings.assistant.companyName = tenant.name;
    return { ...settings, timezone: tenant?.settings?.timezone || 'Asia/Kolkata' };
  }

  async updateSettings(tenantId: string, patch: Record<string, any>) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('callingSettings').lean();
    const merged = resolveCallingSettings({
      ...(tenant?.callingSettings || {}),
      ...patch,
      assistant: { ...(tenant?.callingSettings?.assistant || {}), ...(patch.assistant || {}) },
      callingHours: { ...(tenant?.callingSettings?.callingHours || {}), ...(patch.callingHours || {}) },
    });
    await this.tenantModel.updateOne({ _id: tenantId }, { $set: { callingSettings: merged } });
    return this.getSettings(tenantId);
  }

  /** What the dashboard needs to explain why calls are (not) going out. */
  async readiness(tenantId: string) {
    const [vapiCreds, twilioCreds, settings] = await Promise.all([
      this.credentials.resolve(tenantId, 'vapi'),
      this.credentials.resolve(tenantId, 'twilio'),
      this.getSettings(tenantId),
    ]);
    const webhookBase = this.publicApiUrl();
    return {
      aiCalling: {
        configured: this.vapi.isConfigured(vapiCreds),
        enabled: settings.enabled,
        usingSavedAssistant: !!vapiCreds.assistantId,
      },
      humanCalling: { configured: this.twilio.isConfigured(twilioCreds) },
      whatsapp: { configured: !!(twilioCreds.accountSid && twilioCreds.authToken && twilioCreds.whatsappNumber) },
      webhookUrl: `${webhookBase}/api/v1/calling/webhooks/vapi`,
      webhookReachable: !/localhost|127\.0\.0\.1/.test(webhookBase),
      withinCallingHours: isWithinCallingHours(new Date(), settings.callingHours, settings.timezone),
      timezone: settings.timezone,
    };
  }

  // ─── Event hooks ──────────────────────────────────────────────────

  private async onLeadCreated({ tenantId, lead, autoCall, skipAutoCall }: LeadCreatedPayload) {
    try {
      const plain = this.plain(lead);
      if (!plain?.phone || skipAutoCall) return;
      const settings = await this.getSettings(tenantId);
      // A sheet import with "call everyone" ticked overrides the workspace default
      if (!autoCall) {
        if (!settings.enabled || !settings.autoCallOnNewLead) return;
        const source = String(plain.source || 'manual').toLowerCase();
        if (settings.autoCallSources.length && !settings.autoCallSources.includes(source)) return;
      }
      await this.queueAiCall(tenantId, plain, autoCall ? 'bulk_import' : 'new_lead', {
        delaySeconds: autoCall ? 0 : settings.firstCallDelaySeconds,
        settings,
      });
      // Dial now (or the moment the line frees up) instead of waiting for the next poll
      this.kickQueue();
    } catch (err: any) {
      this.logger.warn(`Auto-call skipped for new lead: ${err?.message}`);
    }
  }

  /** Won / lost stops every pending automation for the lead. */
  private async onLeadUpdated({ tenantId, lead, changes }: LeadUpdatedPayload) {
    const to = changes?.status?.to;
    if (to !== 'won' && to !== 'lost') return;
    const leadId = String(this.plain(lead)?._id || '');
    if (!leadId) return;
    try {
      await this.callModel.updateMany(
        { tenantId, leadId, status: { $in: ['queued', 'scheduled'] } },
        { $set: { status: 'cancelled', errorMessage: `Lead marked ${to}` } },
      );
      await this.tasks.cancelForLead(tenantId, leadId, `Lead marked ${to}`);
      await this.leadModel.updateOne({ _id: leadId }, { $set: { aiCallStatus: 'skipped' } });
    } catch (err: any) {
      this.logger.warn(`Could not cancel automation for ${leadId}: ${err?.message}`);
    }
  }

  // ─── Queueing ─────────────────────────────────────────────────────

  /**
   * Puts an AI call on the queue. Honours calling hours (unless told not to),
   * attempts, and never double-queues a lead.
   */
  async queueAiCall(
    tenantId: string,
    lead: any,
    reason: string,
    opts: { delaySeconds?: number; at?: Date; ignoreCallingHours?: boolean; settings?: CallingSettings & { timezone: string }; phone?: string; userId?: string } = {},
  ) {
    const settings = opts.settings || (await this.getSettings(tenantId));
    const phone = this.normalisePhone(opts.phone || lead.phone);
    if (!phone) throw new BadRequestException('Lead has no valid phone number');

    // The plan says how many AI calls a month this workspace gets
    const allowance = await this.subscriptions.canPlaceAiCall(tenantId);
    if (!allowance.ok) throw new BadRequestException(allowance.reason || 'AI calling is not available on your plan right now');

    const existing = await this.callModel.findOne({
      tenantId,
      leadId: String(lead._id),
      status: { $in: ['queued', 'scheduled', 'dialing', 'ringing', 'in_progress'] },
    });
    if (existing) return existing;

    const attempt = (lead.callAttempts || 0) + 1;
    let when = opts.at || new Date(Date.now() + (opts.delaySeconds || 0) * 1000);
    if (!opts.ignoreCallingHours) when = nextCallingSlot(when, settings.callingHours, settings.timezone);

    const call = await this.callModel.create({
      tenantId,
      leadId: String(lead._id),
      type: reason === 'reengage' ? 'ai_reengage' : 'ai_outbound',
      provider: 'vapi',
      status: when.getTime() > Date.now() + 5_000 ? 'scheduled' : 'queued',
      toNumber: phone,
      attempt,
      reason,
      scheduledAt: when,
      userId: opts.userId,
    });
    await this.leadModel.updateOne({ _id: lead._id }, { $set: { aiCallStatus: 'queued' } });
    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'call_placed',
      description:
        when.getTime() > Date.now() + 60_000
          ? `AI call scheduled for ${when.toLocaleString('en-IN', { timeZone: settings.timezone })} (${reason.replace(/_/g, ' ')})`
          : `AI call queued (${reason.replace(/_/g, ' ')})`,
      performedBy: opts.userId,
      newValue: { callId: String(call._id) },
    });
    return call;
  }

  async startAiCallNow(tenantId: string, leadId: string, actor: Actor, opts: { phone?: string; ignoreCallingHours?: boolean }) {
    const lead = await this.getLead(tenantId, leadId, actor);
    const settings = await this.getSettings(tenantId);
    const creds = await this.vapiCredsFor(tenantId);
    if (!this.vapi.isConfigured(creds)) {
      throw new BadRequestException('Vapi is not configured. Add the API key and phone number id under Settings > API Credentials.');
    }
    const call = await this.queueAiCall(tenantId, lead, 'manual', {
      ignoreCallingHours: opts.ignoreCallingHours ?? true,
      settings,
      phone: opts.phone,
      userId: actor.userId,
    });
    // Dial immediately instead of waiting for the next tick
    if (call.status === 'queued') await this.dial(call, settings);
    return this.callModel.findById(call._id).lean();
  }

  /**
   * "AI call these leads": queues one call per selected lead (with a phone,
   * not won/lost), now or at a chosen time. Calls go out one after another
   * within the workspace's concurrency limit.
   */
  async bulkAiCall(tenantId: string, leadIds: string[], actor: Actor, opts: { at?: Date; ignoreCallingHours?: boolean }) {
    const ids = [...new Set((leadIds || []).filter((id) => /^[a-f\d]{24}$/i.test(id)))].slice(0, 500);
    if (!ids.length) throw new BadRequestException('Select at least one lead');
    const settings = await this.getSettings(tenantId);
    const creds = await this.vapiCredsFor(tenantId);
    if (!this.vapi.isConfigured(creds)) {
      throw new BadRequestException('Vapi is not configured. Add the API key and phone number id under Settings > API Credentials.');
    }

    const filter: any = { _id: { $in: ids }, tenantId, deletedAt: null };
    if (actor.role === 'SALESPERSON') filter.assignedTo = actor.userId;
    const leads: any[] = await this.leadModel.find(filter).lean();

    let queued = 0;
    let skipped = 0;
    const reasons: Record<string, number> = {};
    const skip = (why: string) => { skipped++; reasons[why] = (reasons[why] || 0) + 1; };

    for (const lead of leads) {
      if (!this.normalisePhone(lead.phone)) { skip('no phone'); continue; }
      if (['won', 'lost'].includes(lead.status)) { skip(`already ${lead.status}`); continue; }
      try {
        const call = await this.queueAiCall(tenantId, lead, 'manual', {
          at: opts.at,
          ignoreCallingHours: opts.ignoreCallingHours ?? !opts.at,
          settings,
          userId: actor.userId,
        });
        if (String(call.userId || '') === actor.userId || call.status === 'queued' || call.status === 'scheduled') queued++;
      } catch (err: any) {
        skip(err?.message || 'error');
      }
    }
    // Dial immediately instead of waiting for the next tick
    if (!opts.at) this.kickQueue();

    return { queued, skipped, reasons, notFound: ids.length - leads.length, startsAt: opts.at || new Date() };
  }

  /** Settings page: ring a number with the configured assistant, no lead needed. */
  async testCall(tenantId: string, phone: string, name: string | undefined, actor: Actor) {
    const settings = await this.getSettings(tenantId);
    const creds = await this.vapiCredsFor(tenantId);
    if (!this.vapi.isConfigured(creds)) throw new BadRequestException('Vapi is not configured yet.');
    const to = this.normalisePhone(phone);
    if (!to) throw new BadRequestException('Enter the number in international format, e.g. +919876543210');

    const call = await this.callModel.create({
      tenantId,
      leadId: 'test',
      type: 'ai_outbound',
      provider: 'vapi',
      status: 'dialing',
      toNumber: to,
      attempt: 1,
      reason: 'test',
      scheduledAt: new Date(),
      userId: actor.userId,
    });
    try {
      const result = await this.vapi.startOutboundCall({
        tenantId,
        callId: String(call._id),
        toNumber: to,
        lead: { id: 'test', name: name || 'there', firstName: name?.split(' ')[0] },
        credentials: creds,
        webhookUrl: this.vapiWebhookUrl(),
        assistant: settings.assistant,
        reason: 'test',
        ...(await this.callExtras(tenantId, settings, null)),
      });
      await this.callModel.updateOne({ _id: call._id }, { $set: { externalId: result.externalId, status: 'ringing', startedAt: new Date() } });
      return { ok: true, callId: String(call._id), externalId: result.externalId };
    } catch (err: any) {
      await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'failed', errorMessage: err?.message } });
      throw new BadRequestException(err?.message || 'Test call failed');
    }
  }

  // ─── Scheduler: dial what is due ──────────────────────────────────

  /**
   * Dials what is due, strictly in queue order and never more than
   * `maxConcurrentCalls` (default 1) per workspace at a time - so ten new
   * leads are called one after another, each after the previous call ended.
   * Runs every few seconds, and immediately when a lead arrives or a call ends.
   */
  async processQueue(): Promise<number> {
    if (this.processing) {
      this.processAgain = true;
      return 0;
    }
    this.processing = true;
    let dialed = 0;
    try {
      dialed = await this.processQueueOnce();
    } finally {
      this.processing = false;
    }
    // Something arrived while we were busy - go again right away
    if (this.processAgain) {
      this.processAgain = false;
      setImmediate(() => void this.processQueue().catch(() => undefined));
    }
    return dialed;
  }

  private processing = false;
  private processAgain = false;

  private async processQueueOnce(): Promise<number> {
    let dialed = 0;
    const now = new Date();

    // Recover crashes mid-dial
    await this.callModel.updateMany(
      { status: 'dialing', updatedAt: { $lt: new Date(now.getTime() - STALE_DIALING_MS) } },
      { $set: { status: 'queued' } },
    );
    // A call in flight for a while: ask the provider whether it already ended
    // (covers a lost webhook, which would otherwise block the queue), and give
    // up entirely after STALE_IN_PROGRESS_MS.
    const inflight = await this.callModel.find({
      provider: 'vapi',
      status: { $in: ['ringing', 'in_progress'] },
      updatedAt: { $lt: new Date(now.getTime() - RECONCILE_AFTER_MS) },
    }).limit(20);
    for (const call of inflight) {
      const reconciled = await this.reconcileWithProvider(call);
      if (!reconciled && now.getTime() - new Date(call.updatedAt).getTime() > STALE_IN_PROGRESS_MS) {
        await this.finishCall(call, { kind: 'ended', endedReason: 'no-report-timeout' });
      }
    }

    const settingsCache = new Map<string, CallingSettings & { timezone: string }>();
    const inFlight = new Map<string, number>();
    // Workspaces whose line is busy this tick: leave their queue untouched, in order
    const blocked = new Set<string>();

    while (dialed < MAX_DIALS_PER_TICK) {
      const call = await this.callModel.findOneAndUpdate(
        {
          status: { $in: ['queued', 'scheduled'] },
          scheduledAt: { $lte: new Date() },
          provider: 'vapi',
          ...(blocked.size ? { tenantId: { $nin: [...blocked] } } : {}),
        },
        { $set: { status: 'dialing' } },
        { sort: { scheduledAt: 1, createdAt: 1 }, new: true },
      );
      if (!call) break;

      let settings = settingsCache.get(call.tenantId);
      if (!settings) {
        settings = await this.getSettings(call.tenantId);
        settingsCache.set(call.tenantId, settings);
      }

      // Explicit asks (button, test, "call everyone in this sheet") run even with the master switch off
      if (!settings.enabled && !['manual', 'test', 'bulk_import'].includes(call.reason)) {
        await this.markFailed(call, 'AI calling is switched off for this workspace');
        continue;
      }
      if (call.reason !== 'manual' && !isWithinCallingHours(new Date(), settings.callingHours, settings.timezone)) {
        // Outside hours (settings changed since queueing): push to the next slot
        const next = nextCallingSlot(new Date(), settings.callingHours, settings.timezone);
        await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'scheduled', scheduledAt: next } });
        continue;
      }

      let active = inFlight.get(call.tenantId);
      if (active === undefined) {
        active = await this.callModel.countDocuments({
          tenantId: call.tenantId,
          provider: 'vapi',
          status: { $in: ['ringing', 'in_progress'] },
        });
      }
      if (active >= settings.maxConcurrentCalls) {
        // Line busy: put it back exactly where it was; it goes out the moment the current call ends
        await this.callModel.updateOne({ _id: call._id }, { $set: { status: call.scheduledAt > now ? 'scheduled' : 'queued' } });
        inFlight.set(call.tenantId, active);
        blocked.add(call.tenantId);
        continue;
      }

      const ok = await this.dial(call, settings);
      inFlight.set(call.tenantId, active + (ok ? 1 : 0));
      if (active + (ok ? 1 : 0) >= settings.maxConcurrentCalls) blocked.add(call.tenantId);
      dialed++;
    }
    return dialed;
  }

  /**
   * Lost-webhook safety net: fetch the call from Vapi and, if it has ended,
   * process it exactly as the end-of-call report would have been.
   */
  private async reconcileWithProvider(call: any): Promise<boolean> {
    if (!call.externalId) return false;
    try {
      const creds = await this.vapiCredsFor(call.tenantId);
      if (!creds.apiKey) return false;
      const remote = await this.vapi.fetchCall(call.externalId, creds.apiKey);
      if (!remote) return false;
      if (remote.status !== 'ended') {
        // Still live - bump updatedAt so we do not re-check every tick
        const next = remote.status === 'in-progress' ? 'in_progress' : remote.status === 'forwarding' ? 'transferring' : call.status;
        await this.callModel.updateOne({ _id: call._id }, { $set: { status: next } });
        if (next !== call.status) this.emitCallUpdate(call.tenantId, { ...call.toObject(), status: next });
        return true;
      }
      this.logger.warn(`Call ${call._id} ended on Vapi without a webhook - reconciling`);
      // `type` must come last: the call object carries its own `type` ("outboundPhoneCall")
      const event = this.vapi.parseWebhook({ message: { ...remote, call: { id: call.externalId }, type: 'end-of-call-report' } });
      await this.finishCall(call, event);
      return true;
    } catch (err: any) {
      this.logger.warn(`Reconcile failed for ${call._id}: ${err?.message}`);
      return false;
    }
  }

  /** Realtime: a call changed state (ringing, on call, transferring, ended). */
  private emitCallUpdate(tenantId: string, call: any) {
    this.bus.emit<CallPayload>(PlatformEvents.CALL_UPDATED, { tenantId, call });
  }

  /** Whatever ends a call frees the line: dial the next one straight away. */
  private kickQueue() {
    setImmediate(() => void this.processQueue().catch(() => undefined));
  }

  /**
   * Vapi credentials for one workspace.
   *
   * A hand-built assistant in the Vapi dashboard replaces the whole script we
   * generate - prompt, language, voice, tools. That is fine when the workspace
   * saved it themselves, but the platform-wide VAPI_ASSISTANT_ID fallback would
   * silently give every workspace the same agent and throw away their settings.
   * So the shared one is dropped here.
   */
  private async vapiCredsFor(tenantId: string): Promise<Record<string, string>> {
    const creds = await this.credentials.resolve(tenantId, 'vapi');
    if (!creds.assistantId) return creds;
    const own = await this.credentials.hasOwnValue(tenantId, 'vapi', 'assistantId').catch(() => false);
    if (own) return creds;
    const { assistantId, ...rest } = creds;
    return rest;
  }
  private async dial(call: any, settings: CallingSettings & { timezone: string }): Promise<boolean> {
    const tenantId = call.tenantId;
    const lead: any = await this.leadModel.findOne({ _id: call.leadId, tenantId, deletedAt: null }).lean();
    if (!lead) {
      await this.markFailed(call, 'Lead no longer exists');
      return false;
    }
    if (['won', 'lost'].includes(lead.status) && call.reason !== 'manual') {
      await this.markFailed(call, `Lead is already ${lead.status}`);
      return false;
    }

    const allowance = await this.subscriptions.canPlaceAiCall(tenantId);
    if (!allowance.ok) {
      await this.markFailed(call, allowance.reason || 'Monthly AI call limit reached');
      await this.notifyAdmins(tenantId, 'AI calling paused', allowance.reason || 'The monthly AI call limit is used up.', lead).catch(() => undefined);
      return false;
    }

    const creds = await this.vapiCredsFor(tenantId);
    if (!this.vapi.isConfigured(creds)) {
      await this.markFailed(call, 'Vapi is not configured (API key / phone number id missing)');
      return false;
    }

    try {
      await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'dialing' } });
      const result = await this.vapi.startOutboundCall({
        tenantId,
        callId: String(call._id),
        toNumber: call.toNumber,
        lead: {
          id: String(lead._id),
          name: this.leadName(lead),
          firstName: lead.firstName,
          company: lead.company,
          email: lead.email,
          source: lead.source,
          requirement:
            lead.customFields?.requirement ||
            lead.customFields?.description ||
            lead.aiCallInsights?.requirement ||
            lead.aiInsights?.requirement,
          notes: [lead.customFields?.city && `City: ${lead.customFields.city}`].filter(Boolean).join('. '),
          stage: lead.status,
          temperature: lead.temperature,
          history: await this.leadHistory(tenantId, lead, String(call._id)),
          brief: typeof lead.customFields?.aiCallBrief === 'string' ? lead.customFields.aiCallBrief.trim() : undefined,
          language: ['en', 'hi', 'hi-en'].includes(lead.customFields?.preferredLanguage) ? lead.customFields.preferredLanguage : undefined,
        },
        playbook: (() => {
          const pb = pickPlaybook(settings.playbooks, lead, call.reason);
          return pb
            ? { name: pb.name, agentName: pb.agentName || undefined, language: pb.language || undefined, firstMessage: pb.firstMessage || undefined, instructions: pb.instructions || undefined }
            : undefined;
        })(),
        credentials: creds,
        webhookUrl: this.vapiWebhookUrl(),
        assistant: settings.assistant,
        reason: call.reason,
        ...(await this.callExtras(tenantId, settings, lead)),
      });
      await this.callModel.updateOne(
        { _id: call._id },
        { $set: { externalId: result.externalId, status: 'ringing', startedAt: new Date(), fromNumber: creds.phoneNumberId } },
      );
      await this.leadModel.updateOne(
        { _id: lead._id },
        { $set: { aiCallStatus: 'calling', lastCallAt: new Date() }, $inc: { callAttempts: 1 } },
      );
      this.bus.emit<CallPayload>(PlatformEvents.CALL_STARTED, { tenantId, call: { ...call.toObject?.() ?? call, externalId: result.externalId }, lead });
      return true;
    } catch (err: any) {
      this.logger.warn(`Dial failed for call ${call._id}: ${err?.message}`);
      await this.markFailed(call, err?.message || 'Dial failed');
      return false;
    }
  }

  /**
   * What the agent should remember about this lead: the last conversations,
   * objections, what is pending and any meeting on the books. Plain text for
   * the system prompt, newest first, bounded.
   */
  private async leadHistory(tenantId: string, lead: any, currentCallId: string): Promise<string | undefined> {
    const lines: string[] = [];
    const fmt = (d: any) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '');

    const calls: any[] = await this.callModel
      .find({ tenantId, leadId: String(lead._id), _id: { $ne: currentCallId }, status: { $in: ['completed', 'no_answer', 'busy', 'voicemail'] } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('createdAt type outcome summary analysis notes')
      .lean();
    for (const c of calls) {
      const who = c.type === 'human_outbound' || c.type === 'manual' ? 'our salesperson' : 'you (AI)';
      const bits = [
        `${fmt(c.createdAt)} - call by ${who}: ${(c.outcome || 'no result').replace(/_/g, ' ')}`,
        c.summary && `summary: ${c.summary}`,
        c.analysis?.objections?.length && `objections: ${c.analysis.objections.join('; ')}`,
        c.analysis?.budget && `budget: ${c.analysis.budget}`,
        c.analysis?.timeline && `timeline: ${c.analysis.timeline}`,
        c.notes && `salesperson notes: ${c.notes}`,
      ].filter(Boolean);
      lines.push(`- ${bits.join(' | ')}`);
    }

    const tasks: any[] = await this.taskModel
      .find({ tenantId, leadId: String(lead._id), status: 'pending' })
      .sort({ dueAt: 1 })
      .limit(3)
      .select('title type dueAt description')
      .lean();
    for (const t of tasks) lines.push(`- Pending: ${t.title}${t.description ? ` (${t.description})` : ''}, due ${fmt(t.dueAt)}`);

    // Meetings on the books - what to confirm, or what they missed
    try {
      const appts: any[] = await this.appointments.recentForLead(tenantId, String(lead._id), 3);
      for (const a of appts) {
        const when = fmt(a.startTime);
        if (a.status === 'no_show') lines.push(`- MISSED MEETING: they did not turn up for the meeting on ${when}${a.rescheduledCount ? ` (already moved ${a.rescheduledCount} time(s))` : ''}. A new time must be agreed and booked with book_appointment.`);
        else if (a.status === 'scheduled' || a.status === 'confirmed') lines.push(`- Meeting booked for ${when}${a.meetingLink || a.conferenceLink ? ' (video link already sent)' : ''}. Confirm they are coming; if they cannot make it, move it with book_appointment.`);
        else if (a.status === 'completed') lines.push(`- Meeting held on ${when}.`);
        else if (a.status === 'cancelled') lines.push(`- Meeting on ${when} was cancelled.`);
      }
    } catch {
      /* context only */
    }

    // What they said on WhatsApp (the AI chat) - so the call does not start from zero
    try {
      const conv: any = await this.conversationModel
        .findOne({ tenantId, channel: 'whatsapp', leadId: String(lead._id), deletedAt: null })
        .sort({ updatedAt: -1 })
        .select('_id summary mode')
        .lean();
      if (conv) {
        const msgs: any[] = await this.messageModel
          .find({ conversationId: String(conv._id), type: { $in: ['text', 'image'] } })
          .sort({ createdAt: -1 })
          .limit(8)
          .select('sender content createdAt')
          .lean();
        if (msgs.length) {
          const chat = msgs
            .reverse()
            .map((m) => `${m.sender === 'visitor' ? 'Lead' : m.sender === 'agent' ? 'Our team' : 'Our WhatsApp AI'}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 160)}`)
            .join(' | ');
          lines.push(`- Recent WhatsApp chat (${fmt(msgs[msgs.length - 1].createdAt)}): ${chat}`);
        }
      }
    } catch {
      /* context only */
    }

    if (lead.aiCallInsights?.callbackAt) lines.push(`- They asked for a callback at ${fmt(lead.aiCallInsights.callbackAt)}`);
    if (lead.lostReason) lines.push(`- Previously marked lost: ${lead.lostReason}`);
    if (lead.reengageAttempts) lines.push(`- Re-engaged ${lead.reengageAttempts} time(s) before`);

    const text = lines.join('\n');
    return text ? text.slice(0, 2500) : undefined;
  }

  private async markFailed(call: any, message: string) {
    await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'failed', errorMessage: message, endedAt: new Date() } });
    this.kickQueue();
    await this.leadModel.updateOne({ _id: call.leadId }, { $set: { aiCallStatus: 'failed' } });
    await this.activityModel.create({
      tenantId: call.tenantId,
      leadId: call.leadId,
      type: 'call_completed',
      description: `AI call could not be placed: ${message}`,
    });
  }

  // ─── Vapi webhooks ────────────────────────────────────────────────

  async handleVapiWebhook(body: any, secretHeader?: string) {
    const event = this.vapi.parseWebhook(body);

    // Somebody dialled our number - answer with the receptionist assistant
    if (event.kind === 'assistant-request') {
      return this.handleInboundAssistantRequest(body?.message || body, secretHeader);
    }

    if (!event.externalId) return { ok: true, ignored: 'no call id' };

    const call = await this.callModel.findOne({ externalId: event.externalId, provider: 'vapi' });
    if (!call) return { ok: true, ignored: 'unknown call' };

    // Verify the shared secret when the tenant (or platform) configured one
    const creds = await this.vapiCredsFor(call.tenantId);
    if (creds.webhookSecret) {
      if (!secretHeader || !this.safeEqual(secretHeader, creds.webhookSecret)) {
        this.logger.warn(`Vapi webhook for call ${call._id} rejected: bad secret`);
        throw new ForbiddenException('Invalid webhook secret');
      }
    }

    if (event.kind === 'tool-calls') {
      return this.handleToolCalls(call, event.toolCalls || []);
    }

    if (event.kind === 'status') {
      const map: Record<string, string> = { queued: 'ringing', ringing: 'ringing', 'in-progress': 'in_progress', forwarding: 'transferring' };
      const next = map[event.status || ''];
      if (next && !['completed', 'no_answer', 'busy', 'voicemail', 'failed', 'cancelled'].includes(call.status) && next !== call.status) {
        const set: any = { status: next };
        if ((next === 'in_progress' || next === 'transferring') && !call.answeredAt) set.answeredAt = new Date();
        await this.callModel.updateOne({ _id: call._id }, { $set: set });
        if (next === 'in_progress' && call.leadId !== 'test') {
          await this.leadModel.updateOne({ _id: call.leadId }, { $set: { aiCallStatus: 'calling', lastContactedAt: new Date() } });
        }
        // Dashboards flip ringing -> on call -> transferring live
        this.emitCallUpdate(call.tenantId, { ...call.toObject(), ...set });
      }
      return { ok: true };
    }

    if (event.kind === 'ended') {
      if (['completed', 'no_answer', 'busy', 'voicemail', 'failed'].includes(call.status) && call.analysis) {
        return { ok: true, ignored: 'already processed' };
      }
      await this.finishCall(call, event);
      return { ok: true };
    }
    return { ok: true, ignored: event.kind };
  }

  // ─── Inbound: the AI answers calls that come IN ───────────────────

  /**
   * Which workspace owns the number that was just dialled:
   *  1. the workspace that saved this exact Vapi number under its own credentials
   *  2. INBOUND_TENANT_ID, for a single-workspace install on the platform number
   *  3. the only workspace that has the receptionist switched on
   */
  private async resolveInboundTenant(phoneNumberId?: string, calledNumber?: string): Promise<string | null> {
    if (phoneNumberId) {
      const own = await this.credentials.findTenantByValue('vapi', 'phoneNumberId', phoneNumberId);
      if (own) return own;
    }
    const pinned = this.configService.get<string>('INBOUND_TENANT_ID') || process.env.INBOUND_TENANT_ID;
    if (pinned) return pinned;

    const enabled: any[] = await this.tenantModel
      .find({ deletedAt: null, status: { $in: ['active', 'trial'] }, 'callingSettings.inbound.enabled': true })
      .select('_id')
      .limit(2)
      .lean();
    if (enabled.length === 1) return String(enabled[0]._id);
    if (enabled.length > 1) {
      this.logger.warn(
        `Inbound call to ${calledNumber || phoneNumberId}: several workspaces have the receptionist on. Each must save its own Vapi phone number id under API Credentials.`,
      );
    }
    return null;
  }

  /** The lead this caller already is, or a new one created from their number. */
  private async leadForCaller(tenantId: string, phone: string, settings: CallingSettings & { timezone: string }) {
    if (phone) {
      const tail = phone.replace(/\D/g, '').slice(-10);
      const existing = await this.leadModel
        .findOne({ tenantId, deletedAt: null, $or: [{ phone }, ...(tail ? [{ phone: new RegExp(`${tail}$`) }] : [])] })
        .sort({ updatedAt: -1 });
      if (existing) return { lead: existing, isNew: false };
    }
    if (!settings.inbound.createLead) return { lead: null, isNew: false };

    const lead = await this.leadModel.create({
      tenantId,
      firstName: 'Caller',
      lastName: phone ? phone.slice(-4) : '',
      phone: phone || undefined,
      source: 'inbound_call',
      status: 'contacted',
      lastActivityAt: new Date(),
      lastContactedAt: new Date(),
    });
    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'created',
      description: 'Lead created from an incoming call',
    });
    // They are on the phone with us right now - never dial them on top of that
    this.bus.emit<LeadCreatedPayload>(PlatformEvents.LEAD_CREATED, { tenantId, lead, skipAutoCall: true } as any);
    return { lead, isNew: true };
  }

  /**
   * Vapi asks this the moment our number rings. We answer with a ready-made
   * assistant, so the caller hears a person-like greeting within a second -
   * and by then the lead and the call record already exist.
   */
  async handleInboundAssistantRequest(message: any, secretHeader?: string) {
    const call = message?.call || {};
    const externalId: string = call.id || message?.callId || '';
    const phoneNumberId: string = call.phoneNumberId || message?.phoneNumber?.id || '';
    const calledNumber: string = call.phoneNumber?.number || message?.phoneNumber?.number || '';
    const callerNumber = this.normalisePhone(call.customer?.number || message?.customer?.number || '') || '';

    const tenantId = await this.resolveInboundTenant(phoneNumberId, calledNumber);
    if (!tenantId) {
      return { error: 'This number is not set up to take calls right now. Please try again later.' };
    }

    const settings = await this.getSettings(tenantId);
    const creds = await this.vapiCredsFor(tenantId);
    if (creds.webhookSecret && (!secretHeader || !this.safeEqual(secretHeader, creds.webhookSecret))) {
      this.logger.warn('Inbound assistant request rejected: bad webhook secret');
      throw new ForbiddenException('Invalid webhook secret');
    }
    if (!settings.enabled || !settings.inbound.enabled) {
      return { error: 'Thanks for calling. Nobody is available on this line right now - please try again later.' };
    }

    const { lead } = await this.leadForCaller(tenantId, callerNumber, settings);
    const leadId = lead ? String(lead._id) : 'unknown';

    const existing = externalId ? await this.callModel.findOne({ externalId, provider: 'vapi' }) : null;
    const callLog =
      existing ||
      (await this.callModel.create({
        tenantId,
        leadId,
        type: 'ai_inbound',
        direction: 'inbound',
        provider: 'vapi',
        status: 'in_progress',
        externalId: externalId || undefined,
        toNumber: calledNumber || undefined,
        fromNumber: callerNumber || undefined,
        attempt: 1,
        reason: 'inbound',
        startedAt: new Date(),
        answeredAt: new Date(),
      }));

    if (lead) {
      await this.leadModel.updateOne({ _id: lead._id }, { $set: { aiCallStatus: 'calling', lastActivityAt: new Date() } });
      await this.activityModel.create({
        tenantId,
        leadId,
        type: 'call_placed',
        description: `Incoming call answered by the AI${callerNumber ? ` from ${callerNumber}` : ''}`,
        newValue: { callId: String(callLog._id) },
      });
    }
    this.bus.emit<CallPayload>(PlatformEvents.CALL_STARTED, { tenantId, call: callLog.toObject?.() ?? callLog, lead });

    const openNow = isWithinCallingHours(new Date(), settings.callingHours, settings.timezone);
    const extras = await this.callExtras(tenantId, settings, lead);
    const afterHoursRule = openNow
      ? ''
      : settings.inbound.afterHours === 'callback'
        ? 'The team is off the floor right now (outside office hours). Do not offer to put them through. Agree an exact time for us to call them back and lock it in with schedule_callback.'
        : settings.inbound.afterHours === 'message'
          ? 'The team is off the floor right now (outside office hours). Do not offer to put them through or to book anything - take down what they need and tell them the team will get back during office hours.'
          : 'The team is off the floor right now (outside office hours). Do not offer to put them through. Offer a meeting at a time that suits them and confirm it with book_appointment.';

    const assistant = this.vapi.buildInboundAssistant(
      {
        tenantId,
        callId: String(callLog._id),
        toNumber: callerNumber,
        lead: {
          id: leadId,
          name: lead ? this.leadName(lead) : 'the caller',
          firstName: lead?.firstName,
          company: lead?.company,
          email: lead?.email,
          source: lead?.source,
          requirement: lead?.customFields?.requirement || lead?.aiCallInsights?.requirement,
          stage: lead?.status,
          temperature: lead?.temperature,
          history: lead ? await this.leadHistory(tenantId, lead, String(callLog._id)) : undefined,
        },
        credentials: creds,
        webhookUrl: this.vapiWebhookUrl(),
        assistant: {
          ...settings.assistant,
          firstMessage: settings.inbound.greeting || settings.assistant.firstMessage,
          extraInstructions: [settings.assistant.extraInstructions, settings.inbound.instructions, afterHoursRule]
            .filter(Boolean)
            .join('\n'),
        },
        reason: 'inbound',
        direction: 'inbound',
        ...extras,
        // Only put callers through while somebody is actually there to pick up
        transfer: openNow && settings.inbound.transferDuringHours ? extras.transfer : undefined,
      },
      creds.webhookSecret,
    );

    this.logger.log(`Inbound call ${externalId} from ${callerNumber || 'unknown'} answered for tenant ${tenantId}`);
    return { assistant };
  }

  // ─── Mid-call tools (answered synchronously to the voice provider) ─

  /**
   * The assistant booked a meeting or scheduled a callback while still on the
   * phone. Do it for real and tell the assistant what to say.
   */
  private async handleToolCalls(call: any, toolCalls: VoiceToolCall[]) {
    const tenantId = call.tenantId;
    const settings = await this.getSettings(tenantId);
    const lead = call.leadId !== 'test' ? await this.leadModel.findOne({ _id: call.leadId, tenantId }) : null;
    const results: { toolCallId: string; result: string }[] = [];
    const actions: Record<string, any> = { ...(call.actions || {}) };

    for (const tc of toolCalls) {
      let result = 'Done.';
      try {
        if (tc.name === 'book_appointment') {
          const at = new Date(tc.arguments?.startTime);
          if (Number.isNaN(at.getTime())) throw new Error('I need a valid date and time.');
          if (at.getTime() < Date.now() - 5 * 60_000) throw new Error('That time is already in the past. Ask for a future slot.');
          const when = at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' });
          if (!lead) {
            result = `Test mode: the meeting would be booked for ${when}.`;
          } else {
            const duration = settings.inCallBooking.meetingDurationMinutes;
            let appointmentId: string | undefined;
            let rescheduled = false;
            try {
              const booked = await this.upsertAppointmentForLead(
                tenantId,
                lead,
                at,
                duration,
                [tc.arguments?.notes, tc.arguments?.mode && `Mode: ${tc.arguments.mode}`].filter(Boolean).join(' · ') || undefined,
              );
              appointmentId = booked.id;
              rescheduled = booked.rescheduled;
            } catch (err: any) {
              if (/conflict/i.test(err?.message || '')) {
                throw new Error(`That slot is not free (${err.message}). Apologise and offer a different time.`);
              }
              this.logger.warn(`In-call appointment not created: ${err?.message}`);
            }
            const task = await this.tasks.create(
              tenantId,
              {
                leadId: String(lead._id),
                title: `Meeting with ${this.leadName(lead)}`,
                description: tc.arguments?.notes,
                type: 'meeting',
                priority: 'high',
                dueAt: at,
                assignedTo: lead.assignedTo,
                source: 'ai',
                callId: String(call._id),
              },
              'ai',
            );
            if (!['won', 'lost'].includes(lead.status) && lead.status !== 'meeting') {
              await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'status_changed', description: `Status changed from ${lead.status} to meeting (booked on AI call)`, oldValue: lead.status, newValue: 'meeting' });
              await this.leadModel.updateOne({ _id: lead._id }, { $set: { status: 'meeting', lastActivityAt: new Date() } });
            }
            // One meeting task per lead: a moved meeting replaces the old reminder task
            await this.taskModel.updateMany(
              { tenantId, leadId: String(lead._id), type: 'meeting', status: 'pending', _id: { $ne: task._id } },
              { $set: { status: 'cancelled', completedAt: new Date() } },
            );
            actions.appointmentId = appointmentId;
            actions.taskId = String(task._id);
            actions.bookedInCall = at;
            if (rescheduled) actions.rescheduledInCall = true;
            await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'ai_next_action', description: `AI ${rescheduled ? 'rescheduled the meeting' : 'booked a meeting'} on the call for ${when}`, newValue: { appointmentId, taskId: String(task._id) } });
            result = `${rescheduled ? 'Rescheduled' : 'Booked'}. The meeting is confirmed for ${dateToWords(at, settings.timezone)}. Tell the person it is confirmed (say the day and time in words) and that they will get the details on WhatsApp.`;
          }
        } else if (tc.name === 'schedule_callback') {
          const at = new Date(tc.arguments?.callbackAt);
          if (Number.isNaN(at.getTime())) throw new Error('I need a valid date and time.');
          if (at.getTime() < Date.now()) throw new Error('That time is already in the past. Ask for a future time.');
          const when = at.toLocaleString('en-IN', { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' });
          if (lead) {
            if (lead.assignedTo) {
              const task = await this.tasks.create(
                tenantId,
                { leadId: String(lead._id), title: `Call back ${this.leadName(lead)}`, description: tc.arguments?.reason, type: 'call', priority: 'normal', dueAt: at, assignedTo: lead.assignedTo, source: 'ai', callId: String(call._id) },
                'ai',
              );
              actions.taskId = String(task._id);
            } else {
              const cb = await this.queueAiCall(tenantId, lead.toObject(), 'callback', { at, ignoreCallingHours: true, settings });
              actions.callbackCallId = String(cb._id);
            }
            actions.callbackInCall = at;
            await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'ai_next_action', description: `Callback scheduled on the call for ${when}${tc.arguments?.reason ? ` - ${tc.arguments.reason}` : ''}` });
          }
          result = `Noted. We will call back on ${dateToWords(at, settings.timezone)}. Confirm that with the person in words and wrap up politely.`;
        } else {
          result = 'This tool is not available.';
        }
      } catch (err: any) {
        result = err?.message || 'Could not do that.';
      }
      results.push({ toolCallId: tc.id, result });
    }

    await this.callModel.updateOne({ _id: call._id }, { $set: { actions } });
    return { results };
  }

  /** Transfer destinations, booking tools and timezone for one call. */
  private async callExtras(tenantId: string, settings: CallingSettings & { timezone: string }, lead: any) {
    const destinations: { number: string; label: string }[] = [];
    if (settings.transfer.enabled) {
      if (settings.transfer.preferAssignedSalesperson && lead?.assignedTo) {
        const owner: any = await this.userModel.findById(lead.assignedTo).select('phone firstName lastName').lean();
        const num = this.normalisePhone(owner?.phone);
        if (num) destinations.push({ number: num, label: `${owner.firstName || 'Assigned salesperson'} (lead owner)` });
      }
      for (const dest of settings.transfer.destinations) {
        const num = this.normalisePhone(dest.number);
        if (!num || destinations.some((d) => d.number === num)) continue;
        const label = [dest.name || 'Teammate', dest.description].filter(Boolean).join(' - ');
        destinations.push({ number: num, label });
      }
      const main = this.normalisePhone(settings.transfer.number);
      if (main && !destinations.some((d) => d.number === main)) destinations.push({ number: main, label: 'Sales team (default)' });
    }
    return {
      timezone: settings.timezone,
      transfer: destinations.length
        ? { destinations, message: settings.transfer.message, instructions: settings.transfer.instructions }
        : undefined,
      tools: settings.inCallBooking.enabled
        ? {
            webhookUrl: this.vapiWebhookUrl(),
            booking: true,
            meetingDurationMinutes: settings.inCallBooking.meetingDurationMinutes,
            instructions: settings.inCallBooking.instructions,
          }
        : undefined,
    };
  }

  /** Stores the report and runs the pipeline reaction. Idempotent per call. */
  private async finishCall(call: any, event: VoiceCallEvent) {
    const tenantId = call.tenantId;
    const settings = await this.getSettings(tenantId);

    const spoke = !!(event.transcript && event.transcript.trim().length > 20) || !!(event.segments && event.segments.some((s) => s.role === 'lead'));
    const transferred = /forwarded|transfer/i.test(event.endedReason || '');
    const answered = spoke || transferred || /customer-ended|assistant-ended|max-duration|silence-timeout|exceeded/i.test(event.endedReason || '');

    let analysis: CallAnalysis | null = null;
    if (spoke) {
      const lead = await this.leadModel.findById(call.leadId).lean();
      analysis = this.analysis.fromStructured(event.structured, event.summary, settings.hotThreshold);
      if (!analysis) {
        analysis = await this.analysis.fromTranscript(tenantId, { transcript: event.transcript, lead }, settings.hotThreshold);
      }
    } else if (transferred) {
      // Handed to a human before much was said: a live conversation happened, keep the lead warm
      analysis = this.analysis.fromStructured({ outcome: 'interested', interestLevel: 60, nextAction: 'call', nextActionInHours: 4, summary: event.summary || 'Call transferred to a teammate.' }, event.summary, settings.hotThreshold)!;
    } else {
      analysis = this.analysis.fromEndedReason(event.endedReason, settings.hotThreshold);
    }
    if (transferred && analysis) analysis.summary = `${analysis.summary || ''} (Transferred live to a teammate.)`.trim();

    const status = spoke || answered
      ? 'completed'
      : analysis.outcome === 'voicemail' ? 'voicemail'
      : analysis.outcome === 'busy' ? 'busy'
      : 'no_answer';

    await this.callModel.updateOne(
      { _id: call._id },
      {
        $set: {
          status,
          endedReason: event.endedReason,
          startedAt: event.startedAt || call.startedAt,
          endedAt: event.endedAt || new Date(),
          durationSeconds: event.durationSeconds ?? call.durationSeconds ?? 0,
          recordingUrl: event.recordingUrl,
          transcript: event.transcript,
          transcriptSegments: event.segments,
          summary: analysis.summary || event.summary,
          outcome: analysis.outcome,
          analysis: this.analysisForStorage(analysis),
          costUsd: event.costUsd,
          raw: event.raw ? this.trimRaw(event.raw) : undefined,
        },
      },
    );

    // The line is free - next lead in the queue goes out now
    this.kickQueue();

    if (call.leadId === 'test') return;
    const fresh = await this.callModel.findById(call._id);
    await this.applyOutcome(fresh, analysis, settings, { byHuman: false });
  }

  // ─── The pipeline reaction ────────────────────────────────────────

  /**
   * What happens after any call. Drives stage, temperature, assignment,
   * WhatsApp fallback, retries, follow-up tasks and the team notifications.
   */
  private async applyOutcome(
    call: any,
    analysis: CallAnalysis,
    settings: CallingSettings & { timezone: string },
    opts: { byHuman: boolean; actorId?: string },
  ) {
    const tenantId = call.tenantId;
    const lead = await this.leadModel.findOne({ _id: call.leadId, tenantId, deletedAt: null });
    if (!lead) return;

    const actions: Record<string, any> = {};
    const name = this.leadName(lead);
    const noContact = NO_CONTACT.has(analysis.outcome);
    const isAi = !opts.byHuman;
    const before = { status: lead.status, temperature: lead.temperature, assignedTo: lead.assignedTo };

    // 0. An unknown caller told us their name on the call - stop calling them "Caller 1234"
    if (analysis.callerName && this.isPlaceholderName(lead)) {
      const parts = analysis.callerName.replace(/\s+/g, ' ').trim().split(' ');
      lead.firstName = parts[0];
      lead.lastName = parts.slice(1).join(' ');
      await this.activityModel.create({
        tenantId,
        leadId: String(lead._id),
        type: 'field_updated',
        description: `Caller gave their name on the call: ${analysis.callerName}`,
      });
    }

    // 1. Record the call on the lead
    lead.lastCallAt = new Date();
    lead.lastCallOutcome = analysis.outcome;
    lead.lastActivityAt = new Date();
    if (isAi) lead.aiCallStatus = noContact ? (lead.aiCallStatus === 'calling' ? 'done' : lead.aiCallStatus) : 'done';
    if (!noContact) {
      lead.lastContactedAt = new Date();
      lead.aiCallInsights = {
        interestLevel: analysis.interestLevel,
        outcome: analysis.outcome,
        summary: analysis.summary,
        requirement: analysis.requirement,
        budget: analysis.budget,
        timeline: analysis.timeline,
        objections: analysis.objections,
        nextAction: analysis.nextAction.title,
        nextActionReason: analysis.nextAction.reason,
        callbackAt: analysis.callbackAt,
        callId: String(call._id),
        analysedAt: new Date(),
      };
      // Keep the chat-era insight block in step so the dossier and scoring see it
      lead.aiInsights = {
        ...(lead.aiInsights || {}),
        requirement: analysis.requirement || lead.aiInsights?.requirement,
        budget: analysis.budget || lead.aiInsights?.budget,
        timeline: analysis.timeline || lead.aiInsights?.timeline,
        intent: analysis.interestLevel >= settings.hotThreshold ? 'high' : analysis.interestLevel >= 40 ? 'medium' : 'low',
        nextStep: analysis.nextAction.title,
        keyPoints: analysis.keyPoints,
        objections: analysis.objections,
      };
      lead.aiSummary = analysis.summary || lead.aiSummary;
      lead.aiSummaryUpdatedAt = new Date();
    }

    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'call_completed',
      description: `${isAi ? 'AI call' : 'Call'} ${analysis.outcome.replace(/_/g, ' ')}${call.durationSeconds ? ` (${Math.round(call.durationSeconds / 60)} min)` : ''}${analysis.summary ? `: ${analysis.summary}` : ''}`,
      performedBy: opts.actorId,
      newValue: { callId: String(call._id), outcome: analysis.outcome, interestLevel: analysis.interestLevel },
    });

    // 2. Stage + temperature
    if (analysis.outcome === 'wrong_number') {
      // Not worth retrying; a human decides what to do with the record
      if (isAi) lead.aiCallStatus = 'skipped';
    }
    let nextStatus = analysis.suggestedStatus;
    if (nextStatus && ['won', 'lost'].includes(lead.status)) nextStatus = '';
    if (nextStatus && isAi && !AI_ASSIGNABLE_STATUSES.includes(nextStatus as any)) nextStatus = '';
    if (nextStatus && opts.byHuman && ['won', 'lost'].includes(nextStatus)) nextStatus = ''; // a human confirms won/lost explicitly
    if (nextStatus === 'lost' && analysis.outcome === 'wrong_number') nextStatus = '';
    if (noContact && !nextStatus && lead.status === 'new' && (settings.whatsappOnNoAnswer || call.attempt >= settings.maxAttempts)) {
      // Outreach happened (call + WhatsApp) even if nobody picked up
      nextStatus = 'contacted';
    }
    if (nextStatus && nextStatus !== lead.status) {
      const rank = ['new', 'contacted', 'interested', 'follow_up', 'meeting'];
      // The AI never moves a lead backwards in the funnel
      const backwards = rank.includes(nextStatus) && rank.includes(lead.status) && rank.indexOf(nextStatus) < rank.indexOf(lead.status);
      if (!backwards) {
        await this.activityModel.create({
          tenantId,
          leadId: String(lead._id),
          type: 'status_changed',
          description: `Status changed from ${lead.status} to ${nextStatus} after ${isAi ? 'AI call' : 'call'}`,
          oldValue: lead.status,
          newValue: nextStatus,
          performedBy: opts.actorId,
        });
        lead.status = nextStatus;
        if (nextStatus === 'lost') lead.lostReason = analysis.outcome === 'not_interested' ? 'Not interested (call)' : analysis.summary?.slice(0, 200);
        actions.status = nextStatus;
      }
    }
    if (!noContact) {
      lead.temperature = analysis.temperature;
      // Score floors at the interest level; the scoring engine re-applies rules on LEAD_UPDATED
      if (analysis.interestLevel > (lead.score || 0)) lead.score = analysis.interestLevel;
    }

    // 3. Hot lead -> a salesperson, right now
    const isHot = !noContact && analysis.interestLevel >= settings.hotThreshold;
    if (isHot && !lead.assignedTo) {
      const userId = await this.assignment.pickAssignee(tenantId, lead.toObject());
      if (userId) {
        lead.assignedTo = userId;
        actions.assignedTo = userId;
        await this.activityModel.create({
          tenantId,
          leadId: String(lead._id),
          type: 'assigned',
          description: 'Auto-assigned: hot after AI call',
          newValue: userId,
        });
      }
    }

    await lead.save();

    // 4. No answer: WhatsApp + retry
    if (noContact && isAi) {
      if (settings.whatsappOnNoAnswer && analysis.outcome !== 'wrong_number' && !(await this.alreadyMessaged(tenantId, lead, call.attempt))) {
        const sent = await this.sendWhatsApp(tenantId, lead, settings.whatsappNoAnswerTemplate, settings, { callId: String(call._id), attempt: call.attempt });
        actions.whatsapp = sent;
      }
      if (analysis.outcome !== 'wrong_number' && call.attempt < settings.maxAttempts && call.reason !== 'test') {
        const retry = await this.queueAiCall(tenantId, lead.toObject(), 'retry', {
          // They rang US and hung up before we could help - call straight back
          delaySeconds: call.direction === 'inbound' ? 120 : settings.retryDelayMinutes * 60,
          settings,
        });
        actions.retryCallId = String(retry._id);
        actions.retryAt = retry.scheduledAt;
      } else if (call.attempt >= settings.maxAttempts && call.reason !== 'test') {
        // Give up on the phone; a human takes it from here
        const task = await this.tasks.create(
          tenantId,
          {
            leadId: String(lead._id),
            title: `Reach ${name} another way (${settings.maxAttempts} AI calls unanswered)`,
            description: 'Try WhatsApp, email or a call from your own number.',
            type: 'whatsapp',
            priority: 'normal',
            dueAt: new Date(Date.now() + 24 * 3_600_000),
            assignedTo: lead.assignedTo,
            source: 'ai',
            callId: String(call._id),
          },
          'ai',
        );
        actions.taskId = String(task._id);
        if (!lead.assignedTo) await this.notifyAdmins(tenantId, `Unreachable: ${name}`, `${settings.maxAttempts} AI calls went unanswered. Assign someone to try another channel.`, lead);
      }
    }

    // 5. Real conversation: the next step
    if (!noContact) {
      const dueAt = this.dueFor(analysis, settings);

      if (call.actions?.bookedInCall || call.actions?.callbackInCall) {
        // Already booked / scheduled live on the call through a tool - nothing to duplicate
        Object.assign(actions, call.actions);
      } else if (analysis.outcome === 'meeting_booked' || (analysis.meetingAt && analysis.nextAction.type === 'meeting')) {
        const at = analysis.meetingAt || dueAt;
        const task = await this.tasks.create(
          tenantId,
          {
            leadId: String(lead._id),
            title: `Meeting with ${name}`,
            description: analysis.summary,
            type: 'meeting',
            priority: 'high',
            dueAt: at,
            assignedTo: lead.assignedTo,
            source: 'ai',
            callId: String(call._id),
          },
          'ai',
        );
        actions.taskId = String(task._id);
        actions.appointmentId = await this.bookAppointment(tenantId, lead, at, analysis);
      } else if (analysis.outcome === 'callback') {
        if (lead.assignedTo || isHot) {
          const task = await this.tasks.create(
            tenantId,
            {
              leadId: String(lead._id),
              title: analysis.nextAction.title || `Call back ${name}`,
              description: analysis.nextAction.reason || analysis.summary,
              type: 'call',
              priority: isHot ? 'high' : 'normal',
              dueAt,
              assignedTo: lead.assignedTo,
              source: 'ai',
              callId: String(call._id),
            },
            'ai',
          );
          actions.taskId = String(task._id);
        } else if (isAi) {
          // Nobody owns it yet: the AI keeps the appointment itself
          const cb = await this.queueAiCall(tenantId, lead.toObject(), 'callback', { at: dueAt, ignoreCallingHours: true, settings });
          actions.callbackCallId = String(cb._id);
        }
      } else if (
        isAi &&
        analysis.nextAction.type === 'whatsapp' &&
        analysis.whatsappDetails &&
        settings.postCallWhatsapp.enabled
      ) {
        // The AI promised details on WhatsApp and the post-call message carries
        // them - nothing is left for a human to do, so no task
        await this.activityModel.create({
          tenantId,
          leadId: String(lead._id),
          type: 'ai_next_action',
          description: `Details promised on the call sent on WhatsApp automatically: ${analysis.whatsappDetails.slice(0, 140)}`,
          newValue: { callId: String(call._id) },
        });
        actions.whatsappDetailsSent = true;
      } else if (analysis.outcome === 'interested' || (analysis.nextAction.type !== 'none' && !['not_interested', 'lost'].includes(analysis.outcome))) {
        const task = await this.tasks.create(
          tenantId,
          {
            leadId: String(lead._id),
            title: analysis.nextAction.title,
            // One line of why - the full summary lives on the call record
            description: (analysis.nextAction.reason || analysis.summary || '').slice(0, 180),
            type: analysis.nextAction.type === 'none' ? 'call' : analysis.nextAction.type,
            priority: isHot ? 'high' : 'normal',
            dueAt,
            assignedTo: lead.assignedTo,
            source: opts.byHuman ? 'human_call' : 'ai',
            callId: String(call._id),
          },
          'ai',
        );
        actions.taskId = String(task._id);
        if (isHot && !lead.assignedTo) {
          await this.notifyAdmins(tenantId, `Hot lead needs an owner: ${name}`, `Interest ${analysis.interestLevel}/100 on the AI call. ${analysis.summary || ''}`, lead);
        }
      }

      // The lead gets a WhatsApp: thank you, plus the meeting / callback details
      if (isAi && settings.postCallWhatsapp.enabled && analysis.outcome !== 'wrong_number') {
        actions.postCallWhatsapp = await this.sendPostCallWhatsApp(tenantId, lead, call, analysis, settings, actions);
      }

      // ...and the same by e-mail when we have an address: whatever was promised
      // on the call, the meeting details, the callback time
      if (
        isAi &&
        lead.email &&
        analysis.outcome !== 'wrong_number' &&
        (analysis.whatsappDetails || actions.appointmentId || actions.bookedInCall || actions.callbackInCall || ['meeting_booked', 'callback', 'interested'].includes(analysis.outcome))
      ) {
        actions.postCallEmail = await this.sendPostCallEmail(tenantId, lead, call, analysis, settings, actions);
      }

      // An incoming call always reaches the team - this is business walking in
      if (call.direction === 'inbound' && settings.inbound.notifyTeam) {
        const who = settings.inbound.notifyUserId || lead.assignedTo || undefined;
        await this.notifications
          .notifyTenant(
            tenantId,
            {
              title: `Incoming call: ${name}`,
              body: `${call.fromNumber || 'Unknown number'} · ${analysis.outcome.replace(/_/g, ' ')} · interest ${analysis.interestLevel}/100. ${analysis.summary || ''}`,
              type: 'call',
              data: { leadId: String(lead._id), callId: String(call._id), inbound: true },
            },
            { assignedTo: who, emailFlag: 'emailOnCallSummary' },
          )
          .catch(() => undefined);
      }

      // The owner hears what the AI learned, with the recording a click away
      if (isAi && lead.assignedTo && call.direction !== 'inbound') {
        await this.notifications.notifyTenant(
          tenantId,
          {
            title: `${isHot ? 'Hot lead' : 'AI call done'}: ${name}`,
            body: `${analysis.outcome.replace(/_/g, ' ')} · interest ${analysis.interestLevel}/100. ${analysis.summary || ''}${actions.taskId ? ` Next: ${analysis.nextAction.title}.` : ''}`,
            type: 'call',
            data: { leadId: String(lead._id), callId: String(call._id), taskId: actions.taskId },
          },
          { assignedTo: lead.assignedTo, emailFlag: isHot ? 'emailOnHotLead' : 'emailOnCallSummary' },
        );
      }
    }

    await this.callModel.updateOne({ _id: call._id }, { $set: { actions } });

    const changes: any = {};
    if (before.status !== lead.status) changes.status = { from: before.status, to: lead.status };
    if (before.temperature !== lead.temperature) changes.temperature = { from: before.temperature, to: lead.temperature };
    if (before.assignedTo !== lead.assignedTo) changes.assignedTo = { from: before.assignedTo, to: lead.assignedTo };
    this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId, lead, changes, performedBy: opts.actorId });
    this.bus.emit<CallPayload>(PlatformEvents.CALL_ENDED, { tenantId, call: { ...call.toObject(), actions }, lead });
  }

  private dueFor(analysis: CallAnalysis, settings: CallingSettings): Date {
    if (analysis.callbackAt && analysis.callbackAt.getTime() > Date.now()) return analysis.callbackAt;
    const hot = analysis.interestLevel >= settings.hotThreshold;
    const hours = hot ? Math.min(analysis.nextAction.dueInHours, settings.hotFollowUpHours) : analysis.nextAction.dueInHours;
    return new Date(Date.now() + Math.max(0.25, hours) * 3_600_000);
  }

  private async bookAppointment(tenantId: string, lead: any, at: Date, analysis: CallAnalysis): Promise<string | undefined> {
    if (!lead.assignedTo) return undefined;
    try {
      const { id } = await this.upsertAppointmentForLead(tenantId, lead, at, 30, analysis.summary);
      return id;
    } catch (err: any) {
      this.logger.warn(`Appointment not created: ${err?.message}`);
      return undefined;
    }
  }

  /**
   * Book a meeting for a lead - or MOVE the one they already have (open or
   * missed) rather than stacking a second one. Throws on a calendar clash so
   * the agent can offer another slot. Google Calendar sync and the
   * confirmation e-mail happen inside AppointmentService.
   */
  private async upsertAppointmentForLead(
    tenantId: string,
    lead: any,
    at: Date,
    durationMinutes: number,
    description?: string,
  ): Promise<{ id: string; rescheduled: boolean }> {
    const end = new Date(at.getTime() + durationMinutes * 60_000);
    const existing: any = await this.appointments.openForLead(tenantId, String(lead._id));
    if (existing) {
      const moved: any = await this.appointments.reschedule(tenantId, String(existing._id), {
        startTime: at.toISOString(),
        endTime: end.toISOString(),
        reason: existing.status === 'no_show' ? 'New time agreed with the lead on an AI call after a missed meeting' : 'New time agreed with the lead on an AI call',
        title: `Meeting with ${this.leadName(lead)}`,
        ...(description ? { description } : {}),
      } as any);
      return { id: String(moved._id), rescheduled: true };
    }
    const appt: any = await this.appointments.create(tenantId, {
      title: `Meeting with ${this.leadName(lead)}`,
      description: description || 'Booked by the AI agent on a call',
      assignedTo: lead.assignedTo || '',
      startTime: at.toISOString(),
      endTime: end.toISOString(),
      leadId: String(lead._id),
      attendee: { name: this.leadName(lead), email: lead.email, phone: lead.phone },
      bookedBy: 'ai',
    } as any);
    return { id: String(appt?._id || ''), rescheduled: false };
  }

  // ─── No-show rescue ───────────────────────────────────────────────

  /**
   * The lead missed a meeting. Send a "we missed you" WhatsApp straight away
   * and put an AI call on the queue to fix a new time (the call uses
   * book_appointment, which moves the missed appointment instead of creating
   * another). Falls back to a task for the salesperson when the AI call is off.
   */
  private async onAppointmentNoShow({ tenantId, appointment, markedBy }: AppointmentPayload) {
    try {
      const appt = appointment?.toObject?.() ?? appointment;
      if (!appt?.leadId || !/^[a-f\d]{24}$/i.test(String(appt.leadId))) return;
      const settings = await this.getSettings(tenantId);
      const rescue = settings.appointmentReminders.noShowRescue;
      if (!settings.appointmentReminders.enabled || !rescue.enabled) return;
      const lead: any = await this.leadModel.findOne({ _id: appt.leadId, tenantId, deletedAt: null });
      if (!lead) return;
      const apptId = String(appt._id);
      const tz = settings.timezone;
      const at = new Date(appt.startTime);
      const dateOf = at.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeOf = at.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
      const company = settings.assistant.companyName || 'our team';
      let salesperson = settings.assistant.agentName;
      if (appt.assignedTo && /^[a-f\d]{24}$/i.test(String(appt.assignedTo))) {
        const u: any = await this.userModel.findById(appt.assignedTo).select('firstName lastName').lean();
        if (u) salesperson = `${u.firstName || ''} ${u.lastName || ''}`.trim() || salesperson;
      }

      // 1. WhatsApp: we missed you
      if (rescue.whatsapp && lead.phone) {
        const leadFirst = lead.firstName || this.leadName(lead);
        const body =
          `Hi ${leadFirst}, we missed you at our meeting scheduled for ${dateOf} at ${timeOf}. ` +
          `No problem at all - ${salesperson} from ${company} will call you shortly to fix a new time. You can also reply here with a time that suits you.`;
        const tpls = await this.notifications.whatsappTemplates(tenantId);
        const template = tpls.missed_meeting
          ? { sid: tpls.missed_meeting, variables: { 1: leadFirst, 2: dateOf, 3: timeOf, 4: salesperson, 5: company } }
          : undefined;
        const sent = await this.notifications.sendToLead(tenantId, 'whatsapp', lead, {
          title: 'WhatsApp',
          body,
          type: 'appointment',
          data: { leadId: String(lead._id), appointmentId: apptId, missedMeeting: true, ...(template ? { template } : {}) },
        });
        if (sent) {
          await this.appointments.recordRescue(apptId, { whatsappAt: new Date() });
          await this.activityModel.create({
            tenantId,
            leadId: String(lead._id),
            type: 'whatsapp_sent',
            description: `Missed-meeting WhatsApp sent: ${body.slice(0, 140)}`,
            newValue: { appointmentId: apptId },
          });
        }
      }

      // 2. AI call to fix a new time (or a task when the AI is not allowed to)
      if (rescue.aiCall && settings.enabled && lead.phone && !['won', 'lost'].includes(lead.status)) {
        const call: any = await this.queueAiCall(tenantId, lead, 'reschedule', {
          delaySeconds: rescue.callDelayMinutes * 60,
          settings,
        });
        await this.appointments.recordRescue(apptId, { callId: String(call._id), callQueuedAt: new Date() });
        this.kickQueue();
      } else {
        await this.tasks
          .create(
            tenantId,
            {
              leadId: String(lead._id),
              title: `Reschedule the missed meeting with ${this.leadName(lead)}`,
              description: `No-show for ${dateOf} ${timeOf}${markedBy === 'auto' ? ' (nobody marked the meeting done)' : ''}. Call and agree a new time.`,
              type: 'call',
              priority: 'high',
              dueAt: new Date(Date.now() + 30 * 60_000),
              assignedTo: lead.assignedTo,
              source: 'ai',
            },
            'ai',
          )
          .catch((err) => this.logger.warn(`No-show task not created: ${err?.message}`));
      }

      if (!['won', 'lost'].includes(lead.status)) {
        await this.leadModel.updateOne({ _id: lead._id }, { $set: { nextFollowUpAt: new Date(Date.now() + rescue.callDelayMinutes * 60_000), lastActivityAt: new Date() } });
      }
    } catch (err: any) {
      this.logger.warn(`No-show rescue failed for appointment ${appointment?._id}: ${err?.message}`);
    }
  }

  // ─── Human calls: Twilio bridge ───────────────────────────────────

  async clickToCall(tenantId: string, leadId: string, actor: Actor, fromPhone?: string) {
    const lead = await this.getLead(tenantId, leadId, actor);
    const to = this.normalisePhone(lead.phone);
    if (!to) throw new BadRequestException('Lead has no valid phone number');

    const user: any = await this.userModel.findById(actor.userId).select('phone firstName lastName').lean();
    const salesperson = this.normalisePhone(fromPhone || user?.phone);
    if (!salesperson) throw new BadRequestException('Add your phone number to your profile first (Settings), or pass one for this call.');

    const creds = await this.credentials.resolve(tenantId, 'twilio');
    if (!this.twilio.isConfigured(creds)) {
      throw new BadRequestException('Twilio is not configured. Add the account SID, auth token and a voice number under Settings > API Credentials.');
    }
    const settings = await this.getSettings(tenantId);

    const call = await this.callModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'human_outbound',
      provider: 'twilio',
      status: 'dialing',
      toNumber: to,
      fromNumber: creds.phoneNumber,
      userId: actor.userId,
      attempt: (lead.callAttempts || 0) + 1,
      reason: 'manual',
      scheduledAt: new Date(),
      startedAt: new Date(),
    });
    const id = String(call._id);
    const token = this.signCallToken(id);
    const base = `${this.publicApiUrl()}/api/v1/calling/webhooks/twilio`;

    try {
      const result = await this.twilio.startBridgedCall({
        creds,
        salespersonNumber: salesperson,
        voiceUrl: `${base}/voice?callId=${id}&token=${token}`,
        statusUrl: `${base}/status?callId=${id}&token=${token}`,
      });
      await this.callModel.updateOne({ _id: call._id }, { $set: { externalId: result.sid, status: 'ringing' } });
      await this.leadModel.updateOne({ _id: lead._id }, { $set: { lastCallAt: new Date() }, $inc: { callAttempts: 1 } });
      await this.activityModel.create({
        tenantId,
        leadId: String(lead._id),
        type: 'call_placed',
        description: `${user?.firstName || 'Salesperson'} called via LeadBells (${settings.recordHumanCalls ? 'recorded' : 'not recorded'})`,
        performedBy: actor.userId,
        newValue: { callId: id },
      });
      return { callId: id, status: 'ringing', message: 'Your phone will ring first; answer it to be connected to the lead.' };
    } catch (err: any) {
      await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'failed', errorMessage: err?.message } });
      throw new BadRequestException(err?.message || 'Could not start the call');
    }
  }

  /** TwiML for the salesperson leg: dial the lead, record. */
  async twilioVoiceTwiml(callId: string, token: string): Promise<string> {
    const call = await this.verifiedCall(callId, token);
    const lead: any = await this.leadModel.findById(call.leadId).lean();
    const settings = await this.getSettings(call.tenantId);
    const base = `${this.publicApiUrl()}/api/v1/calling/webhooks/twilio`;
    await this.callModel.updateOne({ _id: call._id }, { $set: { status: 'in_progress', answeredAt: new Date() } });
    return this.twilio.bridgeTwiml({
      leadName: lead ? this.leadName(lead) : 'the lead',
      leadNumber: call.toNumber,
      callerId: call.fromNumber,
      record: settings.recordHumanCalls,
      recordingUrl: `${base}/recording?callId=${callId}&token=${token}`,
      dialStatusUrl: `${base}/dial-status?callId=${callId}&token=${token}`,
    });
  }

  /** Twilio: the parent (salesperson) leg changed state. */
  async twilioStatus(callId: string, token: string, body: any) {
    const call = await this.verifiedCall(callId, token);
    const status = String(body?.CallStatus || '').toLowerCase();
    if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer' || status === 'canceled') {
      // Salesperson leg ended. If no recording/dial outcome arrived, close it as no answer on our side.
      const fresh = await this.callModel.findById(call._id);
      if (fresh && ['dialing', 'ringing'].includes(fresh.status)) {
        await this.callModel.updateOne(
          { _id: call._id },
          { $set: { status: status === 'completed' ? 'completed' : 'failed', endedAt: new Date(), endedReason: `salesperson-${status}`, durationSeconds: Number(body?.CallDuration) || 0 } },
        );
      } else if (fresh && fresh.status === 'in_progress' && !fresh.analysis) {
        await this.callModel.updateOne(
          { _id: call._id },
          { $set: { endedAt: new Date(), durationSeconds: Number(body?.CallDuration) || fresh.durationSeconds || 0 } },
        );
      }
    }
    return { ok: true };
  }

  /** Twilio: what happened to the lead leg (answered / busy / no answer). */
  async twilioDialStatus(callId: string, token: string, body: any): Promise<string> {
    const call = await this.verifiedCall(callId, token);
    const dial = String(body?.DialCallStatus || '').toLowerCase();
    const duration = Number(body?.DialCallDuration) || 0;
    const set: any = { childExternalId: body?.DialCallSid, endedAt: new Date(), durationSeconds: duration, endedReason: `lead-${dial}` };
    if (dial === 'completed') set.status = 'completed';
    else if (dial === 'busy') set.status = 'busy';
    else if (dial === 'no-answer') set.status = 'no_answer';
    else set.status = 'failed';
    await this.callModel.updateOne({ _id: call._id }, { $set: set });

    if (set.status !== 'completed') {
      const settings = await this.getSettings(call.tenantId);
      const fresh = await this.callModel.findById(call._id);
      const analysis = this.analysis.fromEndedReason(dial, settings.hotThreshold);
      await this.callModel.updateOne({ _id: call._id }, { $set: { outcome: analysis.outcome, analysis: this.analysisForStorage(analysis) } });
      await this.applyOutcome(fresh, analysis, settings, { byHuman: true, actorId: call.userId });
    } else if (!(await this.getSettings(call.tenantId)).recordHumanCalls) {
      // No recording coming: ask the salesperson for notes
      await this.notifications.create(call.tenantId, {
        userId: call.userId,
        title: 'Log your call',
        body: 'Add a quick note on how the call went so the AI can plan the follow-up.',
        type: 'call',
        channel: 'in_app',
        data: { leadId: call.leadId, callId: String(call._id), needsNotes: true },
      });
    }
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
  }

  /** Twilio: recording ready -> download -> transcribe -> analyse. */
  async twilioRecording(callId: string, token: string, body: any) {
    const call = await this.verifiedCall(callId, token);
    const recordingUrl = body?.RecordingUrl;
    if (!recordingUrl) return { ok: true };
    const duration = Number(body?.RecordingDuration) || call.durationSeconds || 0;
    await this.callModel.updateOne(
      { _id: call._id },
      { $set: { recordingUrl, durationSeconds: duration, status: 'completed' } },
    );
    // Do the heavy part after answering Twilio
    setImmediate(() => void this.transcribeAndAnalyse(String(call._id)).catch((err) => this.logger.warn(`Transcription failed for ${call._id}: ${err?.message}`)));
    return { ok: true };
  }

  private async transcribeAndAnalyse(callId: string) {
    const call = await this.callModel.findById(callId);
    if (!call || !call.recordingUrl) return;
    const tenantId = call.tenantId;
    const settings = await this.getSettings(tenantId);
    const lead: any = await this.leadModel.findById(call.leadId).lean();

    let transcript = call.transcript;
    if (!transcript) {
      try {
        const creds = await this.credentials.resolve(tenantId, 'twilio');
        const audio = await this.twilio.downloadRecording(creds, call.recordingUrl);
        const provider = await this.aiFactory.getProviderForTenant(tenantId);
        if (!provider.transcribeAudio) throw new Error('The configured AI provider cannot transcribe audio (OpenAI is required for Whisper)');
        const lang = settings.assistant.language === 'en' ? 'en' : undefined;
        transcript = await provider.transcribeAudio(audio, `call-${callId}.mp3`, lang);
        await this.callModel.updateOne({ _id: call._id }, { $set: { transcript } });
      } catch (err: any) {
        await this.callModel.updateOne({ _id: call._id }, { $set: { errorMessage: `Transcription: ${err?.message}` } });
        await this.notifications.create(tenantId, {
          userId: call.userId,
          title: 'Log your call',
          body: `The recording could not be transcribed (${err?.message}). Add a note so the AI can plan the follow-up.`,
          type: 'call',
          channel: 'in_app',
          data: { leadId: call.leadId, callId: String(call._id), needsNotes: true },
        });
        return;
      }
    }

    const analysis = await this.analysis.fromTranscript(tenantId, { transcript, lead, byHuman: true }, settings.hotThreshold);
    await this.callModel.updateOne(
      { _id: call._id },
      { $set: { outcome: analysis.outcome, summary: analysis.summary, analysis: this.analysisForStorage(analysis) } },
    );
    const fresh = await this.callModel.findById(call._id);
    await this.applyOutcome(fresh, analysis, settings, { byHuman: true, actorId: call.userId });

    // The salesperson sees the AI's read of their own call
    if (call.userId) {
      await this.notifications.create(tenantId, {
        userId: call.userId,
        title: `Call analysed: ${lead ? this.leadName(lead) : 'lead'}`,
        body: `${analysis.outcome.replace(/_/g, ' ')} · interest ${analysis.interestLevel}/100. Next: ${analysis.nextAction.title}.`,
        type: 'call',
        channel: 'in_app',
        data: { leadId: call.leadId, callId: String(call._id) },
      });
    }
  }

  // ─── Human calls: manual log ──────────────────────────────────────

  async logManualCall(tenantId: string, leadId: string, dto: LogManualCallDto, actor: Actor) {
    const lead = await this.getLead(tenantId, leadId, actor);
    const settings = await this.getSettings(tenantId);

    const call = await this.callModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'manual',
      provider: 'manual',
      status: NO_CONTACT.has(dto.outcome) ? (dto.outcome === 'busy' ? 'busy' : dto.outcome === 'voicemail' ? 'voicemail' : 'no_answer') : 'completed',
      toNumber: lead.phone,
      userId: actor.userId,
      attempt: (lead.callAttempts || 0) + 1,
      reason: 'manual',
      scheduledAt: new Date(),
      startedAt: new Date(Date.now() - (dto.durationSeconds || 0) * 1000),
      endedAt: new Date(),
      durationSeconds: dto.durationSeconds || 0,
      notes: dto.notes,
      transcript: dto.transcript,
      outcome: dto.outcome,
    });
    await this.leadModel.updateOne({ _id: lead._id }, { $set: { lastCallAt: new Date() }, $inc: { callAttempts: 1 } });

    let analysis: CallAnalysis;
    if (dto.analyse !== false && (dto.notes || dto.transcript) && !NO_CONTACT.has(dto.outcome)) {
      analysis = await this.analysis.fromTranscript(
        tenantId,
        { transcript: dto.transcript, notes: dto.notes, lead: lead.toObject(), byHuman: true, outcomeHint: dto.outcome },
        settings.hotThreshold,
      );
      analysis.outcome = dto.outcome; // the human's word wins
    } else {
      analysis = this.analysis.fromEndedReason(dto.outcome, settings.hotThreshold);
      analysis.outcome = dto.outcome;
      if (dto.notes) analysis.summary = dto.notes.slice(0, 300);
      if (!NO_CONTACT.has(dto.outcome)) {
        analysis.suggestedStatus =
          dto.outcome === 'meeting_booked' ? 'meeting'
          : dto.outcome === 'interested' ? 'interested'
          : dto.outcome === 'callback' ? 'follow_up'
          : dto.outcome === 'not_interested' ? 'lost'
          : 'contacted';
        analysis.interestLevel = dto.outcome === 'interested' ? 65 : dto.outcome === 'meeting_booked' ? 80 : dto.outcome === 'callback' ? 45 : 10;
        analysis.temperature = analysis.interestLevel >= settings.hotThreshold ? 'hot' : analysis.interestLevel >= 40 ? 'warm' : 'cold';
      }
    }
    if (dto.callbackAt) {
      analysis.callbackAt = new Date(dto.callbackAt);
      if (analysis.outcome === 'callback' || analysis.nextAction.type === 'none') analysis.nextAction = { type: 'call', title: `Call back ${this.leadName(lead)}`, dueInHours: 1 };
    }
    // Explicit won/lost from a human is final
    if (dto.outcome === 'won' || dto.outcome === 'lost' || dto.outcome === 'not_interested') {
      const to = dto.outcome === 'won' ? 'won' : 'lost';
      if (lead.status !== to) {
        await this.activityModel.create({ tenantId, leadId: String(lead._id), type: 'status_changed', description: `Status changed from ${lead.status} to ${to} (call logged)`, oldValue: lead.status, newValue: to, performedBy: actor.userId });
        await this.leadModel.updateOne({ _id: lead._id }, { $set: { status: to, ...(to === 'won' ? { convertedAt: new Date() } : { lostReason: dto.notes?.slice(0, 200) || 'Not interested' }) } });
        this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId, lead: await this.leadModel.findById(lead._id), changes: { status: { from: lead.status, to } }, performedBy: actor.userId });
      }
      analysis.suggestedStatus = '';
      analysis.nextAction = { type: 'none', title: 'No action needed', dueInHours: 0 };
    }

    await this.callModel.updateOne({ _id: call._id }, { $set: { summary: analysis.summary, analysis: this.analysisForStorage(analysis) } });
    const fresh = await this.callModel.findById(call._id);
    await this.applyOutcome(fresh, analysis, settings, { byHuman: true, actorId: actor.userId });
    return this.callModel.findById(call._id).lean();
  }

  /** Salesperson adds notes to a bridged call whose recording failed. */
  async addNotes(tenantId: string, callId: string, notes: string, outcome: string | undefined, actor: Actor) {
    const call = await this.callModel.findOne({ _id: callId, tenantId });
    if (!call) throw new NotFoundException('Call not found');
    if (actor.role === 'SALESPERSON' && String(call.userId || '') !== actor.userId) throw new ForbiddenException('Not your call');
    call.notes = notes;
    await call.save();
    if (call.analysis && call.analysis.source !== 'provider' && !outcome) return call;

    const settings = await this.getSettings(tenantId);
    const lead: any = await this.leadModel.findById(call.leadId).lean();
    const analysis = await this.analysis.fromTranscript(tenantId, { transcript: call.transcript, notes, lead, byHuman: true, outcomeHint: outcome }, settings.hotThreshold);
    if (outcome) analysis.outcome = outcome;
    await this.callModel.updateOne({ _id: call._id }, { $set: { outcome: analysis.outcome, summary: analysis.summary, analysis: this.analysisForStorage(analysis) } });
    const fresh = await this.callModel.findById(call._id);
    await this.applyOutcome(fresh, analysis, settings, { byHuman: true, actorId: actor.userId });
    return this.callModel.findById(call._id).lean();
  }

  // ─── Cold leads: re-engagement ────────────────────────────────────

  /** Hourly. Finds worked leads that went quiet and reaches out again. */
  async reengageColdLeads(): Promise<number> {
    const tenants: any[] = await this.tenantModel
      .find({ deletedAt: null, status: { $in: ['active', 'trial'] }, 'callingSettings.enabled': true })
      .select('_id callingSettings settings name')
      .lean();
    let touched = 0;

    for (const tenant of tenants) {
      const settings = await this.getSettings(String(tenant._id));
      if (!settings.reengageEnabled) continue;
      const tenantId = String(tenant._id);
      const cutoff = new Date(Date.now() - settings.coldAfterDays * 86_400_000);

      const cold: any[] = await this.leadModel
        .find({
          tenantId,
          deletedAt: null,
          status: { $in: ['contacted', 'interested', 'follow_up'] },
          lastActivityAt: { $lt: cutoff },
          reengageAttempts: { $lt: settings.maxReengageAttempts },
          $or: [{ lastReengagedAt: null }, { lastReengagedAt: { $lt: cutoff } }],
          phone: { $exists: true, $ne: '' },
        })
        .sort({ lastActivityAt: 1 })
        .limit(25)
        .lean();

      for (const lead of cold) {
        try {
          // Something is already in motion for this lead
          const busy =
            (await this.taskModel.exists({ tenantId, leadId: String(lead._id), status: 'pending' })) ||
            (await this.callModel.exists({ tenantId, leadId: String(lead._id), status: { $in: ['queued', 'scheduled', 'dialing', 'ringing', 'in_progress'] } }));
          if (busy) continue;

          const actions: string[] = [];
          if (settings.reengageChannel === 'whatsapp' || settings.reengageChannel === 'both') {
            const ok = await this.sendWhatsApp(tenantId, lead, settings.reengageWhatsappTemplate, settings, { reengage: true });
            if (ok) actions.push('whatsapp');
          }
          if (settings.reengageChannel === 'ai_call' || settings.reengageChannel === 'both') {
            const call = await this.queueAiCall(tenantId, lead, 'reengage', { settings, delaySeconds: settings.reengageChannel === 'both' ? 3 * 3600 : 0 });
            actions.push(`call:${call._id}`);
          }
          await this.leadModel.updateOne(
            { _id: lead._id },
            { $set: { lastReengagedAt: new Date(), lastActivityAt: new Date() }, $inc: { reengageAttempts: 1 } },
          );
          await this.activityModel.create({
            tenantId,
            leadId: String(lead._id),
            type: 'reengaged',
            description: `Cold for ${settings.coldAfterDays}+ days - AI re-engaged (${actions.join(', ') || 'no channel available'})`,
          });
          touched++;
        } catch (err: any) {
          this.logger.warn(`Re-engage failed for ${lead._id}: ${err?.message}`);
        }
      }
    }
    return touched;
  }

  // ─── Reads ────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: CallQueryDto, actor: Actor) {
    const filter: any = { leadId: { $ne: 'test' } };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    if (query.status) filter.status = query.status;
    if (query.outcome) filter.outcome = query.outcome;
    if (query.type) filter.type = query.type;
    if (query.leadId) filter.leadId = query.leadId;
    if (query.userId) filter.userId = query.userId;

    if (actor.role === 'SALESPERSON') {
      const owned = await this.leadModel.find({ tenantId, assignedTo: actor.userId, deletedAt: null }).distinct('_id');
      filter.$or = [{ userId: actor.userId }, { leadId: { $in: owned.map(String) } }];
    }
    if (query.search) {
      const leads = await this.leadModel
        .find({ ...(filter.tenantId ? { tenantId: filter.tenantId } : {}), $or: [
          { firstName: { $regex: query.search, $options: 'i' } },
          { lastName: { $regex: query.search, $options: 'i' } },
          { phone: { $regex: query.search.replace(/[^\d+]/g, ''), $options: 'i' } },
          { company: { $regex: query.search, $options: 'i' } },
        ] })
        .select('_id')
        .limit(200)
        .lean();
      filter.leadId = { $in: leads.map((l: any) => String(l._id)) };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await Promise.all([
      this.callModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-raw -transcriptSegments').lean(),
      this.callModel.countDocuments(filter),
    ]);
    const leadIds = [...new Set(data.map((c: any) => c.leadId))];
    const leads = leadIds.length
      ? await this.leadModel.find({ _id: { $in: leadIds } }).select('firstName lastName phone company status temperature assignedTo').lean()
      : [];
    const leadMap = new Map(leads.map((l: any) => [String(l._id), l]));
    return { data: data.map((c: any) => ({ ...c, lead: leadMap.get(c.leadId) || null })), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, callId: string, actor: Actor) {
    const filter: any = { _id: callId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const call: any = await this.callModel.findOne(filter).select('-raw').lean();
    if (!call) throw new NotFoundException('Call not found');
    const lead: any = call.leadId !== 'test' ? await this.leadModel.findById(call.leadId).lean() : null;
    if (actor.role === 'SALESPERSON' && String(call.userId || '') !== actor.userId && String(lead?.assignedTo || '') !== actor.userId) {
      throw new ForbiddenException('Not your call');
    }
    return { ...call, lead };
  }

  async findForLead(tenantId: string, leadId: string) {
    const filter: any = { leadId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    return this.callModel.find(filter).sort({ createdAt: -1 }).limit(50).select('-raw').lean();
  }

  /**
   * Re-fetches a finished call from Vapi and re-runs the analysis - for calls
   * that were recorded wrongly (a lost webhook, a bug) so the lead is not left
   * with the wrong stage or a missing follow-up.
   */
  async reprocess(tenantId: string, callId: string, actor: Actor) {
    const call = await this.callModel.findOne({ _id: callId, tenantId });
    if (!call) throw new NotFoundException('Call not found');
    if (call.provider !== 'vapi' || !call.externalId) throw new BadRequestException('Only AI calls can be re-processed');
    if (actor.role === 'SALESPERSON') throw new ForbiddenException('Admins only');
    const creds = await this.vapiCredsFor(tenantId);
    const remote = await this.vapi.fetchCall(call.externalId, creds.apiKey);
    if (!remote || remote.status !== 'ended') throw new BadRequestException('The call has not ended yet on the provider');
    // Undo what the earlier (wrong) processing scheduled, so the re-run does not double up
    await this.taskModel.updateMany(
      { tenantId, callId: String(call._id), status: 'pending' },
      { $set: { status: 'cancelled', outcomeNote: 'Superseded: call re-processed' } },
    );
    await this.callModel.updateOne({ _id: call._id }, { $unset: { analysis: 1, outcome: 1 }, $set: { actions: {} } });
    const fresh = await this.callModel.findById(call._id);
    const event = this.vapi.parseWebhook({ message: { ...remote, call: { id: call.externalId }, type: 'end-of-call-report' } });
    await this.finishCall(fresh, event);
    return this.callModel.findById(call._id).select('-raw').lean();
  }

  async cancelQueued(tenantId: string, callId: string, actor: Actor) {
    const call = await this.callModel.findOne({ _id: callId, tenantId });
    if (!call) throw new NotFoundException('Call not found');
    if (!['queued', 'scheduled', 'ringing', 'dialing'].includes(call.status)) throw new BadRequestException('Call is no longer pending');
    if (call.externalId && call.provider === 'vapi') {
      const creds = await this.vapiCredsFor(tenantId);
      if (creds.apiKey) await this.vapi.endCall(call.externalId, creds.apiKey);
    }
    call.status = 'cancelled';
    call.errorMessage = `Cancelled by user`;
    await call.save();
    await this.leadModel.updateOne({ _id: call.leadId }, { $set: { aiCallStatus: 'skipped' } });
    this.kickQueue();
    return call;
  }

  async stats(tenantId: string, actor: Actor) {
    const base: any = { leadId: { $ne: 'test' } };
    if (tenantId && tenantId !== 'all') base.tenantId = tenantId;
    if (actor.role === 'SALESPERSON') {
      const owned = await this.leadModel.find({ tenantId, assignedTo: actor.userId, deletedAt: null }).distinct('_id');
      base.$or = [{ userId: actor.userId }, { leadId: { $in: owned.map(String) } }];
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [today, week, pending, byOutcome, statusMix] = await Promise.all([
      this.callModel.countDocuments({ ...base, createdAt: { $gte: startOfDay } }),
      this.callModel.countDocuments({ ...base, createdAt: { $gte: weekAgo } }),
      this.callModel.countDocuments({ ...base, status: { $in: ['queued', 'scheduled', 'dialing', 'ringing', 'in_progress'] } }),
      this.callModel.aggregate([{ $match: { ...base, createdAt: { $gte: weekAgo }, outcome: { $exists: true } } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      this.callModel.aggregate([{ $match: { ...base, createdAt: { $gte: weekAgo } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const outcomes = Object.fromEntries(byOutcome.map((o: any) => [o._id, o.count]));
    const statuses = Object.fromEntries(statusMix.map((o: any) => [o._id, o.count]));
    const finished = (statuses.completed || 0) + (statuses.no_answer || 0) + (statuses.busy || 0) + (statuses.voicemail || 0) + (statuses.failed || 0);
    const answered = statuses.completed || 0;
    const interested = (outcomes.interested || 0) + (outcomes.meeting_booked || 0) + (outcomes.callback || 0);
    return {
      today,
      week,
      pending,
      answerRate: finished ? Math.round((answered / finished) * 100) : 0,
      interestRate: answered ? Math.round((interested / answered) * 100) : 0,
      outcomes,
      statuses,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async alreadyMessaged(tenantId: string, lead: any, attempt: number): Promise<boolean> {
    // One WhatsApp per unanswered attempt is plenty
    const recent = await this.activityModel.exists({
      tenantId,
      leadId: String(lead._id),
      type: 'whatsapp_sent',
      'newValue.attempt': attempt,
    });
    return !!recent;
  }

  private async sendWhatsApp(tenantId: string, lead: any, template: string, settings: CallingSettings, meta: Record<string, any>): Promise<boolean> {
    if (!lead.phone) return false;
    const leadName = lead.firstName || this.leadName(lead);
    const agentName = settings.assistant.agentName;
    const companyName = settings.assistant.companyName || 'our team';
    const body = renderTemplate(template, { leadName, agentName, companyName });

    // Outside the 24h window WhatsApp only delivers approved templates
    const tpls = await this.notifications.whatsappTemplates(tenantId);
    const sid = meta.reengage ? tpls.reengage : tpls.missed_call;
    const variables = meta.reengage
      ? { 1: leadName, 2: agentName, 3: companyName, 4: this.leadTopic(lead) }
      : { 1: leadName, 2: agentName, 3: companyName };

    const sent = await this.notifications.sendToLead(tenantId, 'whatsapp', lead, {
      title: 'WhatsApp',
      body,
      type: 'follow_up',
      data: { ...meta, leadId: String(lead._id), ...(sid ? { template: { sid, variables } } : {}) },
    });
    if (!sent) return false;
    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'whatsapp_sent',
      description: `WhatsApp sent${meta.reengage ? ' (re-engagement)' : ' (no answer on call)'}: ${body.slice(0, 120)}`,
      newValue: meta,
    });
    await this.leadModel.updateOne({ _id: lead._id }, { $set: { lastContactedAt: new Date(), lastActivityAt: new Date() } });
    return true;
  }

  /**
   * E-mail twin of the post-call WhatsApp: the details the agent promised on
   * the call, the meeting (date, time, who, link) or the callback time, so the
   * customer has it in their inbox as well. The calendar invite itself is sent
   * separately by AppointmentService when the meeting is created.
   */
  private async sendPostCallEmail(
    tenantId: string,
    lead: any,
    call: any,
    analysis: CallAnalysis,
    settings: CallingSettings & { timezone: string },
    actions: Record<string, any>,
  ): Promise<{ sent: boolean; kind: string } | undefined> {
    try {
      const tz = settings.timezone;
      const dateOf = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeOf = (d: Date) => d.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
      const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const company = settings.assistant.companyName || 'our team';
      const agent = settings.assistant.agentName;
      const leadFirst = lead.firstName || this.leadName(lead);

      let salespersonName = company;
      let salespersonPhone = '';
      let salespersonEmail = '';
      if (lead.assignedTo) {
        const owner: any = await this.userModel.findById(lead.assignedTo).select('firstName lastName phone email').lean();
        if (owner) {
          salespersonName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || salespersonName;
          salespersonPhone = owner.phone || '';
          salespersonEmail = owner.email || '';
        }
      }
      if (!salespersonPhone) salespersonPhone = settings.transfer.destinations[0]?.number || settings.transfer.number || '';

      const meetingAt: Date | undefined = actions.bookedInCall ? new Date(actions.bookedInCall) : analysis.meetingAt;
      const callbackAt: Date | undefined = actions.callbackInCall ? new Date(actions.callbackInCall) : analysis.outcome === 'callback' ? analysis.callbackAt : undefined;
      let meetingLink = '';
      if (actions.appointmentId && /^[a-f\d]{24}$/i.test(String(actions.appointmentId))) {
        const appt: any = await this.appointments.findById(tenantId, String(actions.appointmentId)).catch(() => null);
        meetingLink = appt?.meetingLink || appt?.conferenceLink || '';
      }

      const kind = meetingAt && (actions.appointmentId || actions.bookedInCall || analysis.outcome === 'meeting_booked') ? 'appointment' : callbackAt ? 'callback' : 'details';
      const title =
        kind === 'appointment'
          ? `Your meeting with ${company} is confirmed - ${dateOf(meetingAt!)}`
          : kind === 'callback'
            ? `We will call you back on ${dateOf(callbackAt!)} at ${timeOf(callbackAt!)}`
            : `Details from your call with ${company}`;

      const sections: string[] = [`Hi ${esc(leadFirst)},`, `Thank you for your time on the call today. This is ${esc(agent)} from ${esc(company)}.`];
      if (analysis.whatsappDetails) {
        sections.push(`<strong>As discussed on the call:</strong><br/>${esc(analysis.whatsappDetails).replace(/\n/g, '<br/>')}`);
      }
      if (kind === 'appointment' && meetingAt) {
        sections.push(
          `<strong>Your appointment</strong><br/>Date: ${esc(dateOf(meetingAt))}<br/>Time: ${esc(timeOf(meetingAt))}<br/>With: ${esc(salespersonName)}${salespersonPhone ? `<br/>Contact: ${esc(salespersonPhone)}` : ''}${salespersonEmail ? `<br/>E-mail: ${esc(salespersonEmail)}` : ''}${meetingLink ? `<br/>Join: <a href="${esc(meetingLink)}">${esc(meetingLink)}</a>` : ''}`,
        );
      } else if (kind === 'callback' && callbackAt) {
        sections.push(`<strong>Callback</strong><br/>We will call you on ${esc(dateOf(callbackAt))} at ${esc(timeOf(callbackAt))}.`);
      }
      if (!analysis.whatsappDetails && kind === 'details') {
        const next = this.leadFacingNextStep(analysis);
        if (next) sections.push(esc(next));
      }
      if (analysis.requirement && kind !== 'details') sections.push(`<em>What we noted:</em> ${esc(analysis.requirement)}`);
      sections.push(`Reply to this e-mail or message us on WhatsApp if anything comes up.<br/>- ${esc(agent)}, ${esc(company)}`);

      const sent = await this.notifications.sendToLead(tenantId, 'email', lead, {
        title,
        body: sections.join('<br/><br/>'),
        type: 'follow_up',
        data: { leadId: String(lead._id), callId: String(call._id), postCall: kind },
      });
      if (!sent) return { sent: false, kind };
      await this.activityModel.create({
        tenantId,
        leadId: String(lead._id),
        type: 'email_sent',
        description: `E-mail after call (${kind}): ${title}`,
        newValue: { callId: String(call._id), kind },
      });
      return { sent: true, kind };
    } catch (err: any) {
      this.logger.warn(`Post-call e-mail failed for lead ${lead._id}: ${err?.message}`);
      return { sent: false, kind: 'error' };
    }
  }

  /**
   * After an answered AI call: a thank-you on WhatsApp. When a meeting was
   * booked it carries the date, time and who they will meet (name + phone);
   * when a callback was agreed, the callback time.
   */
  private async sendPostCallWhatsApp(
    tenantId: string,
    lead: any,
    call: any,
    analysis: CallAnalysis,
    settings: CallingSettings & { timezone: string },
    actions: Record<string, any>,
  ): Promise<{ sent: boolean; kind: string } | undefined> {
    try {
      const tz = settings.timezone;
      const dateOf = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeOf = (d: Date) => d.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' });

      // Who they will be dealing with
      let salespersonName = settings.assistant.companyName || 'our team';
      let salespersonPhone = '';
      if (lead.assignedTo) {
        const owner: any = await this.userModel.findById(lead.assignedTo).select('firstName lastName phone').lean();
        if (owner) {
          salespersonName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || salespersonName;
          salespersonPhone = owner.phone || '';
        }
      }
      if (!salespersonPhone) {
        salespersonPhone = settings.transfer.destinations[0]?.number || settings.transfer.number || '';
      }

      const meetingAt: Date | undefined = actions.bookedInCall
        ? new Date(actions.bookedInCall)
        : analysis.meetingAt || (actions.appointmentId && analysis.callbackAt ? analysis.callbackAt : undefined);
      const callbackAt: Date | undefined = actions.callbackInCall ? new Date(actions.callbackInCall) : analysis.outcome === 'callback' ? analysis.callbackAt : undefined;

      let kind = 'thank_you';
      let textTemplate = settings.postCallWhatsapp.thankYouTemplate;
      if (meetingAt && (actions.appointmentId || actions.bookedInCall || analysis.outcome === 'meeting_booked')) {
        kind = 'appointment';
        textTemplate = settings.postCallWhatsapp.appointmentTemplate;
      } else if (callbackAt) {
        kind = 'callback';
        textTemplate = settings.postCallWhatsapp.callbackTemplate;
      }

      const body = renderTemplate(textTemplate, {
        leadName: lead.firstName || this.leadName(lead),
        agentName: settings.assistant.agentName,
        companyName: settings.assistant.companyName || 'our team',
        summary: this.leadFacingNextStep(analysis),
        meetingDate: meetingAt ? dateOf(meetingAt) : '',
        meetingTime: meetingAt ? timeOf(meetingAt) : '',
        callbackDate: callbackAt ? dateOf(callbackAt) : '',
        callbackTime: callbackAt ? timeOf(callbackAt) : '',
        salespersonName,
        salespersonPhone: salespersonPhone || '-',
      })
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Template variant of the same message - WhatsApp rejects free text
      // unless the lead wrote to us in the last 24 hours
      const tpls = await this.notifications.whatsappTemplates(tenantId);
      const leadFirst = lead.firstName || this.leadName(lead);
      const company = settings.assistant.companyName || 'our team';
      let template: { sid: string; variables: Record<string, string> } | undefined;
      if (kind === 'appointment' && tpls.appointment && meetingAt) {
        template = { sid: tpls.appointment, variables: { 1: leadFirst, 2: dateOf(meetingAt), 3: timeOf(meetingAt), 4: salespersonName, 5: salespersonPhone || company, 6: company } };
      } else if (kind === 'callback' && tpls.callback && callbackAt) {
        template = { sid: tpls.callback, variables: { 1: leadFirst, 2: dateOf(callbackAt), 3: timeOf(callbackAt), 4: settings.assistant.agentName, 5: company } };
      } else if (tpls.thank_you) {
        const next = this.leadFacingNextStep(analysis) || 'We will be in touch shortly.';
        template = { sid: tpls.thank_you, variables: { 1: leadFirst, 2: settings.assistant.agentName, 3: company, 4: next } };
      }

      const sent = await this.notifications.sendToLead(tenantId, 'whatsapp', lead, {
        title: 'WhatsApp',
        body,
        type: 'follow_up',
        data: { leadId: String(lead._id), callId: String(call._id), postCall: kind, ...(template ? { template } : {}) },
      });
      if (!sent) return { sent: false, kind };
      await this.activityModel.create({
        tenantId,
        leadId: String(lead._id),
        type: 'whatsapp_sent',
        description: `WhatsApp after call (${kind.replace('_', ' ')}): ${body.slice(0, 160)}`,
        newValue: { callId: String(call._id), kind },
      });
      return { sent: true, kind };
    } catch (err: any) {
      this.logger.warn(`Post-call WhatsApp failed for lead ${lead._id}: ${err?.message}`);
      return { sent: false, kind: 'error' };
    }
  }

  /**
   * The next step as the LEAD should hear it. Task titles are written for our
   * team ("Send a WhatsApp follow-up"), which reads oddly in a message to the
   * customer - so translate the action type into a promise we will keep.
   */
  private leadFacingNextStep(analysis: CallAnalysis): string {
    // What the agent promised on the call goes out verbatim - "I will send you
    // the details on WhatsApp" must actually deliver those details
    if (analysis.whatsappDetails) {
      return `As discussed on the call: ${analysis.whatsappDetails}`;
    }
    const t = analysis.nextAction?.type;
    switch (t) {
      case 'whatsapp':
        return 'Our team will send you the details here on WhatsApp shortly.';
      case 'email':
        return 'You will receive the details by email shortly.';
      case 'call':
        return analysis.callbackAt ? '' : 'Our team will call you shortly to take this forward.';
      case 'meeting':
        return 'We look forward to the meeting.';
      default:
        return 'We will be in touch shortly.';
    }
  }

  /** Short phrase for "are you still looking for help with ___" - from the lead's own words. */
  private leadTopic(lead: any): string {
    const t =
      lead?.customFields?.requirement ||
      lead?.aiCallInsights?.requirement ||
      lead?.aiInsights?.requirement ||
      lead?.customFields?.description ||
      '';
    const s = String(t).trim();
    return s ? s.slice(0, 60).replace(/[.!?]+$/, '') : 'your enquiry';
  }

  private async notifyAdmins(tenantId: string, title: string, body: string, lead: any) {
    await this.notifications.notifyTenant(
      tenantId,
      { title, body, type: 'call', data: { leadId: String(lead._id) } },
      { emailFlag: 'emailOnHotLead' },
    );
  }

  private async getLead(tenantId: string, leadId: string, actor: Actor) {
    const filter: any = { _id: leadId, deletedAt: null };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const lead = await this.leadModel.findOne(filter);
    if (!lead) throw new NotFoundException('Lead not found');
    if (actor.role === 'SALESPERSON' && String(lead.assignedTo || '') !== actor.userId) {
      throw new ForbiddenException('This lead is not assigned to you');
    }
    return lead;
  }

  private async verifiedCall(callId: string, token: string) {
    if (!/^[a-f\d]{24}$/i.test(callId || '') || !token || !this.safeEqual(token, this.signCallToken(callId))) {
      throw new ForbiddenException('Invalid call token');
    }
    const call = await this.callModel.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private signCallToken(callId: string): string {
    const key = this.configService.get<string>('encryption.key') || 'dev';
    return createHmac('sha256', key).update(`call:${callId}`).digest('hex').slice(0, 32);
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  private publicApiUrl(): string {
    return (this.configService.get<string>('app.publicApiUrl') || this.configService.get<string>('app.apiUrl') || 'http://localhost:4000').replace(/\/+$/, '');
  }

  private vapiWebhookUrl(): string {
    return `${this.publicApiUrl()}/api/v1/calling/webhooks/vapi`;
  }

  /** E.164-ish: digits with a leading +. Indian 10-digit numbers get +91. */
  normalisePhone(raw?: string): string | null {
    if (!raw) return null;
    let s = String(raw).replace(/[^\d+]/g, '');
    if (!s) return null;
    if (s.startsWith('00')) s = `+${s.slice(2)}`;
    if (!s.startsWith('+')) {
      const digits = s.replace(/\D/g, '');
      if (digits.length === 10) s = `+91${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) s = `+91${digits.slice(1)}`;
      else if (digits.length === 12 && digits.startsWith('91')) s = `+${digits}`;
      else s = `+${digits}`;
    }
    const digits = s.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  /** A lead we only know by their number - created by an incoming call or a WhatsApp message. */
  private isPlaceholderName(lead: any): boolean {
    const first = String(lead?.firstName || '').trim().toLowerCase();
    return ['caller', 'whatsapp', 'lead', 'new lead', 'unknown', 'visitor', ''].includes(first);
  }

  private leadName(lead: any): string {
    return `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || lead?.company || lead?.email || lead?.phone || 'Lead';
  }

  private plain(doc: any) {
    return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  }

  private analysisForStorage(a: CallAnalysis) {
    return {
      interestLevel: a.interestLevel,
      sentiment: a.sentiment,
      requirement: a.requirement,
      budget: a.budget,
      timeline: a.timeline,
      objections: a.objections,
      keyPoints: a.keyPoints,
      callbackAt: a.callbackAt,
      nextAction: { type: a.nextAction.type, title: a.nextAction.title, dueInHours: a.nextAction.dueInHours, reason: a.nextAction.reason },
      suggestedStatus: a.suggestedStatus,
      temperature: a.temperature,
      meeting: a.meetingAt ? { at: a.meetingAt } : undefined,
      language: a.language,
      source: a.source,
      whatsappDetails: a.whatsappDetails,
    };
  }

  /** Vapi reports carry the full assistant config; keep only what helps debugging. */
  private trimRaw(raw: any) {
    if (!raw || typeof raw !== 'object') return raw;
    const { call, artifact, assistant, ...rest } = raw;
    return { ...rest, callId: call?.id, endedReason: raw.endedReason, hasRecording: !!artifact?.recordingUrl };
  }
}
