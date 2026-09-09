import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HandoffDocument = HydratedDocument<Handoff>;

@Schema({ timestamps: true })
export class Handoff {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true })
  agentId: string;

  @Prop({ type: String })
  assignedTo: string;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'expired'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: String })
  reason: string;

  @Prop({ type: String })
  notes: string;

  @Prop({
    type: {
      conversationSummary: String,
      leadScore: Number,
      sentiment: Number,
      keyTopics: [String],
    },
  })
  context: {
    conversationSummary?: string;
    leadScore?: number;
    sentiment?: number;
    keyTopics?: string[];
  };

  @Prop()
  acceptedAt: Date;

  @Prop()
  completedAt: Date;
}

export const HandoffSchema = SchemaFactory.createForClass(Handoff);

HandoffSchema.index({ tenantId: 1, status: 1 });
HandoffSchema.index({ assignedTo: 1, status: 1 });
