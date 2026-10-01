import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScrapingRunDocument = HydratedDocument<ScrapingRun>;

/** Audit trail for a single execution of a campaign. */
@Schema({ timestamps: true })
export class ScrapingRun {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  campaignId: string;

  @Prop({ type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true })
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
      saved: { type: Number, default: 0 },
      newListings: { type: Number, default: 0 },
      aiScored: { type: Number, default: 0 },
      autoImported: { type: Number, default: 0 },
      apiCalls: { type: Number, default: 0 },
    },
    default: {},
  })
  stats: {
    fetched: number;
    duplicates: number;
    filteredOut: number;
    saved: number;
    newListings: number;
    aiScored: number;
    autoImported: number;
    apiCalls: number;
  };

  @Prop({ type: [String], default: [] })
  warnings: string[];

  @Prop()
  error: string;

  @Prop()
  triggeredBy: string;
}

export const ScrapingRunSchema = SchemaFactory.createForClass(ScrapingRun);

ScrapingRunSchema.index({ tenantId: 1, campaignId: 1, createdAt: -1 });
