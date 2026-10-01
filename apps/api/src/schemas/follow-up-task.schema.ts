import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FollowUpTaskDocument = HydratedDocument<FollowUpTask>;

export const TASK_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'other'] as const;
export const TASK_STATUSES = ['pending', 'done', 'skipped', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/**
 * A concrete "do this by then" for a salesperson (or the AI). Created by the
 * call analysis, the re-engagement loop, workflows or by hand. Overdue tasks
 * escalate to the workspace admins.
 */
@Schema({ timestamps: true })
export class FollowUpTask {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  /** Salesperson responsible. Empty = unassigned (admins are alerted instead). */
  @Prop({ type: String, index: true, sparse: true })
  assignedTo: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String, enum: TASK_TYPES, default: 'call' })
  type: string;

  @Prop({ type: String, enum: TASK_PRIORITIES, default: 'normal' })
  priority: string;

  @Prop({ type: String, enum: TASK_STATUSES, default: 'pending', index: true })
  status: string;

  @Prop({ required: true, index: true })
  dueAt: Date;

  /** 'ai' | 'reengage' | 'workflow' | 'manual' | 'human_call' */
  @Prop({ type: String, default: 'manual' })
  source: string;

  /** User id, or 'ai' when the system created it. */
  @Prop({ type: String })
  createdBy: string;

  /** The call whose analysis produced this task. */
  @Prop({ type: String })
  callId: string;

  /** Set once the "due now" nudge went to the assignee. */
  @Prop()
  dueNotifiedAt: Date;

  /** Set once admins were told the task slipped. One alert per task. */
  @Prop()
  overdueAlertedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop({ type: String })
  completedBy: string;

  /** What happened when it was done: reached / no_answer / meeting_set / not_interested / note */
  @Prop({ type: String })
  outcome: string;

  @Prop({ type: String })
  outcomeNote: string;
}

export const FollowUpTaskSchema = SchemaFactory.createForClass(FollowUpTask);

FollowUpTaskSchema.index({ tenantId: 1, status: 1, dueAt: 1 });
FollowUpTaskSchema.index({ tenantId: 1, assignedTo: 1, status: 1, dueAt: 1 });
FollowUpTaskSchema.index({ tenantId: 1, leadId: 1, status: 1 });
