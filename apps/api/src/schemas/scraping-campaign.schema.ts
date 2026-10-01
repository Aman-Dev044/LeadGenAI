import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScrapingCampaignDocument = HydratedDocument<ScrapingCampaign>;

/** Services the tenant sells - used to build search queries and to judge business fit. */
export const SERVICE_TYPES = [
  'website',
  'ecommerce',
  'mobile_app',
  'ios_app',
  'android_app',
  'erp_system',
  'crm',
  'custom_software',
  'ai_chatbot',
  'llm_application',
  'automation',
  'seo_marketing',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * A saved Google Maps prospecting campaign. One campaign = a set of business
 * categories x locations, plus the "is this a new listing?" filters, run either
 * on demand or on a schedule.
 */
@Schema({ timestamps: true })
export class ScrapingCampaign {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  /** Which of our services this campaign is prospecting for. */
  @Prop({ type: [String], default: [] })
  serviceTypes: string[];

  /** Google Maps business categories to search, e.g. "gym", "dental clinic". */
  @Prop({ type: [String], default: [] })
  businessCategories: string[];

  /** Free-text locations, e.g. "Jaipur, Rajasthan". */
  @Prop({ type: [String], default: [] })
  locations: string[];

  /** Optional extra raw queries the user typed themselves. */
  @Prop({ type: [String], default: [] })
  extraQueries: string[];

  @Prop({ default: 'en' })
  languageCode: string;

  /** ISO 3166-1 alpha-2, biases results, e.g. "IN". */
  @Prop({ default: 'IN' })
  regionCode: string;

  @Prop({
    type: {
      // Only keep places this campaign has never seen before (first-seen delta).
      onlyNewListings: { type: Boolean, default: true },
      // Newly listed businesses have few reviews. 0 disables the check.
      maxReviewCount: { type: Number, default: 15 },
      // Listing looks new when its oldest visible review is younger than this. 0 disables.
      newListingMaxAgeDays: { type: Number, default: 365 },
      // The strongest buying signal for web/app work.
      requireNoWebsite: { type: Boolean, default: false },
      requirePhone: { type: Boolean, default: true },
      minRating: { type: Number, default: 0 },
      // Skip permanently closed / temporarily closed places.
      operationalOnly: { type: Boolean, default: true },
    },
    default: {},
  })
  filters: {
    onlyNewListings: boolean;
    maxReviewCount: number;
    newListingMaxAgeDays: number;
    requireNoWebsite: boolean;
    requirePhone: boolean;
    minRating: number;
    operationalOnly: boolean;
  };

  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      // Discard results the AI scores below this.
      minScore: { type: Number, default: 40 },
      generateOutreach: { type: Boolean, default: true },
    },
    default: {},
  })
  aiQualification: {
    enabled: boolean;
    minScore: number;
    generateOutreach: boolean;
  };

  @Prop({
    type: {
      mode: { type: String, enum: ['manual', 'daily', 'weekly'], default: 'manual' },
      // 0-23, UTC.
      hourUtc: { type: Number, default: 3 },
      // 0 = Sunday, only used by "weekly".
      dayOfWeek: { type: Number, default: 1 },
    },
    default: {},
  })
  schedule: {
    mode: 'manual' | 'daily' | 'weekly';
    hourUtc: number;
    dayOfWeek: number;
  };

  @Prop({ default: 60 })
  maxResultsPerRun: number;

  /** Push qualified results straight into Leads instead of the review queue. */
  @Prop({ default: false })
  autoImport: boolean;

  @Prop({ type: String, enum: ['active', 'paused'], default: 'active' })
  status: string;

  @Prop()
  lastRunAt: Date;

  @Prop({ index: true })
  nextRunAt: Date;

  @Prop({
    type: {
      totalRuns: { type: Number, default: 0 },
      totalFound: { type: Number, default: 0 },
      totalNew: { type: Number, default: 0 },
      totalImported: { type: Number, default: 0 },
    },
    default: {},
  })
  stats: {
    totalRuns: number;
    totalFound: number;
    totalNew: number;
    totalImported: number;
  };

  @Prop()
  lastError: string;

  @Prop()
  createdBy: string;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ScrapingCampaignSchema = SchemaFactory.createForClass(ScrapingCampaign);

ScrapingCampaignSchema.index({ tenantId: 1, status: 1 });
ScrapingCampaignSchema.index({ status: 1, nextRunAt: 1 });
