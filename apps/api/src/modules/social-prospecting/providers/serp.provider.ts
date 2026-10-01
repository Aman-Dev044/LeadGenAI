import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  fetchJson,
  ISocialSourceProvider,
  normalizeBody,
  RawSocialPost,
  SocialSearchParams,
  SocialSearchResult,
} from './social-source.interface';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generic SERP-backed source.
 *
 * Quora, Indie Hackers, public LinkedIn posts, public Facebook groups and plain
 * forums have no usable public API between them, so all of them are reached the
 * same way: a search engine query narrowed with `site:` and bounded by a date
 * window. One provider, and a new platform costs a config line rather than code.
 *
 * The free SERP tier is a few hundred searches per month, so this provider is
 * deliberately stingy: `SERP_MAX_SEARCHES_PER_RUN` caps how many searches a
 * single run may spend, and every skipped query is reported as a warning rather
 * than silently dropped.
 *
 * Dates are `approx` on purpose - a SERP snippet gives "3 weeks ago", never a
 * real timestamp, and the dashboard marks those with a "~".
 */
@Injectable()
export class SerpProvider implements ISocialSourceProvider {
  readonly id: string = 'web';
  readonly label: string = 'Web (any site)';
  readonly requiredEnv = ['SERPAPI_API_KEY'];
  readonly setupHint =
    'Add SERPAPI_API_KEY to the API environment. The free plan covers a few hundred ' +
    'searches per month, which is why each run is capped by SERP_MAX_SEARCHES_PER_RUN.';

  protected readonly logger = new Logger(SerpProvider.name);

  /** Subclasses pin this to force a platform, e.g. Quora. */
  protected readonly fixedSites: string[] = [];

  constructor(protected readonly configService: ConfigService) {}

  protected cfg<T>(key: string): T | undefined {
    return this.configService.get<T>(`socialProspecting.serp.${key}`);
  }

  /**
   * A tenant's own SERP settings win over the platform's, field by field, so a
   * workspace spends its own quota at its own limits.
   */
  protected setting(key: string, credentials?: Record<string, string>): string | undefined {
    const own = credentials?.[key];
    if (own !== undefined && own !== '') return own;
    const platform = this.cfg<string | number>(key);
    return platform === undefined || platform === '' ? undefined : String(platform);
  }

  protected numericSetting(
    key: string,
    credentials: Record<string, string> | undefined,
    fallback: number,
  ): number {
    const num = Number(this.setting(key, credentials));
    return Number.isFinite(num) && num > 0 ? num : fallback;
  }

  protected get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  isConfigured(credentials?: Record<string, string>): boolean {
    return !!this.setting('apiKey', credentials);
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const creds = params.credentials;
    if (!this.isConfigured(creds)) {
      return { posts, apiCalls, warnings: [`${this.label} is not configured - skipped.`] };
    }

    const sites = this.fixedSites.length ? this.fixedSites : params.siteFilters || [];
    const queries = this.buildQueries(params.queries, sites, creds);
    // One search per country: `gl` takes a single region, and it is the only
    // real geographic filter any of these sources offers.
    const regions = params.regionCodes?.length ? params.regionCodes : [''];

    const plan: { query: string; region: string }[] = [];
    for (const query of queries) {
      for (const region of regions) plan.push({ query, region });
    }

    const budget = Math.max(1, this.numericSetting('maxSearchesPerRun', creds, 6));
    const planned = plan.length;
    const toRun = plan.slice(0, budget);
    const perSearchKeywords = Math.max(1, this.numericSetting('keywordsPerSearch', creds, 5));
    if (planned > toRun.length) {
      const multiCountry = params.regionCodes?.length ? params.regionCodes.length > 1 : false;
      const reached = new Set(toRun.map((t) => t.region)).size;
      // Only talk about countries when more than one is in play, otherwise the
      // sentence reads like "each of the 1 selected countries".
      const countryNote = multiCountry
        ? ` Each of the ${regions.length} selected countries needs its own search, so only ` +
          `${reached} of them ${reached === 1 ? 'was' : 'were'} reached - pick fewer countries,`
        : '';
      warnings.push(
        `${this.label}: ran ${toRun.length} of ${planned} searches to stay inside the free SERP quota ` +
          `(SERP_MAX_SEARCHES_PER_RUN=${budget}). Phrases are batched ${perSearchKeywords} per search.` +
          `${countryNote}${multiCountry ? ' trim' : ' Trim'} keywords, drop a site, or raise the cap.`,
      );
    }

    const cutoff = Date.now() - params.maxAgeDays * DAY_MS;
    const perSearch = this.numericSetting('resultsPerSearch', creds, 20);

    for (const { query, region } of toRun) {
      if (posts.length >= params.limit) break;

      const search = new URLSearchParams({
        engine: this.setting('engine', creds) || 'google',
        q: query,
        api_key: this.setting('apiKey', creds) as string,
        num: String(perSearch),
        hl: params.languageCode || 'en',
        tbs: this.dateRestrictFor(params.maxAgeDays),
      });
      // Omitted entirely when the campaign targets no country, so Google is not
      // nudged towards an arbitrary default.
      if (region) search.set('gl', region.toLowerCase());

      const url =
        `${this.setting('baseUrl', creds) || 'https://serpapi.com/search.json'}?${search.toString()}`;

      try {
        const json = await fetchJson(url, { method: 'GET' }, this.timeoutMs, this.label);
        apiCalls++;

        // SerpApi reports query-level problems in the body, not the status code.
        if (json?.error) {
          // Usually "no results", which just means this phrase batch is too
          // narrow for this site - not a failure worth alarming anyone about.
          warnings.push(
            /returned any results|no results/i.test(String(json.error))
              ? `${this.label}: no matches for one phrase batch on this site - try broader keywords ` +
                  `or a longer time window.`
              : `${this.label}: ${json.error}`,
          );
          continue;
        }

        for (const result of json?.organic_results || []) {
          if (posts.length >= params.limit) break;
          const post = this.mapResult(result, sites, region);
          if (!post || seen.has(post.externalId)) continue;
          // Snippet dates are fuzzy; only drop a post when we are confident it is old.
          if (post.postedAt && post.postedAt.getTime() < cutoff - DAY_MS) continue;
          seen.add(post.externalId);
          posts.push(post);
        }
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          warnings.push(`${this.label}: API key rejected - check SERPAPI_API_KEY.`);
          break;
        }
        if (err?.status === 429) {
          warnings.push(`${this.label}: monthly SERP quota exhausted - partial results.`);
          break;
        }
        this.logger.warn(`SERP query "${query}" failed: ${err?.message}`);
        warnings.push(`${this.label} query failed: ${err?.message}`);
      }
    }

