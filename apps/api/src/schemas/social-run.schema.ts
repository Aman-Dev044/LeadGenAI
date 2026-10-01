import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SocialRunDocument = HydratedDocument<SocialRun>;

/** Audit trail for a single execution of a Leads Scrap AI campaign. */
@Schema({ timestamps: true })
export class SocialRun {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  campaignId: string;

  @Prop({
    type: String,
    enum: ['queued', 'running', 'completed', 'failed'],
    default: 'queued',
    index: true,
  })
  status: string;

  @Prop({ type: String, enum: ['manual', 'schedule'], default: 'manual' })
  trigger: string;

  @Prop({ type: [String], default: [] })
  queries: string[];

  @Prop()
  startedAt: Date;

  @Prop()
  finishedAt: Date;

  @Prop({
    type: {
      fetched: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      filteredOut: { type: Number, default: 0 },
      aiClassified: { type: Number, default: 0 },
      // Posts the AI confirmed are real buying intent.
      qualified: { type: Number, default: 0 },
      saved: { type: Number, default: 0 },
      messagesGenerated: { type: Number, default: 0 },
      autoImported: { type: Number, default: 0 },
      apiCalls: { type: Number, default: 0 },
      aiTokens: { type: Number, default: 0 },
    },
    default: {},
  })
  stats: {
    fetched: number;
    duplicates: number;
    filteredOut: number;
    aiClassified: number;
    qualified: number;
    saved: number;
    messagesGenerated: number;
    autoImported: number;
    apiCalls: number;
    aiTokens: number;
  };

  /**
   * Per-platform outcome. One source failing (missing key, rate limit) must not
   * hide what the others found, so the error is recorded here instead of thrown.
   */
  @Prop({
    type: [
      {
        platform: String,
        fetched: { type: Number, default: 0 },
        saved: { type: Number, default: 0 },
        apiCalls: { type: Number, default: 0 },
        error: String,
      },
    ],
    default: [],
  })
  perPlatform: {
    platform: string;
    fetched: number;
    saved: number;
    apiCalls: number;
    error?: string;
  }[];

  @Prop({ type: [String], default: [] })
  warnings: string[];

  @Prop()
  error: string;

  @Prop()
  triggeredBy: string;
}

export const SocialRunSchema = SchemaFactory.createForClass(SocialRun);

SocialRunSchema.index({ tenantId: 1, campaignId: 1, createdAt: -1 });
