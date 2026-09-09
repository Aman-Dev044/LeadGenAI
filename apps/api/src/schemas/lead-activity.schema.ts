import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeadActivityDocument = HydratedDocument<LeadActivity>;

@Schema({ timestamps: true })
export class LeadActivity {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  @Prop({
    type: String,
    enum: [
      'created',
      'status_changed',
      'score_updated',
      'assigned',
      'note_added',
      'email_sent',
      'conversation_started',
      'conversation_ended',
      'field_updated',
      'tag_added',
      'tag_removed',
      'converted',
    ],
    required: true,
  })
  type: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: Object })
  oldValue: any;

  @Prop({ type: Object })
  newValue: any;

  @Prop({ type: String })
  performedBy: string;
}

export const LeadActivitySchema = SchemaFactory.createForClass(LeadActivity);

LeadActivitySchema.index({ leadId: 1, createdAt: -1 });
LeadActivitySchema.index({ tenantId: 1, type: 1 });
