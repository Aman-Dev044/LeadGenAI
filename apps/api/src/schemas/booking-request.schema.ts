import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingRequestDocument = HydratedDocument<BookingRequest>;

export const BOOKING_STATUSES = [
  'collecting', // the AI is still asking for details on WhatsApp
  'submitted', // all required details in; waiting for the team / payment link
  'payment_sent', // payment link shared with the customer
  'paid',
  'confirmed',
  'cancelled',
] as const;

/**
 * An order / booking the AI collected on WhatsApp against one of the
 * workspace's booking forms (flight, hotel, package, demo kit...). The team
 * sees it on the Bookings page, adds the payment link when it is not a fixed
 * one, and confirms once paid.
 */
@Schema({ timestamps: true })
export class BookingRequest {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  @Prop({ type: String, index: true })
  conversationId: string;

  @Prop({ required: true })
  formKey: string;

  @Prop({ type: String })
  formName: string;

  /** field key -> value as the customer gave it. */
  @Prop({ type: Object, default: {} })
  fields: Record<string, any>;

  @Prop({ type: String, enum: BOOKING_STATUSES, default: 'collecting', index: true })
  status: string;

  @Prop({ type: String })
  paymentLink: string;

  @Prop()
  paymentLinkSentAt: Date;

  @Prop({ type: Number })
  amount: number;

  @Prop({ type: String })
  currency: string;

  @Prop({ type: String })
  assignedTo: string;

  @Prop({ type: String })
  taskId: string;

  @Prop({ type: String })
  notes: string;

  @Prop()
  submittedAt: Date;

  @Prop()
  paidAt: Date;

  @Prop()
  confirmedAt: Date;
}

export const BookingRequestSchema = SchemaFactory.createForClass(BookingRequest);
BookingRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
BookingRequestSchema.index({ tenantId: 1, leadId: 1, formKey: 1 });
