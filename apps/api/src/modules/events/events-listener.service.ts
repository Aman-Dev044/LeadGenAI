import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EventBusService,
  PlatformEvents,
  LeadCreatedPayload,
  LeadUpdatedPayload,
  LeadScoredPayload,
  LeadDeletedPayload,
  ConversationPayload,
  MessageCreatedPayload,
  HandoffPayload,
  AppointmentPayload,
} from '../../common/events';
import { WebhookDispatcherService } from '../webhook/webhook-dispatcher.service';
import { NotificationService } from '../notification/notification.service';
import { LeadScoreService } from '../lead-score/lead-score.service';
import { ChatGateway } from '../../gateways/chat.gateway';

/**
 * Small concurrency limiter so bursts (bulk imports, traffic spikes) do not
 * fan out into thousands of parallel DB/HTTP operations.
 */
class WorkQueue {
  private running = 0;
  private readonly pending: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.running++;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            const next = this.pending.shift();
            if (next) next();
          });
      };
      if (this.running < this.concurrency) start();
      else this.pending.push(start);
    });
  }

  get size() {
    return this.running + this.pending.length;
  }
}

/** Sources that are bulk by nature: no per-lead human notifications. */
const BULK_SOURCES = new Set(['import', 'csv', 'bulk']);

@Injectable()
export class EventsListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventsListenerService.name);
  private readonly queue = new WorkQueue(5);

  constructor(
    private readonly bus: EventBusService,
    private readonly webhooks: WebhookDispatcherService,
    private readonly notifications: NotificationService,
    private readonly leadScore: LeadScoreService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.bus.on<LeadCreatedPayload>(PlatformEvents.LEAD_CREATED, (p) => this.onLeadCreated(p));
    this.bus.on<LeadUpdatedPayload>(PlatformEvents.LEAD_UPDATED, (p) => this.onLeadUpdated(p));
    this.bus.on<LeadScoredPayload>(PlatformEvents.LEAD_SCORED, (p) => this.onLeadScored(p));
    this.bus.on<LeadDeletedPayload>(PlatformEvents.LEAD_DELETED, (p) => this.onLeadDeleted(p));

    this.bus.on<ConversationPayload>(PlatformEvents.CONVERSATION_CREATED, (p) => this.onConversationCreated(p));
    this.bus.on<ConversationPayload>(PlatformEvents.CONVERSATION_ENDED, (p) => this.onConversationEnded(p));
    this.bus.on<MessageCreatedPayload>(PlatformEvents.MESSAGE_CREATED, (p) => this.onMessageCreated(p));

    this.bus.on<HandoffPayload>(PlatformEvents.HANDOFF_CREATED, (p) => this.onHandoffCreated(p));
    this.bus.on<HandoffPayload>(PlatformEvents.HANDOFF_ACCEPTED, (p) => this.onHandoffStatus(p, 'handoff.accepted'));
    this.bus.on<HandoffPayload>(PlatformEvents.HANDOFF_REJECTED, (p) => this.onHandoffStatus(p, 'handoff.rejected'));
    this.bus.on<HandoffPayload>(PlatformEvents.HANDOFF_COMPLETED, (p) => this.onHandoffStatus(p, 'handoff.completed'));

    this.bus.on<AppointmentPayload>(PlatformEvents.APPOINTMENT_CREATED, (p) => this.onAppointmentCreated(p));
    this.bus.on<AppointmentPayload>(PlatformEvents.APPOINTMENT_UPDATED, (p) => this.onAppointmentUpdated(p));

    this.logger.log('Platform event listeners registered');
  }

  // ─── Leads ────────────────────────────────────────────────────────

  private async onLeadCreated({ tenantId, lead }: LeadCreatedPayload) {
    const plain = this.toPlain(lead);
    const isBulk = BULK_SOURCES.has(String(plain.source || '').toLowerCase());

    // 1. Auto-score (emits LEAD_SCORED when the score changes)
    await this.safe('auto-score', () =>
      this.queue.run(() => this.leadScore.scoreLead(tenantId, String(plain._id))),
    );

    // 2. Realtime + human notifications (skipped for bulk imports)
    if (!isBulk) {
      await this.safe('socket new_lead', async () => this.chatGateway.emitNewLead(tenantId, plain));
      await this.safe('notify new lead', () =>
        this.notifications.notifyTenant(
          tenantId,
          {
            title: 'New Lead Captured',
            body: this.leadSummary(plain),
            type: 'new_lead',
            data: { leadId: String(plain._id) },
          },
          { assignedTo: plain.assignedTo, emailFlag: 'emailOnNewLead' },
        ),
      );
    }

    // 3. Outbound webhooks
    await this.safe('webhook lead.created', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'lead.created', plain)),
    );
  }

  private async onLeadUpdated({ tenantId, lead, changes }: LeadUpdatedPayload) {
    const plain = this.toPlain(lead);

    await this.safe('webhook lead.updated', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'lead.updated', { ...plain, changes })),
    );

    // New assignee gets an in-app heads-up
    const newAssignee = changes.assignedTo?.to;
    if (newAssignee && newAssignee !== changes.assignedTo?.from) {
      await this.safe('notify assignment', () =>
        this.notifications.create(tenantId, {
          userId: newAssignee,
          title: 'Lead Assigned to You',
          body: this.leadSummary(plain),
          type: 'assignment',
          channel: 'in_app',
          data: { leadId: String(plain._id) },
        }),
      );
    }

    // Status changes can affect the score (e.g. field_match rules on status)
    if (changes.status) {
      await this.safe('re-score', () =>
        this.queue.run(() => this.leadScore.scoreLead(tenantId, String(plain._id))),
      );
    }
  }

  private async onLeadScored({ tenantId, lead, oldScore, oldTemperature }: LeadScoredPayload) {
    const plain = this.toPlain(lead);

    await this.safe('webhook lead.scored', () =>
      this.queue.run(() =>
        this.webhooks.dispatch(tenantId, 'lead.scored', {
          ...plain,
          previousScore: oldScore,
          previousTemperature: oldTemperature,
        }),
      ),
    );

    const becameHot = plain.temperature === 'hot' && oldTemperature !== 'hot';
    const isBulk = BULK_SOURCES.has(String(plain.source || '').toLowerCase());
    if (becameHot && !isBulk) {
      await this.safe('notify hot lead', () =>
        this.notifications.notifyTenant(
          tenantId,
          {
            title: 'Hot Lead: ' + this.leadName(plain),
            body: 'Score ' + plain.score + '/100. ' + this.leadSummary(plain),
            type: 'lead_scored',
            data: { leadId: String(plain._id), score: plain.score },
          },
          { assignedTo: plain.assignedTo, emailFlag: 'emailOnHotLead' },
        ),
      );
    }
  }

  private async onLeadDeleted({ tenantId, leadId }: LeadDeletedPayload) {
    await this.safe('webhook lead.deleted', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'lead.deleted', { _id: leadId })),
    );
  }

  // ─── Conversations ────────────────────────────────────────────────

  private async onConversationCreated({ tenantId, conversation }: ConversationPayload) {
    await this.safe('webhook conversation.created', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'conversation.created', this.toPlain(conversation))),
    );
  }

  private async onConversationEnded({ tenantId, conversation }: ConversationPayload) {
    const plain = this.toPlain(conversation);
    await this.safe('socket conversation_updated', async () =>
      this.chatGateway.emitConversationUpdate(String(plain._id), { status: plain.status, endedAt: plain.endedAt }),
    );
    await this.safe('webhook conversation.ended', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'conversation.ended', plain)),
    );
  }

  private async onMessageCreated({ conversationId, message }: MessageCreatedPayload) {
    await this.safe('socket new_message', async () =>
      this.chatGateway.emitNewMessage(conversationId, this.toPlain(message)),
    );
  }

  // ─── Handoffs ─────────────────────────────────────────────────────

  private async onHandoffCreated({ tenantId, handoff, conversation }: HandoffPayload) {
    const plain = this.toPlain(handoff);
    const conv = conversation ? this.toPlain(conversation) : undefined;

    await this.safe('socket handoff_request', async () => this.chatGateway.emitHandoffRequest(tenantId, plain));
    if (conv) {
      await this.safe('socket conversation_updated', async () =>
        this.chatGateway.emitConversationUpdate(String(conv._id), { status: conv.status, mode: conv.mode }),
      );
    }

    await this.safe('notify handoff', () =>
      this.notifications.notifyTenant(
        tenantId,
        {
          title: 'Human Handoff Requested',
          body: plain.reason || 'A visitor wants to talk to a human agent',
          type: 'handoff_request',
          data: { handoffId: String(plain._id), conversationId: plain.conversationId },
        },
        { assignedTo: plain.assignedTo, emailFlag: 'emailOnHandoff' },
      ),
    );

    await this.safe('webhook handoff.created', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'handoff.created', plain)),
    );
  }

  private async onHandoffStatus({ tenantId, handoff }: HandoffPayload, event: string) {
    const plain = this.toPlain(handoff);
    await this.safe('socket conversation_updated', async () =>
      this.chatGateway.emitConversationUpdate(plain.conversationId, { handoffStatus: plain.status }),
    );
    await this.safe('webhook ' + event, () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, event, plain)),
    );
  }

  // ─── Appointments ─────────────────────────────────────────────────

  private async onAppointmentCreated({ tenantId, appointment }: AppointmentPayload) {
    const plain = this.toPlain(appointment);
    const when = plain.startTime ? new Date(plain.startTime).toLocaleString() : '';
    const parts = [plain.title || 'Appointment'];
    if (when) parts.push('at ' + when);
    if (plain.attendee?.name) parts.push('with ' + plain.attendee.name);

    // 1. Emit realtime socket events so UI updates instantly without refresh
    await this.safe('socket appointment_created', async () =>
      this.chatGateway.emitAppointmentCreated(tenantId, plain),
    );

    // 2. In-app notification for salesperson and tenant
    await this.safe('notify appointment', () =>
      this.notifications.notifyTenant(
        tenantId,
        {
          title: 'New Appointment Booked',
          body: parts.join(' '),
          type: 'appointment',
          data: { appointmentId: String(plain._id) },
        },
        { assignedTo: this.looksLikeUserId(plain.assignedTo) ? plain.assignedTo : undefined },
      ),
    );

    // 3. Outbound webhook
    await this.safe('webhook appointment.created', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'appointment.created', plain)),
    );
  }

  private async onAppointmentUpdated({ tenantId, appointment }: AppointmentPayload) {
    const plain = this.toPlain(appointment);
    const when = plain.startTime ? new Date(plain.startTime).toLocaleString() : '';
    const isRescheduled = plain.status === 'scheduled' && (plain.rescheduledCount || 0) > 0;
    const isCancelled = plain.status === 'cancelled';

    // 1. Emit realtime socket events so UI updates instantly without refresh
    await this.safe('socket appointment_updated', async () =>
      this.chatGateway.emitAppointmentUpdated(tenantId, plain),
    );

    // 2. In-app notification for reschedule / cancel / update
    const title = isRescheduled
      ? 'Appointment Rescheduled'
      : isCancelled
        ? 'Appointment Cancelled'
        : 'Appointment Updated';

    const body = `${plain.title || 'Appointment'} ${isRescheduled ? 'rescheduled to ' + when : isCancelled ? 'was cancelled' : 'updated'}${plain.attendee?.name ? ' (with ' + plain.attendee.name + ')' : ''}`;

    await this.safe('notify appointment update', () =>
      this.notifications.notifyTenant(
        tenantId,
        {
          title,
          body,
          type: 'appointment',
          data: { appointmentId: String(plain._id) },
        },
        { assignedTo: this.looksLikeUserId(plain.assignedTo) ? plain.assignedTo : undefined },
      ),
    );

    // 3. Outbound webhook
    await this.safe('webhook appointment.updated', () =>
      this.queue.run(() => this.webhooks.dispatch(tenantId, 'appointment.updated', plain)),
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async safe<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.warn('[' + label + '] failed: ' + (err?.message || err));
      return undefined;
    }
  }

  private toPlain(doc: any): any {
    if (!doc) return doc;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
  }

  private leadName(lead: any): string {
    return ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim() || lead.email || 'Unknown';
  }

  private leadSummary(lead: any): string {
    const parts = [this.leadName(lead)];
    if (lead.email) parts.push(lead.email);
    if (lead.phone) parts.push(lead.phone);
    if (lead.company) parts.push(lead.company);
    return parts.join(' | ');
  }

  private looksLikeUserId(value?: string): boolean {
    return !!value && /^[a-f\d]{24}$/i.test(value);
  }
}
