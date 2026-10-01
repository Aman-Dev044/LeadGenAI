import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fetchJson,
  ISocialSourceProvider,
  normalizeBody,
  RawSocialPost,
  SocialSearchParams,
  SocialSearchResult,
} from './social-source.interface';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LIMIT_PER_CALL = 100;
/** Tokens last an hour; refresh a little early so a long run never trips over expiry. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * Reddit via the official Data API.
 *
 * Credentials come from env only (`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` /
 * `REDDIT_USER_AGENT`) - nothing is hardcoded and nothing is committed. Reddit's
 * free tier is 100 queries/minute and is licensed for NON-COMMERCIAL use, which
 * is why the dashboard tells an admin to register their own app rather than
 * shipping a shared one.
 *
 * Only link posts are fetched: Reddit's search does not index comments reliably
 * and Pushshift is no longer public. `[HIRING]`-style posts are the valuable
 * ones anyway.
 */
@Injectable()
export class RedditProvider implements ISocialSourceProvider {
  readonly id = 'reddit';
  readonly label = 'Reddit';
  readonly requiredEnv = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USER_AGENT'];
  readonly setupHint =
    'Create a "script" app at reddit.com/prefs/apps, then set REDDIT_CLIENT_ID, ' +
    'REDDIT_CLIENT_SECRET and a descriptive REDDIT_USER_AGENT in the API environment. ' +
    "Reddit's free tier is licensed for non-commercial use.";

  private readonly logger = new Logger(RedditProvider.name);

  /**
   * Cached app-only access tokens, keyed by client id so two workspaces never
   * share one. Reddit rate-limits token minting as well as reads.
   */
  private readonly tokens = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {}

  private cfg<T>(key: string): T | undefined {
    return this.configService.get<T>(`socialProspecting.reddit.${key}`);
  }

