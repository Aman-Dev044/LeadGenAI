import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

@Schema({ timestamps: true })
export class SupportTicket {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ trim: true, required: true })
  subject: string;

  @Prop({ type: String })
  description: string;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  priority: string;

  @Prop({
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
  })
  status: string;

  @Prop({ index: true })
  leadId: string;

  @Prop({ index: true })
  conversationId: string;

  @Prop()
  assignedTo: string;

  @Prop({
    type: [{
      content: String,
      createdBy: String,
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  })
  notes: {
    content: string;
    createdBy: string;
    createdAt: Date;
  }[];

  @Prop()
  resolvedAt: Date;

  @Prop()
  closedAt: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ tenantId: 1, status: 1 });
SupportTicketSchema.index({ tenantId: 1, assignedTo: 1 });
