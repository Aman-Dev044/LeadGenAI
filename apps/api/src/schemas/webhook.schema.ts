import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WebhookDocument = HydratedDocument<Webhook>;

@Schema({ timestamps: true })
export class Webhook {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: [String], required: true })
  events: string[];

  @Prop({ required: true })
  secret: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: {
      contentType: { type: String, default: 'application/json' },
      retryCount: { type: Number, default: 3 },
      timeoutMs: { type: Number, default: 10000 },
    },
    default: {},
  })
  config: {
    contentType: string;
    retryCount: number;
    timeoutMs: number;
  };

  @Prop()
  lastTriggeredAt: Date;

  @Prop({ default: 0 })
  failureCount: number;
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);

WebhookSchema.index({ tenantId: 1, isActive: 1 });
