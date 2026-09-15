import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  subscriptionId: string;

  @Prop({ required: true, unique: true })
  invoiceNumber: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({
    type: String,
    enum: ['draft', 'pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: String })
  plan: string;

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({ type: String })
  paymentProvider: string;

  @Prop({ type: String })
  externalPaymentId: string;

  @Prop({ type: String })
  externalInvoiceId: string;

  @Prop()
  paidAt: Date;

  @Prop({ type: String })
  pdfUrl: string;

  @Prop({
    type: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      total: Number,
    }],
    default: [],
  })
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ tenantId: 1, createdAt: -1 });
