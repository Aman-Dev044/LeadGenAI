/**
 * Contract every Leads Scrap AI source implements.
 *
 * Deliberately separate from `ILeadSourceProvider` (AI Automation): that one
 * models a *business listing* (address, phone, rating, reviews), this one models
 * a *post someone wrote* (author, body, permalink, timestamp). Forcing both
 * through one interface would leave half the fields meaningless on either side.
 */

export interface RawSocialPost {
  /** Provider-stable id used for deduplication. */
  externalId: string;
  /** Public permalink - powers the "See original" button. */
  sourceUrl: string;
  title?: string;
  body: string;
  authorHandle?: string;
  authorProfileUrl?: string;
  /** Subreddit, HN thread or Quora topic this was posted in. */
  communityName?: string;
  postedAt?: Date;
  /**
   * 'exact' when the provider returned a real timestamp (Reddit, HN).
   * 'approx' when it was derived from a relative string (Quora, SERP snippets).
   */
  dateConfidence: 'exact' | 'approx';
  engagement?: { upvotes?: number; comments?: number; views?: number };
  language?: string;
  /**
   * Country the source was asked about, when it supports geography at all.
   * A hint only - the AI decides the real country from the post's own words.
   */
  countryHint?: string;
  raw: Record<string, any>;
}

export interface SocialSearchParams {
  /** Buying-intent phrases already expanded by the qualifier. */
  queries: string[];
  /** Only return posts younger than this. */
  maxAgeDays: number;
  /** Upper bound on posts to return across all queries. */
  limit: number;
  languageCode: string;
  /**
   * ISO alpha-2 countries to target. Sources that support geography run one
   * search per entry; the rest ignore it and the country is enforced later from
   * the AI's reading of each post. Empty means "anywhere".
   */
  regionCodes: string[];
  /** Reddit only - restrict the search to these subreddits. */
  subreddits?: string[];
  /** Web only - domains for the SERP `site:` operator. */
  siteFilters?: string[];
  /**
   * The workspace's own API settings, already decrypted by the credential
   * vault. Providers prefer these over the platform's environment variables, so
   * every tenant spends its own quota.
   */
  credentials?: Record<string, string>;
}

export interface SocialSearchResult {
  posts: RawSocialPost[];
  /** Billable upstream calls made, so a run can report what it spent. */
  apiCalls: number;
  /** Non-fatal problems (partial results, rate limits, missing config). */
  warnings: string[];
}

export interface ISocialSourceProvider {
  /** Matches `SocialPostLead.source` and `SOCIAL_PLATFORMS`. */
  readonly id: string;
  readonly label: string;
  /**
   * Env var names this source needs. Surfaced in the dashboard so an admin is
   * told exactly what to set instead of seeing a silent empty result.
   */
  readonly requiredEnv: string[];
  /** One line shown in the UI when the source is unconfigured. */
  readonly setupHint: string;

  /** `credentials` are the tenant's own settings, when it has saved any. */
  isConfigured(credentials?: Record<string, string>): boolean;

  search(params: SocialSearchParams): Promise<SocialSearchResult>;

  /**
   * The exact queries a run would send, for the campaign preview screen.
   * Implemented where the wire query differs from the raw keyword (the SERP
   * sources batch and decorate them), so the preview can never drift from what
   * is actually spent.
   */
  previewQueries?(params: SocialSearchParams): string[];
}

/** Shared timeout-aware JSON fetch used by every provider. */
export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: any = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    if (!res.ok) {
      const message =
        json?.error?.message ||
        json?.message ||
        (typeof json?.error === 'string' ? json.error : '') ||
        `${res.status} ${res.statusText}`;
      const err: any = new Error(`${label}: ${message}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`${label}: request timed out`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Collapse whitespace and cap length - post bodies are only ever read as context. */
export function normalizeBody(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
