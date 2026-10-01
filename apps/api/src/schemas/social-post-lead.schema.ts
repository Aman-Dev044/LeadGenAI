import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SocialPostLeadDocument = HydratedDocument<SocialPostLead>;

/** What the AI decided the author is actually doing in the post. */
export const POST_INTENTS = [
  'buying',
  'researching',
  'hiring',
  'complaining',
  'offering',
  'irrelevant',
] as const;

/** Where a drafted reply is meant to go. Nothing is sent automatically. */
export const OUTREACH_CHANNELS = [
  'reddit_comment',
  'reddit_dm',
  'quora_answer',
  'hn_reply',
  'email',
  'manual',
] as const;

/**
 * One social post discovered by a Leads Scrap AI campaign, parked in a review
 * queue before anyone acts on it.
 *
 * `sourceUrl` is always the public permalink, so a salesperson can read the post
 * in its own thread before replying - that is what "See original" opens.
 */
@Schema({ timestamps: true })
export class SocialPostLead {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  campaignId: string;

  @Prop({ index: true })
  runId: string;

  /** Matches SOCIAL_PLATFORMS. */
  @Prop({ required: true, index: true })
  source: string;

  /** Provider-stable id (Reddit t3_xxx, HN objectID, hashed URL for SERP) - dedupe key. */
  @Prop({ required: true })
  externalId: string;

  /** Public permalink. Shown as "See original". */
  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ trim: true })
  title: string;

  /** Post body, truncated on write - we never need the full essay. */
  @Prop({ trim: true })
  body: string;

  @Prop({ index: true })
  authorHandle: string;

  @Prop()
  authorProfileUrl: string;

  /** Subreddit, HN thread title or Quora topic the post lives in. */
  @Prop()
  communityName: string;

  /** When the post was written - the queue sorts on this by default. */
  @Prop({ index: true })
  postedAt: Date;

  /**
   * Reddit and HN return a real timestamp; Quora and SERP results only expose a
   * relative date ("3 months ago"), so the UI marks those with a "~".
   */
  @Prop({ type: String, enum: ['exact', 'approx'], default: 'approx' })
  dateConfidence: string;

  @Prop({
    type: {
      upvotes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
    },
    default: {},
  })
  engagement: { upvotes?: number; comments?: number; views?: number };

  @Prop()
  language: string;

  /** ISO alpha-2 the AI inferred from the post, or empty when it could not tell. */
  @Prop({ index: true })
  country: string;

  /** The place the post actually names, e.g. "Jaipur, Rajasthan". */
  @Prop()
  locationText: string;

  @Prop({
    type: {
      // The gate that matters: is the author asking to buy something we sell?
      isLead: { type: Boolean, default: false },
      score: { type: Number, default: 0 },
      temperature: { type: String, default: 'cold' },
      intent: { type: String, default: 'irrelevant' },
      needSummary: String,
      wantedServices: { type: [String], default: [] },
      recommendedService: String,
      budgetHint: String,
      urgency: { type: String, default: 'low' },
      painPoints: { type: [String], default: [] },
      rejectReason: String,
      generatedAt: Date,
    },
    default: {},
  })
  ai: {
    isLead: boolean;
    score: number;
    temperature: string;
    intent: string;
    needSummary?: string;
    wantedServices?: string[];
    recommendedService?: string;
    budgetHint?: string;
    urgency?: string;
    painPoints?: string[];
    rejectReason?: string;
    generatedAt?: Date;
  };

  /**
   * AI-drafted reply. Drafted only - `sendStatus` never becomes 'sent' on its own,
   * a human copies it out and posts it themselves.
   */
  @Prop({
    type: {
      message: String,
      subject: String,
      channel: { type: String, default: 'manual' },
      generatedAt: Date,
      editedBody: String,
      sentAt: Date,
      sentBy: String,
      sendStatus: { type: String, enum: ['draft', 'copied', 'sent', 'failed'], default: 'draft' },
    },
    default: {},
  })
  outreach: {
    message?: string;
    subject?: string;
    channel?: string;
    generatedAt?: Date;
    editedBody?: string;
    sentAt?: Date;
    sentBy?: string;
    sendStatus?: string;
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

export const SocialPostLeadSchema = SchemaFactory.createForClass(SocialPostLead);

// One record per post per campaign - makes repeat runs idempotent.
SocialPostLeadSchema.index({ tenantId: 1, campaignId: 1, externalId: 1 }, { unique: true });
// Default queue ordering: freshest posts first.
SocialPostLeadSchema.index({ tenantId: 1, postedAt: -1 });
SocialPostLeadSchema.index({ tenantId: 1, status: 1, 'ai.score': -1 });
// Stops the same person surfacing from two platforms in the same campaign.
SocialPostLeadSchema.index({ tenantId: 1, source: 1, authorHandle: 1 });
SocialPostLeadSchema.index({ campaignId: 1, createdAt: -1 });
