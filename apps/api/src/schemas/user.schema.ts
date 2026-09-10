import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, type: String, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'],
    default: 'SALESPERSON',
  })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;

  @Prop({ trim: true })
  avatar: string;

  @Prop({ trim: true })
  phone: string;

  @Prop()
  emailVerifiedAt: Date;

  /** True for self-service signups until the emailed code is confirmed. Login is blocked while set. */
  @Prop({ default: false })
  pendingEmailVerification: boolean;

  /** sha256 of the 6-digit code emailed at signup (never returned by default) */
  @Prop({ select: false })
  emailVerificationCode: string;

  @Prop()
  emailVerificationExpires: Date;

  @Prop()
  emailVerificationSentAt: Date;

  @Prop({ default: 0 })
  emailVerificationAttempts: number;

  @Prop()
  passwordResetToken: string;

  @Prop()
  passwordResetExpires: Date;

  @Prop()
  deletedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