  /** The tenant's own app, falling back to the platform's for each field. */
  private settings(credentials?: Record<string, string>) {
    return {
      clientId: credentials?.clientId || this.cfg<string>('clientId') || '',
      clientSecret: credentials?.clientSecret || this.cfg<string>('clientSecret') || '',
      userAgent: credentials?.userAgent || this.cfg<string>('userAgent') || '',
      tokenUrl:
        credentials?.tokenUrl ||
        this.cfg<string>('tokenUrl') ||
        'https://www.reddit.com/api/v1/access_token',
      apiBaseUrl:
        credentials?.apiBaseUrl || this.cfg<string>('apiBaseUrl') || 'https://oauth.reddit.com',
    };
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  isConfigured(credentials?: Record<string, string>): boolean {
    const s = this.settings(credentials);
    return !!(s.clientId && s.clientSecret && s.userAgent);
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const settings = this.settings(params.credentials);
    if (!this.isConfigured(params.credentials)) {
      return { posts, apiCalls, warnings: ['Reddit is not configured - skipped.'] };
    }

    let token: string;
    try {
      token = await this.getToken(settings);
    } catch (err: any) {
      return { posts, apiCalls: 1, warnings: [`Reddit authentication failed: ${err?.message}`] };
    }

    const timeWindow = this.timeWindowFor(params.maxAgeDays);
    const cutoff = Date.now() - params.maxAgeDays * DAY_MS;
    const subreddits = (params.subreddits || []).map((s) => s.replace(/^\/?r\//i, '').trim()).filter(Boolean);

    // Each (query x subreddit) pair is one call, so budget across the whole grid.
    const targets: { query: string; subreddit?: string }[] = [];
    for (const query of params.queries) {
      if (subreddits.length) {
        for (const subreddit of subreddits) targets.push({ query, subreddit });
      } else {
        targets.push({ query });
      }
    }

    const perTarget = Math.max(10, Math.ceil(params.limit / Math.max(1, targets.length)));

    for (const target of targets) {
      if (posts.length >= params.limit) break;

      const base = settings.apiBaseUrl;
      const search = new URLSearchParams({
        q: target.query,
        sort: 'new',
        t: timeWindow,
        limit: String(Math.min(perTarget, MAX_LIMIT_PER_CALL)),
        type: 'link',
        raw_json: '1',
      });
      if (target.subreddit) search.set('restrict_sr', '1');

      const url = target.subreddit
        ? `${base}/r/${encodeURIComponent(target.subreddit)}/search?${search}`
        : `${base}/search?${search}`;

      try {
        const json = await fetchJson(
          url,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': settings.userAgent,
            },
          },
          this.timeoutMs,
          'Reddit',
        );
        apiCalls++;

        for (const child of json?.data?.children || []) {
          if (posts.length >= params.limit) break;
          const post = this.mapPost(child?.data, params);
          if (!post || seen.has(post.externalId)) continue;
          // Reddit's `t` windows are coarse (day/week/month) - enforce the exact cutoff here.
          if (post.postedAt && post.postedAt.getTime() < cutoff) continue;
          seen.add(post.externalId);
          posts.push(post);
        }
      } catch (err: any) {
        const where = target.subreddit ? `r/${target.subreddit}` : 'all of Reddit';
        if (err?.status === 429) {
          warnings.push(`Reddit rate limit hit while searching ${where} - partial results.`);
          break; // Backing off entirely beats hammering a 429.
        }
        this.logger.warn(`Reddit search failed (${where}): ${err?.message}`);
        warnings.push(`Reddit search failed on ${where}: ${err?.message}`);
      }
    }

    return { posts, apiCalls, warnings };
  }

  /** App-only OAuth token, cached per client id. */
  private async getToken(settings: ReturnType<RedditProvider['settings']>): Promise<string> {
    const cached = this.tokens.get(settings.clientId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');

    const json = await fetchJson(
      settings.tokenUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': settings.userAgent,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      },
      this.timeoutMs,
      'Reddit auth',
    );

    const value = json?.access_token;
    if (!value) throw new Error('no access_token in response');

    this.tokens.set(settings.clientId, { value, expiresAt: Date.now() + TOKEN_TTL_MS });
    return value;
  }

  /** Reddit only accepts fixed search windows; pick the smallest that covers the range. */
  private timeWindowFor(maxAgeDays: number): string {
    if (maxAgeDays <= 1) return 'day';
    if (maxAgeDays <= 7) return 'week';
    if (maxAgeDays <= 31) return 'month';
    if (maxAgeDays <= 365) return 'year';
    return 'all';
  }

  private mapPost(data: any, params: SocialSearchParams): RawSocialPost | null {
    const id = data?.name || (data?.id ? `t3_${data.id}` : '');
    if (!id) return null;
    if (data.over_18 && params.maxAgeDays >= 0) {
      // NSFW filtering is a campaign filter, but a flagged post is never worth an AI call.
      if (data.over_18 === true) return null;
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const body = normalizeBody(data.selftext);
    // Link-only posts still carry intent in the title.
    if (!title && !body) return null;

    const permalink = data.permalink
      ? `https://www.reddit.com${data.permalink}`
      : data.url || '';
    if (!permalink) return null;

    return {
      externalId: String(id),
      sourceUrl: permalink,
      title: title || undefined,
      body: body || title,
      authorHandle: data.author && data.author !== '[deleted]' ? data.author : undefined,
      authorProfileUrl: data.author ? `https://www.reddit.com/user/${data.author}` : undefined,
      communityName: data.subreddit_name_prefixed || (data.subreddit ? `r/${data.subreddit}` : undefined),
      postedAt: data.created_utc ? new Date(data.created_utc * 1000) : undefined,
      // Reddit returns a real epoch.
      dateConfidence: 'exact',
      engagement: {
        upvotes: typeof data.score === 'number' ? data.score : 0,
        comments: typeof data.num_comments === 'number' ? data.num_comments : 0,
      },
      raw: {
        flair: data.link_flair_text,
        subreddit: data.subreddit,
        over18: data.over_18,
        url: data.url,
      },
    };
  }
}
