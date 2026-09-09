import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FollowUpLogDocument = HydratedDocument<FollowUpLog>;

@Schema({ timestamps: true })
export class FollowUpLog {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  workflowId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  @Prop({ required: true })
  stepOrder: number;

  @Prop({ required: true })
  action: string;

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'executed', 'skipped', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  scheduledAt: Date;

  @Prop()
  executedAt: Date;

  @Prop({ type: String })
  skipReason: string;

  @Prop({ type: String })
  errorMessage: string;

  @Prop({ type: Object })
  result: Record<string, any>;
}

export const FollowUpLogSchema = SchemaFactory.createForClass(FollowUpLog);

FollowUpLogSchema.index({ workflowId: 1, leadId: 1 });
FollowUpLogSchema.index({ tenantId: 1, status: 1 });
FollowUpLogSchema.index({ status: 1, scheduledAt: 1 });
