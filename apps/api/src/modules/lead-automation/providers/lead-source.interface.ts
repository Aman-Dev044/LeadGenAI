/**
 * Contract every prospecting source implements. Keeping Google Maps behind this
 * interface means a second source (a scraper API, a forum, a directory) only has
 * to add a file - the campaign engine never changes.
 */

export interface RawProspectReview {
  author?: string;
  text?: string;
  rating?: number;
  publishedAt?: Date;
  /** Deep link to the review itself, so a salesperson can read it in context. */
  url?: string;
}

export interface RawProspect {
  /** Provider-stable id used for deduplication (Google place id). */
  externalId: string;
  /** Public page this record came from - powers the "See original" button. */
  sourceUrl: string;
  businessName: string;
  category?: string;
  categories?: string[];
  phone?: string;
  website?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  /** ISO 3166-1 alpha-2, the only reliable way to filter by country. */
  countryCode?: string;
  postalCode?: string;
  location?: { lat?: number; lng?: number };
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  reviewSamples?: RawProspectReview[];
  oldestReviewAt?: Date;
  newestReviewAt?: Date;
  raw: Record<string, any>;
}

export interface LeadSourceSearchParams {
  query: string;
  languageCode: string;
  regionCode: string;
  /** Upper bound on prospects to return for this query. */
  limit: number;
}

export interface LeadSourceSearchResult {
  prospects: RawProspect[];
  apiCalls: number;
  warnings: string[];
}

export interface ILeadSourceProvider {
  /** Matches `ScrapedLead.source`. */
  readonly id: string;
  readonly label: string;

  /** False when the required API key is missing - the UI surfaces this. */
  isConfigured(): boolean;

  search(params: LeadSourceSearchParams): Promise<LeadSourceSearchResult>;

  /**
   * Second pass that fills in review history for the prospects that survived the
   * cheap filters. Split from `search` because review data is billed at a higher
   * tier, so we only pay for it on real candidates. Mutates the prospects.
   */
  enrichReviews(
    prospects: RawProspect[],
    languageCode: string,
  ): Promise<{ apiCalls: number; warnings: string[] }>;
}

export const LEAD_SOURCE_PROVIDERS = 'LEAD_SOURCE_PROVIDERS';
