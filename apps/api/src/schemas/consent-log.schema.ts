import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConsentLogDocument = HydratedDocument<ConsentLog>;

@Schema({ timestamps: true })
export class ConsentLog {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  leadId: string;

  @Prop({ index: true })
  visitorId: string;

  @Prop({
    type: String,
    enum: ['data_collection', 'marketing', 'analytics', 'third_party_sharing'],
    required: true,
  })
  consentType: string;

  @Prop({ required: true })
  granted: boolean;

  @Prop({ type: String })
  ip: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({ type: String })
  consentText: string;

  @Prop()
  revokedAt: Date;
}

export const ConsentLogSchema = SchemaFactory.createForClass(ConsentLog);

ConsentLogSchema.index({ tenantId: 1, leadId: 1 });
ConsentLogSchema.index({ tenantId: 1, visitorId: 1 });
