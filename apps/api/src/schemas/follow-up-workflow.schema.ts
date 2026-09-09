import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FollowUpWorkflowDocument = HydratedDocument<FollowUpWorkflow>;

@Schema({ timestamps: true })
export class FollowUpWorkflow {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String })
  description: string;

  @Prop({
    type: String,
    enum: ['lead_created', 'status_changed', 'score_changed', 'conversation_ended', 'handoff_completed'],
    required: true,
  })
  trigger: string;

  @Prop({ type: Object, default: {} })
  triggerConditions: Record<string, any>;

  @Prop({
    type: [{
      order: Number,
      delayMinutes: Number,
      action: {
        type: String,
        enum: ['send_email', 'send_sms', 'send_whatsapp', 'notify_salesperson', 'change_status', 'assign_lead'],
      },
      actionConfig: Object,
      skipCondition: Object,
    }],
    default: [],
  })
  steps: {
    order: number;
    delayMinutes: number;
    action: string;
    actionConfig: Record<string, any>;
    skipCondition?: Record<string, any>;
  }[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  deletedAt: Date;
}

export const FollowUpWorkflowSchema = SchemaFactory.createForClass(FollowUpWorkflow);

FollowUpWorkflowSchema.index({ tenantId: 1, isActive: 1 });
FollowUpWorkflowSchema.index({ tenantId: 1, trigger: 1 });
