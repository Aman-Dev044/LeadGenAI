import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScrapedLeadDocument = HydratedDocument<ScrapedLead>;

/**
 * One prospect discovered by a scraping campaign, held in a review queue before
 * it is promoted into the real Leads pipeline.
 *
 * `sourceUrl` always points at the public page the data came from (the business'
 * Google Maps listing) so the salesperson can verify the prospect is real before
 * reaching out - that is what the dashboard's "See original" button opens.
 */
@Schema({ timestamps: true })
export class ScrapedLead {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  campaignId: string;

  @Prop({ index: true })
  runId: string;

  @Prop({ default: 'google_maps' })
  source: string;

  /** Provider's stable id for this record (Google place id) - used for dedupe. */
  @Prop({ required: true })
  externalId: string;

  /** Public page this prospect was found on. Shown as "See original". */
  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ required: true, trim: true })
  businessName: string;

  @Prop()
  category: string;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop()
  phone: string;

  @Prop()
  website: string;

  @Prop()
  email: string;

  @Prop()
  address: string;

  @Prop()
  city: string;

  @Prop()
  state: string;

  @Prop()
  country: string;

  @Prop()
  postalCode: string;

  @Prop({ type: { lat: Number, lng: Number }, default: {} })
  location: { lat?: number; lng?: number };

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop()
  businessStatus: string;

  /** Earliest review Google exposes - our best proxy for when the listing went live. */
  @Prop()
  oldestReviewAt: Date;

  @Prop()
  newestReviewAt: Date;

  /**
   * A few public reviews, each with its own deep link. Useful proof of what real
   * customers are saying (and complaining about) before an outreach call.
   */
  @Prop({
    type: [
      {
        author: String,
        text: String,
        rating: Number,
        publishedAt: Date,
        url: String,
      },
    ],
    default: [],
  })
  reviewSamples: {
    author?: string;
    text?: string;
    rating?: number;
    publishedAt?: Date;
    url?: string;
  }[];

  /** True when the filters believe this is a recently created listing. */
  @Prop({ default: false, index: true })
  isNewListing: boolean;

  /** Human-readable reasons behind `isNewListing`, e.g. "only 3 reviews". */
  @Prop({ type: [String], default: [] })
  newListingSignals: string[];

  /** When this tenant first saw this place - the delta that makes "new" reliable. */
  @Prop()
  firstSeenAt: Date;

  @Prop({
    type: {
      score: { type: Number, default: 0 },
      temperature: { type: String, default: 'cold' },
      fitReason: String,
      recommendedService: String,
      painPoints: { type: [String], default: [] },
      outreachMessage: String,
      generatedAt: Date,
    },
    default: {},
  })
  ai: {
    score: number;
    temperature: string;
    fitReason?: string;
    recommendedService?: string;
    painPoints?: string[];
    outreachMessage?: string;
    generatedAt?: Date;
  };

  @Prop({
    type: String,
    enum: ['new', 'reviewed', 'imported', 'rejected'],
    default: 'new',
    index: true,
  })
  status: string;

  /** Set once promoted into the Leads pipeline. */
  @Prop()
  importedLeadId: string;

  @Prop()
  importedAt: Date;

  @Prop()
  reviewedBy: string;

  @Prop()
  reviewedAt: Date;

  @Prop()
  rejectedReason: string;

  /** Untouched provider payload, kept for debugging and future re-parsing. */
  @Prop({ type: Object, default: {} })
  raw: Record<string, any>;
}

export const ScrapedLeadSchema = SchemaFactory.createForClass(ScrapedLead);

// One record per place per campaign - makes repeat runs idempotent.
ScrapedLeadSchema.index({ tenantId: 1, campaignId: 1, externalId: 1 }, { unique: true });
ScrapedLeadSchema.index({ tenantId: 1, status: 1, 'ai.score': -1 });
ScrapedLeadSchema.index({ tenantId: 1, externalId: 1 });
ScrapedLeadSchema.index({ campaignId: 1, createdAt: -1 });
