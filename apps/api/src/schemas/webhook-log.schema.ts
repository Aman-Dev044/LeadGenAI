import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WebhookLogDocument = HydratedDocument<WebhookLog>;

@Schema({ timestamps: true })
export class WebhookLog {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  webhookId: string;

  @Prop({ required: true })
  event: string;

  @Prop({ type: Object })
  payload: Record<string, any>;

  @Prop({ type: Number })
  statusCode: number;

  @Prop({ type: String })
  responseBody: string;

  @Prop({
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending',
  })
  status: string;

  @Prop({ default: 0 })
  attemptNumber: number;

  @Prop({ type: String })
  errorMessage: string;

  @Prop({ type: Number })
  duration: number;
}

export const WebhookLogSchema = SchemaFactory.createForClass(WebhookLog);

WebhookLogSchema.index({ webhookId: 1, createdAt: -1 });
WebhookLogSchema.index({ tenantId: 1, event: 1 });
