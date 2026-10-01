import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompleteTaskDto, CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto';
import { NotificationService } from '../notification/notification.service';
import { EventBusService, PlatformEvents, TaskPayload } from '../../common/events';
import { resolveCallingSettings } from '../calling/calling-settings';

const MAX_ALERTS_PER_TICK = 100;

/**
 * Follow-up tasks: the concrete "call {lead} by 4pm" items the AI and humans
 * create. The scheduler part nudges assignees when a task comes due and
 * escalates to admins when it slips past the tenant's overdue window.
 */
@Injectable()
export class FollowUpTaskService {
  private readonly logger = new Logger(FollowUpTaskService.name);

  constructor(
    @InjectModel('FollowUpTask') private readonly taskModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly notifications: NotificationService,
    private readonly bus: EventBusService,
  ) {}

  // ─── Create / read / update ───────────────────────────────────────

  /**
   * Creates a task and keeps the lead's `nextFollowUpAt` + stage in sync.
   * `createdBy` is a user id, or 'ai' for the automation.
   */
  async create(
    tenantId: string,
    input: {
      leadId: string;
      title: string;
      description?: string;
      type?: string;
      priority?: string;
      dueAt: Date;
      assignedTo?: string;
      source?: string;
      callId?: string;
    },
    createdBy: string,
    ownerId?: string,
  ) {
    const lead = await this.leadModel.findOne({ _id: input.leadId, tenantId, deletedAt: null });
    if (!lead) throw new NotFoundException('Lead not found');
    if (ownerId && String(lead.assignedTo || '') !== String(ownerId)) {
      throw new ForbiddenException('This lead is not assigned to you');
    }

    const assignedTo = input.assignedTo || lead.assignedTo || undefined;

    // The automation must never stack the same follow-up twice (a re-processed
    // call, a retried webhook): reuse the pending one instead
    if (createdBy === 'ai') {
      const dup = await this.taskModel.findOne({
        tenantId,
        leadId: String(lead._id),
        status: 'pending',
        title: input.title,
        ...(input.callId ? { callId: input.callId } : { dueAt: { $gte: new Date(input.dueAt.getTime() - 3_600_000), $lte: new Date(input.dueAt.getTime() + 3_600_000) } }),
      });
      if (dup) return dup;
    }

    const task = await this.taskModel.create({
      tenantId,
      leadId: String(lead._id),
      assignedTo,
      title: input.title,
      description: input.description,
      type: input.type || 'call',
      priority: input.priority || 'normal',
      dueAt: input.dueAt,
      source: input.source || (createdBy === 'ai' ? 'ai' : 'manual'),
      createdBy,
      callId: input.callId,
    });

    await this.activityModel.create({
      tenantId,
      leadId: String(lead._id),
      type: 'task_created',
      description: `Follow-up scheduled: ${input.title} (due ${input.dueAt.toLocaleString('en-IN')})`,
      performedBy: createdBy === 'ai' ? undefined : createdBy,
      newValue: { taskId: String(task._id), dueAt: input.dueAt },
    });

    await this.syncLead(tenantId, String(lead._id), { promoteToFollowUp: true });

    // The assignee hears about it right away when the AI scheduled it
    if (assignedTo && createdBy === 'ai') {
      await this.notifications.create(tenantId, {
        userId: assignedTo,
        title: `Follow-up: ${input.title}`,
        body: `${this.leadName(lead)} · due ${input.dueAt.toLocaleString('en-IN')}${input.description ? ` · ${input.description}` : ''}`,
        type: 'follow_up_task',
        channel: 'in_app',
        data: { leadId: String(lead._id), taskId: String(task._id) },
      });
    }

    this.bus.emit<TaskPayload>(PlatformEvents.TASK_CREATED, { tenantId, task: task.toObject(), lead });
    return task;
  }

  async createFromDto(tenantId: string, dto: CreateTaskDto, userId: string, ownerId?: string) {
    return this.create(
      tenantId,
      {
        leadId: dto.leadId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        dueAt: new Date(dto.dueAt),
        assignedTo: ownerId ? ownerId : dto.assignedTo,
        source: 'manual',
      },
      userId,
      ownerId,
    );
  }

