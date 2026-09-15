import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  tenantId: string;

  // Target user (optional for channel-level notifications like Slack/Teams or direct lead messages)
  @Prop({ index: true })
  userId: string;

  // Explicit destination (email address, phone number, or webhook URL). Overrides user lookup.
  @Prop({ type: String })
  recipient: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String })
  body: string;

  @Prop({
    type: String,
    enum: [
      'new_lead',
      'lead_scored',
      'handoff_request',
      'conversation_ended',
      'system_alert',
      'assignment',
      'kb_processing',
      'follow_up',
      'appointment',
      'support_ticket',
      'billing',
      'deletion_request',
    ],
    required: true,
  })
  type: string;

  @Prop({
    type: String,
    enum: ['email', 'in_app', 'sms', 'whatsapp', 'slack', 'teams', 'push'],
    required: true,
  })
  channel: string;

  @Prop({
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Object })
  data: Record<string, any>;

  @Prop()
  readAt: Date;

  @Prop()
  sentAt: Date;

  @Prop({ type: String })
  errorMessage: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, type: 1 });
