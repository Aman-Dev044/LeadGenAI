import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ index: true })
  tenantId: string;

  @Prop({ index: true })
  userId: string;

  @Prop({ required: true })
  action: string;

  @Prop({ type: String })
  resource: string;

  @Prop({ type: String })
  resourceId: string;

  @Prop({ type: Object })
  details: Record<string, any>;

  @Prop()
  ip: string;

  @Prop()
  userAgent: string;

  @Prop({ type: Number })
  duration: number;

  @Prop({
    type: String,
    enum: ['success', 'failure'],
    default: 'success',
  })
  status: string;

  @Prop({ type: String })
  errorMessage: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, action: 1 });
