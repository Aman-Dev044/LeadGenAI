import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateConversationDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { AppointmentService } from '../appointment/appointment.service';
import { SupportTicketService } from '../support-ticket/support-ticket.service';
import { NotificationService } from '../notification/notification.service';
import { AIToolDefinition, ChatCompletionOptions, ChatCompletionResult, ChatMessage, IAIProvider } from '../../common/interfaces';
import { ChatGateway } from '../../gateways/chat.gateway';
import { AssignmentService } from '../lead/assignment.service';
import { LeadService } from '../lead/lead.service';
import { EventBusService, PlatformEvents } from '../../common/events';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('Agent') private readonly agentModel: Model<any>,
    @InjectModel('Handoff') private readonly handoffModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    private readonly aiFactory: AIProviderFactory,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly appointmentService: AppointmentService,
    private readonly supportTicketService: SupportTicketService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly leadService: LeadService,
    private readonly bus: EventBusService,
    private readonly chatGateway: ChatGateway,
    private readonly assignment: AssignmentService,
  ) {}

  async create(tenantId: string, dto: CreateConversationDto) {
    const conversation = await this.conversationModel.create({
      tenantId,
      agentId: dto.agentId,
      visitorId: dto.visitorId,
      visitorInfo: dto.visitorInfo,
      status: 'active',
      mode: 'bot',
    });
    this.bus.emit(PlatformEvents.CONVERSATION_CREATED, { tenantId, conversation });
    return conversation;
  }

  async findAll(tenantId: string, paginationDto: PaginationDto, filters?: any) {
    const query: any = { tenantId, deletedAt: null };

    if (filters?.status) query.status = filters.status;
    if (filters?.agentId) query.agentId = filters.agentId;
    if (filters?.leadId) query.leadId = filters.leadId;

    return paginate(this.conversationModel, query, paginationDto);
  }

  /** Lightweight lookup used by public widget endpoints (never throws). */
  async findPublic(tenantId: string, conversationId: string) {
    try {
      return await this.conversationModel.findOne({ _id: conversationId, tenantId }).lean();
    } catch {
      return null;
    }
  }

  /** Link a captured lead to the conversation and record a system event so the AI knows the contact info */
  async attachCapturedLead(tenantId: string, conversationId: string, lead: any) {
    if (!conversationId || !lead) return;
    try {
      const updateData: any = {
        leadId: lead._id,
      };
      if (lead.firstName) updateData['visitorInfo.firstName'] = lead.firstName;
      if (lead.lastName) updateData['visitorInfo.lastName'] = lead.lastName;
      if (lead.email) updateData['visitorInfo.email'] = lead.email;
      if (lead.phone) updateData['visitorInfo.phone'] = lead.phone;
      if (lead.company) updateData['visitorInfo.company'] = lead.company;

      await this.conversationModel.updateOne(
        { _id: conversationId, tenantId },
        { $set: updateData },
      );

      const contactSummary = [
        lead.firstName ? `Name: ${lead.firstName} ${lead.lastName || ''}`.trim() : null,
        lead.email ? `Email: ${lead.email}` : null,
        lead.phone ? `Phone: ${lead.phone}` : null,
        lead.company ? `Company: ${lead.company}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      const sysMsg = await this.messageModel.create({
        tenantId,
        conversationId,
        sender: 'system',
        content: `[Visitor submitted contact details: ${contactSummary}]`,
        type: 'lead_captured',
      });

      this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: sysMsg });
    } catch (err: any) {
      this.logger.warn(`Failed to attach captured lead to conversation ${conversationId}: ${err.message}`);
    }
  }

  async findById(tenantId: string, conversationId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      tenantId,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async getMessages(tenantId: string, conversationId: string, limit = 50, before?: string) {
    const query: any = { conversationId, tenantId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    const safeLimit = Math.min(Math.max(limit || 50, 1), 200);

    // Always return the most recent page, in chronological order
    const page = await this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();
    return page.reverse();
  }

  async sendVisitorMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    visitorId: string,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      tenantId,
      status: { $in: ['active', 'handed_off'] },
    });

    if (!conversation) {
      throw new NotFoundException('Active conversation not found');
    }

    // Save visitor message
    const visitorMsg = await this.messageModel.create({
      tenantId,
      conversationId,
      sender: 'visitor',
      senderId: visitorId,
      content,
      type: 'text',
    });

    // Increment message count atomically (safe under concurrent requests)
    await this.conversationModel.updateOne({ _id: conversationId }, { $inc: { messageCount: 1 } });
    this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: visitorMsg });

    // Generate AI response if in bot mode
    if (conversation.mode === 'bot') {
      try {
        const botResponse = await this.generateBotResponse(
          tenantId,
          conversationId,
          conversation.agentId,
          content,
        );
        return { visitorMessage: visitorMsg, botMessage: botResponse };
      } catch (err) {
        this.logger.error(`Bot response failed for conversation ${conversationId}: ${err.message}`, err.stack);
        // Save an error message so the user knows something went wrong
        const errorMsg = await this.messageModel.create({
          tenantId,
          conversationId,
          sender: 'bot',
          content: 'Sorry, I\'m having trouble responding right now. Please try again in a moment.',
          type: 'text',
        });
        this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: errorMsg });
        return { visitorMessage: visitorMsg, botMessage: errorMsg };
      }
    }

    return { visitorMessage: visitorMsg };
  }

  async sendAgentMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    userId: string,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      tenantId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const msg = await this.messageModel.create({
      tenantId,
      conversationId,
      sender: 'agent',
      senderId: userId,
      content,
      type: 'text',
    });

    await this.conversationModel.updateOne({ _id: conversationId }, { $inc: { messageCount: 1 } });
    this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: msg });

    return msg;
  }

  async endConversation(tenantId: string, conversationId: string) {
    const conversation = await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, tenantId },
      { status: 'ended', endedAt: new Date() },
      { new: true },
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Generate AI summary asynchronously
    this.generateSummary(tenantId, conversationId, conversation.agentId).catch((err) => {
      this.logger.error(`Summary generation failed: ${err.message}`);
    });

    this.bus.emit(PlatformEvents.CONVERSATION_ENDED, { tenantId, conversation });
    return conversation;
  }

  async handoff(tenantId: string, conversationId: string, assignTo?: string) {
    if (!assignTo) {
      assignTo = (await this.routeHandoff(tenantId, conversationId)) || undefined;
    }
    const conversation = await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, tenantId },
      {
        status: 'handed_off',
        mode: 'human',
        ...(assignTo ? { assignedUserId: assignTo } : {}),
      },
      { new: true },
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Create a Handoff record so it shows in the Handoffs page
    const handoff = await this.handoffModel.create({
      tenantId,
      conversationId,
      agentId: conversation.agentId,
      assignedTo: assignTo,
      reason: 'Manual handoff from conversation',
      status: 'pending',
      context: {
        conversationSummary: conversation.summary,
        sentiment: conversation.sentiment,
      },
    });

    this.bus.emit(PlatformEvents.HANDOFF_CREATED, { tenantId, handoff, conversation });
    this.summarizeForHandoff(tenantId, conversationId, handoff._id.toString());
    return conversation;
  }

  /**
   * Who should take a handoff: the lead's owner when the conversation already has a lead,
   * otherwise the tenant's assignment rules (preferring agents online right now).
   */
  private async routeHandoff(tenantId: string, conversationId: string): Promise<string | null> {
    const conversation: any = await this.conversationModel.findOne({ _id: conversationId, tenantId }).lean();
    if (!conversation) return null;
    let lead: any = null;
    if (conversation.leadId) {
      lead = await this.leadModel.findOne({ _id: conversation.leadId, tenantId }).lean();
      if (lead?.assignedTo) return lead.assignedTo;
    }
    return this.assignment.pickAssignee(tenantId, lead || { ...conversation.visitorInfo, source: 'widget' }, {
      forHandoff: true,
      preferOnline: this.chatGateway.getOnlineAgentIds(tenantId),
    });
  }

  /** Generate a summary in the background so the human agent gets context on the handoff. */
  private summarizeForHandoff(tenantId: string, conversationId: string, handoffId: string) {
    this.maybeSummarize(tenantId, conversationId, 'handoff')
      .then(async (summary) => {
        if (summary) {
          await this.handoffModel.updateOne({ _id: handoffId }, { $set: { 'context.conversationSummary': summary } });
        }
      })
      .catch((err) => this.logger.warn(`Handoff summary failed: ${err.message}`));
  }

  /**
   * Summarize if the conversation has enough content and was not summarized in the last minute.
   * Safe to call often (lead capture, handoff, end); returns the summary text or null.
   */
  async maybeSummarize(tenantId: string, conversationId: string, reason = 'auto'): Promise<string | null> {
    try {
      const conversation: any = await this.conversationModel
        .findOne({ _id: conversationId, tenantId })
        .select('agentId messageCount summaryUpdatedAt')
        .lean();
      if (!conversation || (conversation.messageCount || 0) < 2) return null;
      const last = conversation.summaryUpdatedAt ? new Date(conversation.summaryUpdatedAt).getTime() : 0;
      if (reason !== 'manual' && Date.now() - last < 60_000) return null;
      return (await this.generateSummary(tenantId, conversationId, conversation.agentId)) || null;
    } catch (err: any) {
      this.logger.warn(`Auto summary (${reason}) failed for ${conversationId}: ${err.message}`);
      return null;
    }
  }

  // ─── AI Conversation Summary ──────────────────────────────────────
  async generateSummary(tenantId: string, conversationId: string, agentId: string) {
    const agent = await this.agentModel.findById(agentId);
    if (!agent) return;

    const messages = await this.messageModel
      .find({ conversationId, tenantId })
      .sort({ createdAt: 1 })
      .lean();

    if (messages.length < 2) return;

    const transcript = messages
      .filter((m: any) => m.type !== 'tool_result')
      .map((m: any) => {
        const role = m.sender === 'visitor' ? 'Visitor' : m.sender === 'bot' ? 'Bot' : 'Agent';
        return `${role}: ${m.content}`;
      })
      .join('\n');

    const provider = this.aiFactory.getProvider(agent.aiConfig?.provider);

    const result = await provider.chatCompletion(
      [
        {
          role: 'system',
          content: `You summarize sales chats for a busy sales team. Given a transcript between a website visitor and an AI/human agent, respond with ONLY a JSON object (no markdown) of this shape:
{
  "summary": "3-5 sentence factual paragraph: what the visitor wants, details collected (name, email, phone, company, requirements), outcome (lead captured, appointment booked, ticket, handoff) and anything the sales team must know",
  "requirement": "one line: what they need, or null",
  "budget": "budget if mentioned, else null",
  "timeline": "timeline/urgency if mentioned, else null",
  "intent": "high | medium | low",
  "nextStep": "one line recommended next action for the salesperson",
  "keyPoints": ["up to 5 short bullet facts"],
  "objections": ["concerns or blockers the visitor raised, if any"]
}
Never invent facts. Use null for unknown fields.`,
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${transcript}`,
        },
      ],
      {
        model: agent.aiConfig?.model,
        temperature: 0.2,
        maxTokens: 600,
      },
    );

    const parsed = this.parseSummary(result.content);
    if (!parsed.summary) return;

    const now = new Date();
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { summary: parsed.summary, summaryUpdatedAt: now } },
    );

    // Mirror onto the linked lead so the sales team sees it on the lead card
    const conversation: any = await this.conversationModel.findById(conversationId).select('leadId').lean();
    if (conversation?.leadId) {
      await this.leadModel.updateOne(
        { _id: conversation.leadId, tenantId },
        {
          $set: {
            aiSummary: parsed.summary,
            aiInsights: {
              requirement: parsed.requirement || undefined,
              budget: parsed.budget || undefined,
              timeline: parsed.timeline || undefined,
              intent: parsed.intent || undefined,
              nextStep: parsed.nextStep || undefined,
              keyPoints: parsed.keyPoints || [],
              objections: parsed.objections || [],
            },
            aiSummaryUpdatedAt: now,
          },
        },
      );
    }

    this.logger.log(`Summary generated for conversation ${conversationId}`);
    return parsed.summary;
  }

  /** Accepts the JSON the model should return, but degrades gracefully to plain text. */
  private parseSummary(raw: string): {
    summary?: string; requirement?: string; budget?: string; timeline?: string;
    intent?: 'high' | 'medium' | 'low'; nextStep?: string; keyPoints?: string[]; objections?: string[];
  } {
    const text = (raw || '').trim();
    if (!text) return {};
    const jsonText = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      const obj = JSON.parse(jsonText);
      const str = (v: any) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : undefined);
      const arr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 8) : []);
      const intentRaw = str(obj.intent)?.toLowerCase();
      return {
        summary: str(obj.summary),
        requirement: str(obj.requirement),
        budget: str(obj.budget),
        timeline: str(obj.timeline),
        intent: intentRaw === 'high' || intentRaw === 'medium' || intentRaw === 'low' ? intentRaw : undefined,
        nextStep: str(obj.nextStep),
        keyPoints: arr(obj.keyPoints),
        objections: arr(obj.objections),
      };
    } catch {
      return { summary: text };
    }
  }

  // ─── Tool Definitions ─────────────────────────────────────────────
  private getToolDefinitions(enabledTools: string[]): AIToolDefinition[] {
    const allTools: Record<string, AIToolDefinition> = {
      appointment_booking: {
        name: 'schedule_appointment',
        description: 'Schedule a new appointment/meeting with the visitor. Use this when the visitor wants to book a meeting, demo, or consultation. You MUST collect the date, time, and visitor name before calling this.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Title of the appointment (e.g. "Product Demo", "Sales Consultation")' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            time: { type: 'string', description: 'Start time in HH:MM format (24h)' },
            durationMinutes: { type: 'number', description: 'Duration in minutes (default 30)' },
            attendeeName: { type: 'string', description: 'Name of the visitor/attendee' },
            attendeeEmail: { type: 'string', description: 'Email of the visitor (if provided)' },
            attendeePhone: { type: 'string', description: 'Phone of the visitor (if provided)' },
            description: { type: 'string', description: 'Notes or description for the appointment' },
          },
          required: ['title', 'date', 'time', 'attendeeName'],
        },
      },
      lead_capture: {
        name: 'capture_lead',
        description: 'Save visitor contact information as a lead. Use this ONCE when the visitor has provided their name and contact details. Do NOT call this tool again if you already captured the info in this conversation.',
        parameters: {
          type: 'object',
          properties: {
            firstName: { type: 'string', description: 'First name of the visitor' },
            lastName: { type: 'string', description: 'Last name of the visitor' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            company: { type: 'string', description: 'Company name (if mentioned)' },
            notes: { type: 'string', description: 'Any relevant notes about the visitor needs' },
          },
          required: ['firstName'],
        },
      },
      ticket_creation: {
        name: 'create_support_ticket',
        description: 'Create a support ticket for the visitor. Use this when the visitor reports a problem, complaint, or needs support help. Collect the issue subject and description before creating.',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Brief subject/title of the support issue' },
            description: { type: 'string', description: 'Detailed description of the problem or request' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level based on urgency' },
            contactName: { type: 'string', description: 'Name of the person reporting (if known)' },
            contactEmail: { type: 'string', description: 'Email of the person reporting (if known)' },
          },
          required: ['subject', 'description'],
        },
      },
      // ─── New Tools ──────────────────────────────────────────────
      lead_status_update: {
        name: 'update_lead_status',
        description: 'Update the status or temperature of an existing lead. Use this when the conversation reveals the lead is qualified, interested (hot), or should be marked as contacted. Only use if a lead has already been captured for this conversation.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'], description: 'New lead status' },
            temperature: { type: 'string', enum: ['hot', 'warm', 'cold'], description: 'Lead temperature based on interest level' },
            notes: { type: 'string', description: 'Reason for the status change' },
          },
          required: ['status'],
        },
      },
      notify_salesperson: {
        name: 'notify_salesperson',
        description: 'Send a notification to the sales team about this conversation. Use this when a high-value lead is detected, an urgent request comes in, or the visitor explicitly asks to be contacted by a salesperson.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Notification title (e.g. "Hot Lead Alert", "Urgent Request")' },
            message: { type: 'string', description: 'Notification message with key details' },
            priority: { type: 'string', enum: ['normal', 'high', 'urgent'], description: 'Notification priority' },
          },
          required: ['title', 'message'],
        },
      },
      handoff_to_human: {
        name: 'handoff_to_human',
        description: 'Transfer this conversation to a human agent. Use this when: (1) the visitor explicitly asks to speak to a person, (2) you cannot adequately answer their question, or (3) the query requires human judgment (pricing negotiations, complaints, complex issues).',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Why the handoff is needed (for the human agent context)' },
          },
          required: ['reason'],
        },
      },
      knowledge_search: {
        name: 'search_knowledge_base',
        description: 'Search the business knowledge base for information. Use this when the visitor asks a specific question about products, services, pricing, policies, or anything business-related that you need to look up.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query to find relevant information' },
          },
          required: ['query'],
        },
      },
    };

    // Only return tools that are enabled for this agent
    return enabledTools
      .filter((toolId) => allTools[toolId])
      .map((toolId) => allTools[toolId]);
  }

  // ─── Tool Execution ───────────────────────────────────────────────
  private async executeToolCall(
    tenantId: string,
    conversationId: string,
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    switch (toolName) {
      case 'schedule_appointment': {
        try {
          const startTime = new Date(`${args.date}T${args.time}:00`);
          const duration = args.durationMinutes || 30;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          if (isNaN(startTime.getTime())) {
            return JSON.stringify({ success: false, error: 'Invalid date or time format' });
          }

          const assignedTo = tenantId;

          const appointment = await this.appointmentService.bookFromWidget(tenantId, {
            assignedTo,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            attendee: {
              name: args.attendeeName,
              email: args.attendeeEmail,
              phone: args.attendeePhone,
            },
            conversationId,
          });

          return JSON.stringify({
            success: true,
            appointmentId: appointment._id,
            title: appointment.title,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'scheduled',
          });
        } catch (err) {
          this.logger.error(`Failed to create appointment: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }
      case 'capture_lead': {
        try {
          const conversation = await this.conversationModel.findById(conversationId).lean();
          const info: any = (conversation as any)?.visitorInfo || {};

          await this.conversationModel.updateOne(
            { _id: conversationId },
            {
              $set: {
                'visitorInfo.firstName': args.firstName,
                'visitorInfo.lastName': args.lastName,
                'visitorInfo.email': args.email,
                'visitorInfo.phone': args.phone,
                'visitorInfo.company': args.company,
                'visitorInfo.notes': args.notes,
              },
            },
          );

          // Create (or update) the real Lead record so it shows up in the dashboard,
          // gets scored, triggers notifications/webhooks/follow-ups and links the conversation.
          const lead = await this.leadService.captureFromWidget(tenantId, {
            firstName: args.firstName,
            lastName: args.lastName,
            email: args.email,
            phone: args.phone,
            company: args.company,
            customFields: args.notes ? { notes: args.notes } : undefined,
            conversationId,
            source: 'widget',
            metadata: {
              url: info.url,
              referrer: info.referrer,
              userAgent: info.userAgent,
              ip: info.ip,
              utmSource: info.utmSource,
              utmMedium: info.utmMedium,
              utmCampaign: info.utmCampaign,
            },
          });

          await this.conversationModel.updateOne(
            { _id: conversationId },
            {
              $set: {
                leadId: lead._id,
                'visitorInfo.firstName': args.firstName,
                'visitorInfo.lastName': args.lastName,
                'visitorInfo.email': args.email,
                'visitorInfo.phone': args.phone,
                'visitorInfo.company': args.company,
                'visitorInfo.notes': args.notes,
              },
            },
          );

          this.maybeSummarize(tenantId, conversationId, 'lead_captured').catch(() => undefined);

          return JSON.stringify({
            success: true,
            leadId: lead._id,
            message: `Lead captured: ${args.firstName} ${args.lastName || ''}`.trim(),
            data: { firstName: args.firstName, lastName: args.lastName, email: args.email, phone: args.phone },
          });
        } catch (err) {
          this.logger.error(`Failed to capture lead: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }
      case 'create_support_ticket': {
        try {
          const ticket = await this.supportTicketService.create(tenantId, {
            subject: args.subject,
            description: args.description,
            priority: args.priority || 'medium',
            conversationId,
          });
          return JSON.stringify({
            success: true,
            ticketId: ticket._id,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
          });
        } catch (err) {
          this.logger.error(`Failed to create support ticket: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      // ─── New Tool Handlers ──────────────────────────────────────
      case 'update_lead_status': {
        try {
          const conversation = await this.conversationModel.findById(conversationId);
          if (!conversation?.leadId) {
            return JSON.stringify({ success: false, error: 'No lead is linked to this conversation yet. Capture lead info first.' });
          }

          const updateData: any = {};
          if (args.status) updateData.status = args.status;
          if (args.temperature) updateData.temperature = args.temperature;
          updateData.lastActivityAt = new Date();

          const before = await this.leadModel.findOne({ _id: conversation.leadId, tenantId }).lean();
          const lead = await this.leadModel.findOneAndUpdate(
            { _id: conversation.leadId, tenantId },
            { $set: updateData },
            { new: true },
          );

          if (!lead) {
            return JSON.stringify({ success: false, error: 'Lead not found' });
          }

          // Log activity
          await this.activityModel.create({
            tenantId,
            leadId: lead._id.toString(),
            type: 'status_changed',
            description: args.notes || `AI updated status to ${args.status || lead.status}, temperature to ${args.temperature || lead.temperature}`,
            newValue: args.status || lead.status,
          });

          const changes: any = {};
          if (args.status && (before as any)?.status !== args.status) changes.status = { from: (before as any)?.status, to: args.status };
          if (args.temperature && (before as any)?.temperature !== args.temperature) changes.temperature = { from: (before as any)?.temperature, to: args.temperature };
          this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId, lead, changes });

          return JSON.stringify({
            success: true,
            leadId: lead._id,
            status: lead.status,
            temperature: lead.temperature,
          });
        } catch (err) {
          this.logger.error(`Failed to update lead status: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      case 'notify_salesperson': {
        try {
          // Find admins and sales managers for this tenant
          const conversation = await this.conversationModel.findById(conversationId);
          const assignedTo = conversation?.assignedUserId;

          const sent = await this.notificationService.notifyTenant(
            tenantId,
            {
              title: args.title || 'Sales attention needed',
              body: args.message,
              type: 'new_lead',
              data: { conversationId, leadId: conversation?.leadId, priority: args.priority || 'normal' },
            },
            { assignedTo, emailFlag: args.priority === 'urgent' ? 'emailOnHotLead' : undefined },
          );

          return JSON.stringify({
            success: true,
            message: assignedTo
              ? 'Notification sent to assigned salesperson'
              : `Notification sent to ${sent.length} team member(s)`,
          });
        } catch (err) {
          this.logger.error(`Failed to notify salesperson: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      case 'handoff_to_human': {
        try {
          const agentDoc = await this.agentModel.findById(agentId).select('handoffConfig').lean();
          const assignTo =
            (agentDoc as any)?.handoffConfig?.assignTo || (await this.routeHandoff(tenantId, conversationId)) || undefined;

          const conversation = await this.conversationModel.findOneAndUpdate(
            { _id: conversationId, tenantId },
            { status: 'handed_off', mode: 'human', ...(assignTo ? { assignedUserId: assignTo } : {}) },
            { new: true },
          );

          if (!conversation) {
            return JSON.stringify({ success: false, error: 'Conversation not found' });
          }

          const handoff = await this.handoffModel.create({
            tenantId,
            conversationId,
            agentId: conversation.agentId,
            assignedTo: conversation.assignedUserId,
            reason: args.reason,
            status: 'pending',
            context: {
              conversationSummary: conversation.summary,
              sentiment: conversation.sentiment,
            },
          });

          this.bus.emit(PlatformEvents.HANDOFF_CREATED, { tenantId, handoff, conversation });
          this.summarizeForHandoff(tenantId, conversationId, handoff._id.toString());

          return JSON.stringify({
            success: true,
            message: 'Conversation has been transferred to a human agent. They will join shortly.',
          });
        } catch (err) {
          this.logger.error(`Failed to handoff: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      case 'search_knowledge_base': {
        try {
          const agent = await this.agentModel.findById(agentId);
          if (!agent?.knowledgeSourceIds?.length) {
            return JSON.stringify({ success: false, error: 'No knowledge base configured for this agent' });
          }

          const chunks = await this.knowledgeBaseService.searchKnowledge(
            tenantId,
            args.query,
            agent.knowledgeSourceIds,
            5,
          );

          if (chunks.length === 0) {
            return JSON.stringify({ success: true, results: [], message: 'No relevant information found' });
          }

          const results = chunks.map((c: any) => ({
            content: c.content,
            source: c.metadata?.sourceName || 'Knowledge Base',
          }));

          return JSON.stringify({ success: true, results });
        } catch (err) {
          this.logger.error(`Failed to search knowledge base: ${err.message}`);
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }

  // ─── Bot Response Generation ──────────────────────────────────────
  private async generateBotResponse(
    tenantId: string,
    conversationId: string,
    agentId: string,
    userMessage: string,
  ) {
    const agent = await this.agentModel.findById(agentId);
    if (!agent) return null;

    // Fetch the most recent conversation history (chronological order)
    const history = (
      await this.messageModel
        .find({ conversationId, type: { $ne: 'tool_result' } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    ).reverse();

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    if (agent.knowledgeSourceIds?.length > 0) {
      try {
        const chunks = await this.knowledgeBaseService.searchKnowledge(
          tenantId,
          userMessage,
          agent.knowledgeSourceIds,
          3,
        );
        if (chunks.length > 0) {
          knowledgeContext = '\n\nRelevant knowledge:\n' +
            chunks.map((c: any) => c.content).join('\n---\n');
        }
      } catch (err) {
        this.logger.warn(`KB search failed: ${err.message}`);
      }
    }

    // Get enabled tools
    const enabledTools = agent.enabledTools || [];
    const tools = this.getToolDefinitions(enabledTools);

    // Tool instructions for the system prompt
    let toolInstructions = '';
    if (tools.length > 0) {
      const toolDescriptions = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
      toolInstructions = `\n\nYou have the following tools:\n${toolDescriptions}\n\nIMPORTANT RULES:
- Do NOT ask for information the visitor already provided in this conversation. Read the chat history carefully.
- Call capture_lead ONCE after getting visitor details. Do NOT call it again or ask for the same info twice.
- For appointments, collect date, time, and name, then book immediately.
- For support tickets, understand the issue clearly, then create the ticket.
- Use update_lead_status when the conversation reveals the lead's qualification level or interest.
- Use handoff_to_human when the visitor asks to speak to a real person or you cannot help them.
- Use search_knowledge_base when you need to look up specific business information.
- Use notify_salesperson for hot leads or urgent requests.
- After a tool succeeds, confirm the action and move the conversation forward.`;
    }

    // Look up conversation and linked lead to see if contact details were already captured
    const conversation: any = await this.conversationModel.findOne({ _id: conversationId, tenantId }).lean();
    let lead: any = null;
    if (conversation?.leadId) {
      lead = await this.leadModel.findOne({ _id: conversation.leadId, tenantId }).lean();
    }

    const knownDetails: string[] = [];
    const vInfo = conversation?.visitorInfo || {};
    const firstName = lead?.firstName || vInfo.firstName;
    const lastName = lead?.lastName || vInfo.lastName;
    const email = lead?.email || vInfo.email;
    const phone = lead?.phone || vInfo.phone;
    const company = lead?.company || vInfo.company;

    if (firstName) knownDetails.push(`- Name: ${firstName} ${lastName || ''}`.trim());
    if (email) knownDetails.push(`- Email: ${email}`);
    if (phone) knownDetails.push(`- Phone: ${phone}`);
    if (company) knownDetails.push(`- Company: ${company}`);

    let visitorContextPrompt = '';
    if (knownDetails.length > 0) {
      visitorContextPrompt = `\n\nALREADY CAPTURED VISITOR INFORMATION (DO NOT ASK FOR THESE AGAIN):\n${knownDetails.join('\n')}\nCRITICAL INSTRUCTION: The visitor has ALREADY provided these contact details (via the contact form/chat). You MUST NOT ask for their name, email, phone number, or company again. Acknowledge what they need and directly assist them with their requirements/questions.`;
    }

    // Build messages
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: agent.systemPrompt + visitorContextPrompt + knowledgeContext + toolInstructions,
      },
      ...history.map((m: any) => ({
        role: (m.sender === 'visitor' ? 'user' : m.sender === 'system' ? 'system' : 'assistant') as 'user' | 'system' | 'assistant',
        content: m.content,
      })),
    ];

    // Get AI provider
    const provider = this.aiFactory.getProvider(agent.aiConfig?.provider);
    const aiOptions: ChatCompletionOptions = {
      model: agent.aiConfig?.model,
      temperature: agent.aiConfig?.temperature,
      maxTokens: agent.aiConfig?.maxTokens,
    };
    const streamId = `${conversationId}:${Date.now()}`;

    let result = await this.completeWithStreaming(provider, conversationId, streamId, messages, {
      ...aiOptions,
      ...(tools.length > 0 ? { tools } : {}),
    });
    let finalContent = result.content || '';

    // Handle tool calls - execute them and get a final response
    if (result.finishReason === 'tool_calls' && result.toolCalls?.length) {
      // Execute each tool call
      const toolResults: string[] = [];
      for (const tc of result.toolCalls) {
        this.logger.log(`Executing tool: ${tc.name} with args: ${JSON.stringify(tc.arguments)}`);
        const toolResult = await this.executeToolCall(tenantId, conversationId, agentId, tc.name, tc.arguments);
        toolResults.push(`Tool "${tc.name}" result: ${toolResult}`);

        // Save tool call as a message for audit trail
        await this.messageModel.create({
          tenantId,
          conversationId,
          sender: 'bot',
          content: `[Tool: ${tc.name}]`,
          type: 'tool_result',
          toolCall: {
            toolName: tc.name,
            toolInput: tc.arguments,
            toolOutput: JSON.parse(toolResult),
          },
        });
      }

      // Send tool results back to AI for a natural response
      messages.push({
        role: 'assistant' as const,
        content: result.content || `[Called tools: ${result.toolCalls.map((t) => t.name).join(', ')}]`,
      });
      messages.push({
        role: 'user' as const,
        content: `Tool execution results:\n${toolResults.join('\n')}\n\nPlease provide a friendly response to the visitor confirming what was done. Include relevant details in your response.`,
      });

      if (finalContent) {
        // Keep any text the model produced before calling tools, visually separated
        this.chatGateway.emitBotStream(conversationId, streamId, '\n\n');
        finalContent += '\n\n';
      }
      result = await this.completeWithStreaming(provider, conversationId, streamId, messages, aiOptions);
      finalContent += result.content || '';
    }

    // Save bot message
    const botMsg = await this.messageModel.create({
      tenantId,
      conversationId,
      sender: 'bot',
      content: finalContent,
      type: 'text',
      tokenUsage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            model: agent.aiConfig?.model,
          }
        : undefined,
    });

    // Update conversation message count
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $inc: { messageCount: 1 } },
    );

    this.chatGateway.emitBotStreamEnd(conversationId, streamId, botMsg.toObject());
    this.bus.emit(PlatformEvents.MESSAGE_CREATED, { tenantId, conversationId, message: botMsg });
    return botMsg;
  }

  /**
   * Runs a completion, pushing text deltas to the conversation room as they arrive.
   * Falls back to a regular (non-streaming) call if the provider cannot stream.
   */
  private async completeWithStreaming(
    provider: IAIProvider,
    conversationId: string,
    streamId: string,
    messages: ChatMessage[],
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    let streamedAny = false;
    try {
      for await (const chunk of provider.chatCompletionStream(messages, options)) {
        if (chunk.type === 'text') {
          streamedAny = true;
          this.chatGateway.emitBotStream(conversationId, streamId, chunk.delta);
        } else if (chunk.type === 'done') {
          return chunk.result;
        }
      }
      throw new Error('Stream ended without a result');
    } catch (err: any) {
      if (streamedAny) throw err; // partial output already shown; do not silently duplicate
      this.logger.warn(`Streaming unavailable (${err.message}); falling back to non-streaming completion`);
      const result = await provider.chatCompletion(messages, options);
      if (result.content) this.chatGateway.emitBotStream(conversationId, streamId, result.content);
      return result;
    }
  }
}
