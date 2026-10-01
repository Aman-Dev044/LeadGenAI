import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SocialCampaignDocument = HydratedDocument<SocialCampaign>;

/**
 * Platforms a Leads Scrap AI campaign can sweep.
 *
 *  reddit       official Reddit Data API (free tier, credentials from env)
 *  hackernews   Algolia HN Search API (free, no key at all)
 *  quora        SERP API restricted to quora.com - Quora has no public API
 *  web          SERP API against whatever sites the campaign lists
 *  tenders      official EU/UK/Canada procurement feeds (no key needed)
 *  bluesky      AT Protocol post search (free account + app password)
 *  stackexchange Q&A search, Software Recommendations above all (key optional)
 *  github       issues and discussions, body-indexed (token optional)
 */
export const SOCIAL_PLATFORMS = [
  'reddit',
  'hackernews',
  'quora',
  'web',
  'tenders',
  'bluesky',
  'stackexchange',
  'github',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Tone presets for the AI-drafted outreach message. */
export const MESSAGE_TONES = ['helpful', 'direct', 'casual', 'formal'] as const;

/** Output language for the drafted message. `auto` mirrors the post's own language. */
export const MESSAGE_LANGUAGES = ['auto', 'en', 'hi', 'hinglish'] as const;

/**
 * A saved Leads Scrap AI campaign: which platforms to sweep, what buying-intent
 * phrases to look for, how fresh a post must be, and how the AI should judge and
 * answer it. Runs on demand or on a schedule.
 */
@Schema({ timestamps: true })
export class SocialCampaign {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  /** Which of our services this campaign is prospecting for (SERVICE_TYPES). */
  @Prop({ type: [String], default: [] })
  serviceTypes: string[];

  @Prop({ type: [String], default: ['hackernews'] })
  platforms: string[];

  /** Buying-intent phrases, e.g. "need a website", "looking for a developer". */
  @Prop({ type: [String], default: [] })
  keywords: string[];

  /** A post containing any of these is dropped before it ever reaches the AI. */
  @Prop({ type: [String], default: [] })
  negativeKeywords: string[];

  /** Reddit only - subreddits to restrict the search to. */
  @Prop({ type: [String], default: [] })
  subreddits: string[];

  /** Web only - domains for the SERP `site:` operator, e.g. "indiehackers.com". */
  @Prop({ type: [String], default: [] })
  siteFilters: string[];

  /** Raw queries the user typed themselves, passed through untouched. */
  @Prop({ type: [String], default: [] })
  extraQueries: string[];

  @Prop({ default: 'en' })
  languageCode: string;

  /**
   * ISO 3166-1 alpha-2 countries this campaign targets.
   *
   * The SERP sources run one search per country (Google's `gl`), so this
   * multiplies search spend. Reddit and Hacker News have no geography at all,
   * so for those the country is enforced afterwards from what the AI reads in
   * the post. Empty means "anywhere".
   */
  @Prop({ type: [String], default: ['IN'] })
  regionCodes: string[];

  /** Legacy single-country field, kept so existing campaigns keep working. */
  @Prop()
  regionCode: string;

  @Prop({
    type: {
      // Only posts younger than this. The whole point is catching people while
      // they are still looking.
      maxAgeDays: { type: Number, default: 7 },
      // One-liners carry no intent worth paying an AI call for.
      minBodyLength: { type: Number, default: 40 },
      excludeNsfw: { type: Boolean, default: true },
      minEngagement: { type: Number, default: 0 },
      // "[FOR HIRE]" posters are sellers competing with us, not buyers.
      excludeSellers: { type: Boolean, default: true },
      // Most posts never state where the author is. Off: keep those anyway
      // (they are still leads). On: keep only posts the AI could place in a
      // selected country.
      strictCountry: { type: Boolean, default: false },
    },
    default: {},
  })
  filters: {
    maxAgeDays: number;
    minBodyLength: number;
    excludeNsfw: boolean;
    minEngagement: number;
    excludeSellers: boolean;
    strictCountry: boolean;
  };

  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      // Below this the post is discarded instead of cluttering the review queue.
      minScore: { type: Number, default: 50 },
      generateMessage: { type: Boolean, default: true },
      messageTone: { type: String, default: 'helpful' },
      messageLanguage: { type: String, default: 'auto' },
    },
    default: {},
  })
  ai: {
    enabled: boolean;
    minScore: number;
    generateMessage: boolean;
    messageTone: string;
    messageLanguage: string;
  };

  /** Bounded by SOCIAL_PROSPECTING_MAX_RESULTS so a typo cannot burn a free quota. */
  @Prop({ default: 60 })
  maxResultsPerRun: number;

  @Prop({
    type: {
      mode: { type: String, enum: ['manual', 'daily', 'weekly'], default: 'manual' },
      hourUtc: { type: Number, default: 3 },
      dayOfWeek: { type: Number, default: 1 },
    },
    default: {},
  })
  schedule: { mode: string; hourUtc: number; dayOfWeek: number };

  @Prop({ index: true })
  nextRunAt: Date;

  /** Off by default: AI false positives should never reach the pipeline unreviewed. */
  @Prop({ default: false })
  autoImport: boolean;

  @Prop({ default: 80 })
  autoImportMinScore: number;

  @Prop({ type: String, enum: ['active', 'paused'], default: 'active', index: true })
  status: string;

  @Prop({
    type: {
      totalRuns: { type: Number, default: 0 },
      totalFound: { type: Number, default: 0 },
      totalQualified: { type: Number, default: 0 },
      totalImported: { type: Number, default: 0 },
      lastRunAt: Date,
    },
    default: {},
  })
  stats: {
    totalRuns: number;
    totalFound: number;
    totalQualified: number;
    totalImported: number;
    lastRunAt?: Date;
  };

  @Prop()
  lastError: string;

  @Prop()
  createdBy: string;

  @Prop()
  deletedAt: Date;
}

export const SocialCampaignSchema = SchemaFactory.createForClass(SocialCampaign);

SocialCampaignSchema.index({ tenantId: 1, deletedAt: 1, createdAt: -1 });
SocialCampaignSchema.index({ status: 1, nextRunAt: 1 });