  async findAll(tenantId: string, query: TaskQueryDto, actor: { userId: string; role: string }) {
    const filter: any = {};
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    const mine = actor.role === 'SALESPERSON' || query.mine;
    if (mine) filter.assignedTo = actor.userId;
    else if (query.assignedTo) filter.assignedTo = query.assignedTo;

    if (query.leadId) filter.leadId = query.leadId;
    filter.status = query.status || 'pending';

    const now = new Date();
    if (query.window === 'overdue') filter.dueAt = { $lt: now };
    else if (query.window === 'today') {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      filter.dueAt = { $lte: end };
    } else if (query.window === 'upcoming') filter.dueAt = { $gt: now };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ dueAt: filter.status === 'pending' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.taskModel.countDocuments(filter),
    ]);

    // Attach the lead's name/phone so the list is usable without N extra calls
    const leadIds = [...new Set(data.map((t: any) => t.leadId))];
    const leads = leadIds.length
      ? await this.leadModel
          .find({ _id: { $in: leadIds } })
          .select('firstName lastName phone email company status temperature assignedTo')
          .lean()
      : [];
    const leadMap = new Map(leads.map((l: any) => [String(l._id), l]));

    return {
      data: data.map((t: any) => ({ ...t, lead: leadMap.get(t.leadId) || null })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findForLead(tenantId: string, leadId: string) {
    const filter: any = { leadId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    return this.taskModel.find(filter).sort({ status: 1, dueAt: 1 }).limit(50).lean();
  }

  async update(tenantId: string, taskId: string, dto: UpdateTaskDto, actor: { userId: string; role: string }) {
    const task = await this.getOwned(tenantId, taskId, actor);
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.type) task.type = dto.type;
    if (dto.priority) task.priority = dto.priority;
    if (dto.dueAt) {
      task.dueAt = new Date(dto.dueAt);
      // A rescheduled task gets its nudges again
      task.dueNotifiedAt = undefined;
      task.overdueAlertedAt = undefined;
    }
    if (dto.assignedTo && actor.role !== 'SALESPERSON') task.assignedTo = dto.assignedTo;
    await task.save();
    await this.syncLead(tenantId, task.leadId, {});
    return task;
  }

  async complete(tenantId: string, taskId: string, dto: CompleteTaskDto, actor: { userId: string; role: string }) {
    const task = await this.getOwned(tenantId, taskId, actor);
    if (task.status !== 'pending') return task;

    task.status = dto.skipped ? 'skipped' : 'done';
    task.completedAt = new Date();
    task.completedBy = actor.userId;
    task.outcome = dto.outcome;
    task.outcomeNote = dto.note;
    await task.save();

    const lead = await this.leadModel.findOne({ _id: task.leadId, tenantId });
    if (lead) {
      await this.activityModel.create({
        tenantId,
        leadId: task.leadId,
        type: 'task_completed',
        description: `${dto.skipped ? 'Skipped' : 'Completed'}: ${task.title}${dto.outcome ? ` · ${dto.outcome.replace(/_/g, ' ')}` : ''}${dto.note ? ` · ${dto.note}` : ''}`,
        performedBy: actor.userId,
      });

      // Outcome shortcuts move the pipeline without a second click
      const statusByOutcome: Record<string, string> = {
        meeting_set: 'meeting',
        won: 'won',
        lost: 'lost',
        not_interested: 'lost',
        reached: lead.status === 'new' || lead.status === 'contacted' ? 'interested' : '',
      };
      const next = dto.outcome ? statusByOutcome[dto.outcome] : '';
      const set: any = { lastActivityAt: new Date() };
      if (next && next !== lead.status) {
        set.status = next;
        if (next === 'won') set.convertedAt = new Date();
        await this.activityModel.create({
          tenantId,
          leadId: task.leadId,
          type: 'status_changed',
          description: `Status changed from ${lead.status} to ${next} after follow-up`,
          oldValue: lead.status,
          newValue: next,
          performedBy: actor.userId,
        });
      }
      if (dto.outcome === 'reached' || dto.outcome === 'meeting_set') set.lastContactedAt = new Date();
      const updated = await this.leadModel.findOneAndUpdate({ _id: lead._id }, { $set: set }, { new: true });
      if (set.status) {
        this.bus.emit(PlatformEvents.LEAD_UPDATED, {
          tenantId,
          lead: updated,
          changes: { status: { from: lead.status, to: set.status } },
          performedBy: actor.userId,
        });
      }
    }

    if (dto.nextDueAt && !dto.skipped) {
      await this.create(
        tenantId,
        {
          leadId: task.leadId,
          title: dto.nextTitle || `Follow up with ${lead ? this.leadName(lead) : 'lead'}`,
          type: dto.nextType || task.type,
          dueAt: new Date(dto.nextDueAt),
          assignedTo: task.assignedTo,
          source: 'manual',
        },
        actor.userId,
      );
    } else {
      await this.syncLead(tenantId, task.leadId, {});
    }

    this.bus.emit<TaskPayload>(PlatformEvents.TASK_COMPLETED, { tenantId, task: task.toObject(), lead });
    return task;
  }

  async remove(tenantId: string, taskId: string, actor: { userId: string; role: string }) {
    const task = await this.getOwned(tenantId, taskId, actor);
    task.status = 'cancelled';
    await task.save();
    await this.syncLead(tenantId, task.leadId, {});
    return { message: 'Task cancelled' };
  }

  /** Cancels every pending task of a lead (lead lost / deleted). */
  async cancelForLead(tenantId: string, leadId: string, reason?: string) {
    await this.taskModel.updateMany(
      { tenantId, leadId, status: 'pending' },
      { $set: { status: 'cancelled', outcomeNote: reason } },
    );
    await this.syncLead(tenantId, leadId, {});
  }

  // ─── Manager view ─────────────────────────────────────────────────

  async stats(tenantId: string, actor: { userId: string; role: string }) {
    const base: any = { status: 'pending' };
    if (tenantId && tenantId !== 'all') base.tenantId = tenantId;
    if (actor.role === 'SALESPERSON') base.assignedTo = actor.userId;

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const doneFilter: any = { status: 'done', completedAt: { $gte: startOfDay } };
    if (base.tenantId) doneFilter.tenantId = base.tenantId;
    if (base.assignedTo) doneFilter.assignedTo = base.assignedTo;

    const [overdue, dueToday, upcoming, doneToday, perUser] = await Promise.all([
      this.taskModel.countDocuments({ ...base, dueAt: { $lt: now } }),
      this.taskModel.countDocuments({ ...base, dueAt: { $gte: now, $lte: endOfDay } }),
      this.taskModel.countDocuments({ ...base, dueAt: { $gt: endOfDay } }),
      this.taskModel.countDocuments(doneFilter),
      actor.role === 'SALESPERSON'
        ? Promise.resolve([])
        : this.taskModel.aggregate([
            { $match: base },
            {
              $group: {
                _id: '$assignedTo',
                pending: { $sum: 1 },
                overdue: { $sum: { $cond: [{ $lt: ['$dueAt', now] }, 1, 0] } },
              },
            },
            { $sort: { overdue: -1, pending: -1 } },
            { $limit: 20 },
          ]),
    ]);

    let team: any[] = [];
    if (perUser.length) {
      const ids = perUser.map((p: any) => p._id).filter(Boolean);
      const users = await this.userModel.find({ _id: { $in: ids } }).select('firstName lastName').lean();
      const nameOf = new Map(users.map((u: any) => [String(u._id), `${u.firstName || ''} ${u.lastName || ''}`.trim()]));
      team = perUser.map((p: any) => ({
        userId: p._id,
        name: p._id ? nameOf.get(String(p._id)) || 'Unknown' : 'Unassigned',
        pending: p.pending,
        overdue: p.overdue,
      }));
    }

    return { overdue, dueToday, upcoming, doneToday, team };
  }

  // ─── Scheduler: due nudges + overdue escalation ───────────────────

  /** Called every few minutes. Returns how many alerts went out. */
  async processDue(): Promise<number> {
    let sent = 0;
    const now = new Date();

    // 1. "Due now" nudge to the assignee
    const due = await this.taskModel
      .find({ status: 'pending', dueAt: { $lte: now }, dueNotifiedAt: null, assignedTo: { $exists: true, $ne: '' } })
      .sort({ dueAt: 1 })
      .limit(MAX_ALERTS_PER_TICK)
      .lean();
    for (const task of due) {
      try {
        const lead = await this.leadModel.findById(task.leadId).select('firstName lastName phone company').lean();
        await this.notifications.create(task.tenantId, {
          userId: task.assignedTo,
          title: `Due now: ${task.title}`,
          body: lead ? `${this.leadName(lead)}${(lead as any).phone ? ` · ${(lead as any).phone}` : ''}` : '',
          type: 'follow_up_task',
          channel: 'in_app',
          data: { leadId: task.leadId, taskId: String(task._id) },
        });
        await this.taskModel.updateOne({ _id: task._id }, { $set: { dueNotifiedAt: now } });
        sent++;
      } catch (err: any) {
        this.logger.warn(`Due nudge failed for task ${task._id}: ${err?.message}`);
      }
    }

    // 2. Overdue escalation, per tenant window
    const candidates = await this.taskModel
      .find({ status: 'pending', overdueAlertedAt: null, dueAt: { $lt: new Date(now.getTime() - 30 * 60_000) } })
      .sort({ dueAt: 1 })
      .limit(MAX_ALERTS_PER_TICK)
      .lean();
    const windowByTenant = new Map<string, number>();

    for (const task of candidates) {
      try {
        let hours = windowByTenant.get(task.tenantId);
        if (hours === undefined) {
          const tenant: any = await this.tenantModel.findById(task.tenantId).select('callingSettings').lean();
          hours = resolveCallingSettings(tenant?.callingSettings).overdueAlertHours;
          windowByTenant.set(task.tenantId, hours);
        }
        const overdueMs = now.getTime() - new Date(task.dueAt).getTime();
        if (overdueMs < hours * 3_600_000) continue;

        const lead: any = await this.leadModel.findById(task.leadId).select('firstName lastName phone company assignedTo').lean();
        const assignee: any = task.assignedTo
          ? await this.userModel.findById(task.assignedTo).select('firstName lastName').lean()
          : null;
        const who = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Nobody';
        const hoursLate = Math.round(overdueMs / 3_600_000);

        // Admins (tenant notify roles) - never the assignee, who gets their own line below
        await this.notifications.notifyTenant(
          task.tenantId,
          {
            title: `Follow-up overdue: ${lead ? this.leadName(lead) : 'lead'}`,
            body: `${who} has not done "${task.title}" - it was due ${hoursLate}h ago. Lead may go cold.`,
            type: 'follow_up_overdue',
            data: { leadId: task.leadId, taskId: String(task._id), assignedTo: task.assignedTo },
          },
          { emailFlag: 'emailOnOverdueFollowUp' },
        );
        if (task.assignedTo) {
          await this.notifications.create(task.tenantId, {
            userId: task.assignedTo,
            title: `Overdue: ${task.title}`,
            body: `${lead ? this.leadName(lead) : 'Lead'} is waiting - this was due ${hoursLate}h ago and your manager has been notified.`,
            type: 'follow_up_overdue',
            channel: 'in_app',
            data: { leadId: task.leadId, taskId: String(task._id) },
          });
        }
        await this.activityModel.create({
          tenantId: task.tenantId,
          leadId: task.leadId,
          type: 'manager_alerted',
          description: `Manager alerted: "${task.title}" overdue by ${hoursLate}h (${who})`,
        });
        await this.taskModel.updateOne({ _id: task._id }, { $set: { overdueAlertedAt: now } });
        this.bus.emit<TaskPayload>(PlatformEvents.TASK_OVERDUE, { tenantId: task.tenantId, task, lead });
        sent++;
      } catch (err: any) {
        this.logger.warn(`Overdue alert failed for task ${task._id}: ${err?.message}`);
      }
    }

    return sent;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async getOwned(tenantId: string, taskId: string, actor: { userId: string; role: string }) {
    const filter: any = { _id: taskId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    if (actor.role === 'SALESPERSON' && String(task.assignedTo || '') !== String(actor.userId)) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    return task;
  }

  /**
   * Recomputes the lead's `nextFollowUpAt` from its pending tasks and, when
   * asked, moves an Interested/Contacted lead into the Follow-up stage.
   */
  async syncLead(tenantId: string, leadId: string, opts: { promoteToFollowUp?: boolean }) {
    const next: any = await this.taskModel
      .findOne({ tenantId, leadId, status: 'pending' })
      .sort({ dueAt: 1 })
      .select('dueAt')
      .lean();
    const set: any = { nextFollowUpAt: next?.dueAt ?? null };

    if (opts.promoteToFollowUp) {
      const lead: any = await this.leadModel.findOne({ _id: leadId, tenantId }).select('status').lean();
      if (lead && ['new', 'contacted', 'interested'].includes(lead.status)) {
        set.status = 'follow_up';
        await this.activityModel.create({
          tenantId,
          leadId,
          type: 'status_changed',
          description: `Status changed from ${lead.status} to follow_up (follow-up scheduled)`,
          oldValue: lead.status,
          newValue: 'follow_up',
        });
      }
    }
    await this.leadModel.updateOne({ _id: leadId, tenantId }, { $set: set });
  }

  private leadName(lead: any): string {
    return `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || lead?.email || lead?.phone || 'Lead';
  }
}
