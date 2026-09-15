import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    required: true,
  })
  plan: string;

  @Prop({
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'trialing', 'paused'],
    default: 'trialing',
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  priceMonthly: number;

  @Prop({
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  })
  billingInterval: string;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({
    type: String,
    enum: ['razorpay', 'stripe'],
  })
  paymentProvider: string;

  @Prop({ type: String })
  externalSubscriptionId: string;

  @Prop({ type: String })
  externalCustomerId: string;

  @Prop({ required: true })
  currentPeriodStart: Date;

  @Prop({ required: true })
  currentPeriodEnd: Date;

  @Prop()
  cancelledAt: Date;

  @Prop()
  cancelReason: string;

  @Prop()
  trialEndsAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.index({ tenantId: 1 });
SubscriptionSchema.index({ status: 1 });