    return { posts, apiCalls, warnings: collapseRepeats(warnings) };
  }

  /**
   * `site:` narrows the platform. Recency is left to Google's own `tbs=qdr:`
   * filter (applied in `search`) rather than an `after:` operator: Google
   * publishes no date for most Q&A pages, and `after:` excludes a page it
   * cannot date, which silently empties the result set.
   *
   * Phrases are OR-batched so one paid search covers several keywords. A
   * campaign carrying 37 keywords would otherwise need 37 searches - more than
   * a month of the free quota for a single run.
   */
  buildQueries(
    queries: string[],
    sites: string[],
    credentials?: Record<string, string>,
  ): string[] {
    const perSearch = Math.max(1, this.numericSetting('keywordsPerSearch', credentials, 5));

    const groups: string[][] = [];
    for (let i = 0; i < queries.length; i += perSearch) {
      groups.push(queries.slice(i, i + perSearch));
    }

    const built: string[] = [];
    for (const group of groups) {
      const phrases = group.map((q) => (q.includes('"') ? q : `"${q}"`)).join(' OR ');
      const clause = group.length > 1 ? `(${phrases})` : phrases;
      if (!sites.length) {
        built.push(clause);
        continue;
      }
      // Sites interleave with groups, so a truncated budget still covers each site.
      for (const site of sites) {
        built.push(`site:${site.replace(/^https?:\/\//, '')} ${clause}`);
      }
    }
    return built;
  }

  /** The exact queries a run would send - used by the campaign preview screen. */
  previewQueries(params: SocialSearchParams): string[] {
    const sites = this.fixedSites.length ? this.fixedSites : params.siteFilters || [];
    return this.buildQueries(params.queries, sites, params.credentials);
  }

  /** Google's own recency filter - the only date bound we apply. */
  protected dateRestrictFor(maxAgeDays: number): string {
    if (maxAgeDays <= 1) return 'qdr:d';
    if (maxAgeDays <= 7) return 'qdr:w';
    if (maxAgeDays <= 31) return 'qdr:m';
    return 'qdr:y';
  }

  protected mapResult(result: any, sites: string[], region?: string): RawSocialPost | null {
    const link: string = result?.link || '';
    if (!link) return null;

    const title = typeof result.title === 'string' ? result.title.trim() : '';
    const snippet = normalizeBody(result.snippet || result.snippet_highlighted_words?.join(' ') || '');
    if (!title && !snippet) return null;

    let host = '';
    try {
      host = new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }

    const postedAt = parseSerpDate(result.date);

    return {
      // SERP gives no stable id, so the URL is the identity.
      externalId: `serp_${createHash('sha1').update(link).digest('hex').slice(0, 24)}`,
      sourceUrl: link,
      title: title || undefined,
      // A snippet is all we get; the AI is told to judge only what it can see.
      body: snippet || title,
      authorHandle: undefined,
      communityName: sites.length ? host : host,
      postedAt,
      // Snippet dates are relative strings at best.
      dateConfidence: 'approx',
      // The country Google was asked about - a hint, not proof of where the
      // author lives, so the AI still gets the final say.
      countryHint: region || undefined,
      engagement: {},
      raw: { source: result.source, displayedLink: result.displayed_link, date: result.date },
    };
  }
}

/**
 * Quora, pinned to quora.com. Quora publishes no API and its terms forbid direct
 * scraping, so search results are the only defensible way in.
 */
@Injectable()
export class QuoraSerpProvider extends SerpProvider {
  readonly id = 'quora';
  readonly label = 'Quora';
  protected readonly fixedSites = ['quora.com'];
  readonly setupHint =
    'Quora has no public API, so it is read through the SERP source. ' +
    'Add SERPAPI_API_KEY to the API environment (free plan: ~100 searches/month).';

  constructor(configService: ConfigService) {
    super(configService);
  }
}

/** "x3" beats the same sentence printed three times in a run's warning list. */
function collapseRepeats(warnings: string[]): string[] {
  const counts = new Map<string, number>();
  for (const w of warnings) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()].map(([text, n]) => (n > 1 ? `${text} (x${n})` : text));
}

/**
 * Turns whatever a SERP snippet says about recency into a date.
 * Handles "3 days ago", "2 weeks ago" and absolute dates like "Jan 5, 2026".
 */
function parseSerpDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();

  const relative = raw.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/i);
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const unitMs: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: DAY_MS,
      week: 7 * DAY_MS,
      month: 30 * DAY_MS,
      year: 365 * DAY_MS,
    };
    const ms = unitMs[relative[2].toLowerCase()];
    if (ms) return new Date(Date.now() - amount * ms);
  }

  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) return new Date(parsed);
  return undefined;
}
