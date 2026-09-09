import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateWorkflowDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { NotificationService } from '../notification/notification.service';
import {
  EventBusService,
  PlatformEvents,
  LeadCreatedPayload,
  LeadUpdatedPayload,
  LeadScoredPayload,
  ConversationPayload,
  HandoffPayload,
} from '../../common/events';

const DEFAULT_POLL_MS = 60_000;
const MAX_PER_TICK = 200;
const STALE_PROCESSING_MS = 10 * 60_000;

/**
 * Follow-up workflows.
 *
 * Triggers come from the platform event bus. Every step of a matching workflow
 * is written to FollowUpLog with a scheduledAt; immediate steps run right away
 * and delayed steps are picked up by the in-process scheduler below, which
 * atomically claims due logs so a step is never executed twice.
 */
@Injectable()
export class FollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    @InjectModel('FollowUpWorkflow') private readonly workflowModel: Model<any>,
    @InjectModel('FollowUpLog') private readonly logModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    private readonly notificationService: NotificationService,
    private readonly bus: EventBusService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Lifecycle: event subscriptions + scheduler ───────────────────

  onModuleInit() {
    this.bus.on<LeadCreatedPayload>(PlatformEvents.LEAD_CREATED, ({ tenantId, lead }) =>
      this.triggerWorkflows(tenantId, 'lead_created', lead),
    );
    this.bus.on<LeadUpdatedPayload>(PlatformEvents.LEAD_UPDATED, ({ tenantId, lead, changes }) => {
      if (changes?.status) return this.triggerWorkflows(tenantId, 'status_changed', lead);
    });
    this.bus.on<LeadScoredPayload>(PlatformEvents.LEAD_SCORED, ({ tenantId, lead }) =>
      this.triggerWorkflows(tenantId, 'score_changed', lead),
    );
    this.bus.on<ConversationPayload>(PlatformEvents.CONVERSATION_ENDED, async ({ tenantId, conversation }) => {
      const leadId = conversation?.leadId;
      if (!leadId) return;
      const lead = await this.leadModel.findOne({ _id: leadId, tenantId, deletedAt: null });
      if (lead) await this.triggerWorkflows(tenantId, 'conversation_ended', lead);
    });
    this.bus.on<HandoffPayload>(PlatformEvents.HANDOFF_COMPLETED, async ({ tenantId, handoff }) => {
      const lead = await this.findLeadForConversation(tenantId, handoff?.conversationId);
      if (lead) await this.triggerWorkflows(tenantId, 'handoff_completed', lead);
    });

    const enabled = (process.env.FOLLOW_UP_SCHEDULER_ENABLED || 'true') !== 'false';
    if (!enabled) {
      this.logger.warn('Follow-up scheduler disabled via FOLLOW_UP_SCHEDULER_ENABLED=false');
      return;
    }
    const interval = parseInt(process.env.FOLLOW_UP_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.processDueSteps(), interval);
    this.timer.unref?.();
    // Run once shortly after boot to catch up on anything missed while down
    setTimeout(() => void this.processDueSteps(), 5_000).unref?.();
    this.logger.log(`Follow-up scheduler started (every ${interval / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  async createWorkflow(tenantId: string, dto: CreateWorkflowDto) {
    return this.workflowModel.create({ tenantId, ...dto });
  }

  async findAllWorkflows(tenantId: string, paginationDto: PaginationDto) {
    return paginate(this.workflowModel, { tenantId, deletedAt: null }, paginationDto);
  }

  async findWorkflowById(tenantId: string, workflowId: string) {
    const workflow = await this.workflowModel.findOne({ _id: workflowId, tenantId, deletedAt: null });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async updateWorkflow(tenantId: string, workflowId: string, dto: Partial<CreateWorkflowDto>) {
    const workflow = await this.workflowModel.findOneAndUpdate(
      { _id: workflowId, tenantId, deletedAt: null },
      { $set: dto },
      { new: true },
    );
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async deleteWorkflow(tenantId: string, workflowId: string) {
    const workflow = await this.workflowModel.findOneAndUpdate(
      { _id: workflowId, tenantId },
      { deletedAt: new Date(), isActive: false },
      { new: true },
    );
    if (!workflow) throw new NotFoundException('Workflow not found');
    // Cancel anything still queued for this workflow
    await this.logModel.updateMany(
      { tenantId, workflowId, status: 'pending' },
      { $set: { status: 'skipped', skipReason: 'Workflow deleted' } },
    );
    return { message: 'Workflow deleted' };
  }

  async toggleStatus(tenantId: string, workflowId: string, isActive: boolean) {
    const workflow = await this.workflowModel.findOneAndUpdate(
      { _id: workflowId, tenantId, deletedAt: null },
      { $set: { isActive } },
      { new: true },
    );
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async getWorkflowLogs(tenantId: string, workflowId: string, paginationDto: PaginationDto) {
    return paginate(this.logModel, { tenantId, workflowId }, paginationDto);
  }

  // ─── Triggering ───────────────────────────────────────────────────

  async triggerWorkflows(tenantId: string, trigger: string, lead: any) {
    if (!lead?._id) return;
    const leadId = String(lead._id);

    const workflows = await this.workflowModel
      .find({ tenantId, trigger, isActive: true, deletedAt: null })
      .lean();

    for (const workflow of workflows) {
      if (!this.matchesConditions(workflow.triggerConditions, lead)) continue;

      const workflowId = String(workflow._id);

      // Do not re-queue the same workflow for the same lead while a run is still in flight
      const inFlight = await this.logModel.exists({
        tenantId,
        workflowId,
        leadId,
        status: { $in: ['pending', 'processing'] },
      });
      if (inFlight) continue;

      const now = Date.now();
      const logs = (workflow.steps || []).map((step: any) => ({
        tenantId,
        workflowId,
        leadId,
        stepOrder: step.order,
        action: step.action,
        status: 'pending',
        scheduledAt: new Date(now + Math.max(0, step.delayMinutes || 0) * 60_000),
      }));
      if (logs.length === 0) continue;

      await this.logModel.insertMany(logs);
      this.logger.log(`Queued ${logs.length} step(s) of workflow "${workflow.name}" for lead ${leadId}`);
    }

    // Immediate steps: run now instead of waiting for the next tick
    void this.processDueSteps();
  }

  // ─── Scheduler ────────────────────────────────────────────────────

  async processDueSteps(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    let processed = 0;

    try {
      // Recover logs stuck in "processing" (e.g. crashed mid-run)
      await this.logModel.updateMany(
        { status: 'processing', updatedAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
        { $set: { status: 'pending' } },
      );

      while (processed < MAX_PER_TICK) {
        const log = await this.logModel.findOneAndUpdate(
          { status: 'pending', scheduledAt: { $lte: new Date() } },
          { $set: { status: 'processing' } },
          { sort: { scheduledAt: 1 }, new: true },
        );
        if (!log) break;

        await this.processLog(log);
        processed++;
      }
    } catch (err: any) {
      this.logger.error(`Follow-up tick failed: ${err.message}`, err.stack);
    } finally {
      this.ticking = false;
    }

    if (processed > 0) this.logger.log(`Executed ${processed} follow-up step(s)`);
    return processed;
  }

  private async processLog(log: any) {
    const tenantId = log.tenantId;

    try {
      const workflow: any = await this.workflowModel.findOne({ _id: log.workflowId, tenantId }).lean();
      if (!workflow || !workflow.isActive || workflow.deletedAt) {
        return this.finish(log, 'skipped', { skipReason: 'Workflow inactive or deleted' });
      }

      const step = (workflow.steps || []).find((s: any) => s.order === log.stepOrder);
      if (!step) {
        return this.finish(log, 'failed', { errorMessage: `Step ${log.stepOrder} no longer exists` });
      }

      const lead = await this.leadModel.findOne({ _id: log.leadId, tenantId, deletedAt: null });
      if (!lead) {
        return this.finish(log, 'skipped', { skipReason: 'Lead not found or deleted' });
      }

      if (step.skipCondition && this.matchesConditions(step.skipCondition, lead)) {
        return this.finish(log, 'skipped', { skipReason: 'Skip condition met' });
      }

      const result = await this.executeAction(tenantId, String(workflow._id), lead, step);
      return this.finish(log, 'executed', { executedAt: new Date(), result });
    } catch (error: any) {
      this.logger.error(`Follow-up step failed (log ${log._id}): ${error.message}`);
      return this.finish(log, 'failed', { errorMessage: error.message });
    }
  }

  private async finish(log: any, status: string, extra: Record<string, any>) {
    await this.logModel.updateOne({ _id: log._id }, { $set: { status, ...extra } });
  }

  // ─── Actions ──────────────────────────────────────────────────────

  private async executeAction(tenantId: string, workflowId: string, lead: any, step: any): Promise<any> {
    const cfg = step.actionConfig || {};
    const leadId = String(lead._id);
    const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email || 'Lead';
    const data = { leadId, workflowId };

    switch (step.action) {
      case 'change_status': {
        if (!cfg.status) throw new Error('actionConfig.status is required');
        const from = lead.status;
        if (from === cfg.status) return { skipped: true, reason: 'Already in status' };
        lead.status = cfg.status;
        lead.lastActivityAt = new Date();
        if (cfg.status === 'converted') lead.convertedAt = new Date();
        await lead.save();
        await this.activityModel.create({
          tenantId,
          leadId,
          type: 'status_changed',
          description: `Status changed from ${from} to ${cfg.status} by follow-up workflow`,
          oldValue: from,
          newValue: cfg.status,
        });
        this.bus.emit<LeadUpdatedPayload>(PlatformEvents.LEAD_UPDATED, {
          tenantId,
          lead,
          changes: { status: { from, to: cfg.status } },
        });
        return { status: cfg.status };
      }

      case 'assign_lead': {
        if (!cfg.assignTo) throw new Error('actionConfig.assignTo is required');
        const from = lead.assignedTo;
        if (from === cfg.assignTo) return { skipped: true, reason: 'Already assigned' };
        lead.assignedTo = cfg.assignTo;
        lead.lastActivityAt = new Date();
        await lead.save();
        await this.activityModel.create({
          tenantId,
          leadId,
          type: 'assigned',
          description: 'Assigned by follow-up workflow',
          oldValue: from,
          newValue: cfg.assignTo,
        });
        this.bus.emit<LeadUpdatedPayload>(PlatformEvents.LEAD_UPDATED, {
          tenantId,
          lead,
          changes: { assignedTo: { from, to: cfg.assignTo } },
        });
        return { assignedTo: cfg.assignTo };
      }

      case 'send_email':
      case 'send_sms':
      case 'send_whatsapp': {
        const channel = step.action.replace('send_', '') as 'email' | 'sms' | 'whatsapp';
        const recipientType = cfg.recipient === 'salesperson' ? 'salesperson' : 'lead';
        const title = this.render(cfg.subject || cfg.title || `Follow-up from ${name}`, lead);
        const body = this.render(
          cfg.message || `Hi ${lead.firstName || 'there'}, just following up on your recent enquiry. Let us know how we can help.`,
          lead,
        );

        if (recipientType === 'lead') {
          const sent = await this.notificationService.sendToLead(tenantId, channel, lead, {
            title,
            body,
            type: 'follow_up',
            data,
          });
          if (!sent) return { skipped: true, reason: `Lead has no ${channel === 'email' ? 'email' : 'phone'}` };
          await this.activityModel.create({
            tenantId,
            leadId,
            type: channel === 'email' ? 'email_sent' : 'note_added',
            description: `Follow-up ${channel} sent: ${title}`,
          });
          return { channel, recipient: 'lead', notificationId: String(sent._id) };
        }

        const created = await this.notificationService.notifyTenant(
          tenantId,
          { title, body, type: 'follow_up', data },
          { assignedTo: lead.assignedTo || cfg.notifyUserId, channels: false },
        );
        return { channel, recipient: 'salesperson', count: created.length };
      }

      case 'notify_salesperson': {
        const created = await this.notificationService.notifyTenant(
          tenantId,
          {
            title: 'Lead Follow-up Required',
            body: this.render(cfg.message || `Please follow up with ${name} (${lead.email || lead.phone || 'no contact'})`, lead),
            type: 'follow_up',
            data,
          },
          { assignedTo: lead.assignedTo || cfg.notifyUserId, channels: false },
        );
        return { notified: created.length };
      }

      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private matchesConditions(conditions: Record<string, any> | undefined, lead: any): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    for (const [key, expected] of Object.entries(conditions)) {
      const actual = key in (lead.customFields || {}) && !(key in lead) ? lead.customFields[key] : lead[key];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else if (expected && typeof expected === 'object') {
        if (expected.$gte !== undefined && !(actual >= expected.$gte)) return false;
        if (expected.$lte !== undefined && !(actual <= expected.$lte)) return false;
        if (expected.$ne !== undefined && actual === expected.$ne) return false;
        if (expected.$in !== undefined && !expected.$in.includes(actual)) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
    return true;
  }

  private render(template: string, lead: any): string {
    return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      const value = lead[key] ?? lead.customFields?.[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private async findLeadForConversation(tenantId: string, conversationId?: string) {
    if (!conversationId) return null;
    return this.leadModel.findOne({ tenantId, conversationIds: conversationId, deletedAt: null });
  }
}
