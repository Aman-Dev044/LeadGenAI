import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AccountDeletionRequestDocument = HydratedDocument<AccountDeletionRequest>;

@Schema({ timestamps: true })
export class AccountDeletionRequest {
  @Prop({ required: true, type: String, index: true })
  tenantId: string;

  @Prop({ required: true, type: String, index: true })
  userId: string;

  @Prop({ required: true, trim: true, lowercase: true })
  userEmail: string;

  @Prop({ required: true, trim: true })
  userName: string;

  @Prop({ required: true, type: String })
  userRole: string;

  @Prop({ required: true, trim: true })
  tenantName: string;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ default: false })
  cascadeTenantDeletion: boolean;

  @Prop({ default: 0 })
  affectedUsersCount: number;

  @Prop()
  reviewedBy: string;

  @Prop()
  reviewedAt: Date;

  @Prop({ trim: true })
  rejectionReason: string;
}

export const AccountDeletionRequestSchema = SchemaFactory.createForClass(AccountDeletionRequest);

AccountDeletionRequestSchema.index({ tenantId: 1, status: 1 });
AccountDeletionRequestSchema.index({ userId: 1, status: 1 });
AccountDeletionRequestSchema.index({ createdAt: -1 });
