import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UsageRecordDocument = HydratedDocument<UsageRecord>;

@Schema({ timestamps: true })
export class UsageRecord {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  period: string; // e.g. "2026-08"

  @Prop({
    type: {
      conversations: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      kbSources: { type: Number, default: 0 },
      kbStorageMB: { type: Number, default: 0 },
      aiTokensUsed: { type: Number, default: 0 },
      emailsSent: { type: Number, default: 0 },
      smsSent: { type: Number, default: 0 },
    },
    default: {},
  })
  usage: {
    conversations: number;
    leads: number;
    messages: number;
    kbSources: number;
    kbStorageMB: number;
    aiTokensUsed: number;
    emailsSent: number;
    smsSent: number;
  };

  @Prop()
  lastCalculatedAt: Date;
}

export const UsageRecordSchema = SchemaFactory.createForClass(UsageRecord);

UsageRecordSchema.index({ tenantId: 1, period: 1 }, { unique: true });
