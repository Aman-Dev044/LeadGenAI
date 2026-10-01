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

/**
 * Stack Exchange sites worth sweeping. Software Recommendations is the reason
 * this source exists: every question on it is literally someone asking which
 * tool to buy or build.
 */
const DEFAULT_SITES = ['softwarerecs', 'webmasters', 'serverfault'];

/**
 * Stack Exchange question search.
 *
 * Works with no key at all (a small shared daily quota); a free key from
 * stackapps.com raises it to 10,000 requests a day. The API always gzips, and
 * `quota_remaining` comes back on every response so the run can warn before the
 * allowance is gone.
 */
@Injectable()
export class StackExchangeProvider implements ISocialSourceProvider {
  readonly id = 'stackexchange';
  readonly label = 'Stack Exchange';
  readonly requiredEnv: string[] = [];
  readonly setupHint =
    'Works with no key on a small shared quota. Register a free app at stackapps.com for ' +
    '10,000 requests a day.';

  private readonly logger = new Logger(StackExchangeProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private cfg<T>(key: string): T | undefined {
    return this.configService.get<T>(`socialProspecting.stackExchange.${key}`);
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  private settings(credentials?: Record<string, string>) {
    const rawSites = credentials?.sites || this.cfg<string>('sites') || '';
    const sites = rawSites
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      apiKey: credentials?.apiKey || this.cfg<string>('apiKey') || '',
      baseUrl: credentials?.baseUrl || this.cfg<string>('baseUrl') || 'https://api.stackexchange.com/2.3',
      sites: sites.length ? sites : DEFAULT_SITES,
    };
  }

  /** Usable without credentials, just on a smaller allowance. */
  isConfigured(): boolean {
    return true;
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const settings = this.settings(params.credentials);
    const fromDate = Math.floor((Date.now() - params.maxAgeDays * DAY_MS) / 1000);
    // Every (query x site) pair is one request against a small daily quota.
    const perPair = Math.max(
      5,
      Math.ceil(params.limit / Math.max(1, params.queries.length * settings.sites.length)),
    );

    for (const site of settings.sites) {
      for (const query of params.queries) {
        if (posts.length >= params.limit) break;

        const search = new URLSearchParams({
          order: 'desc',
          sort: 'creation',
          q: query,
          site,
          fromdate: String(fromDate),
          pagesize: String(Math.min(perPair, 100)),
          // `withbody` is the only filter that returns the question text.
          filter: 'withbody',
        });
        if (settings.apiKey) search.set('key', settings.apiKey);

        try {
          const json = await fetchJson(
            `${settings.baseUrl}/search/advanced?${search.toString()}`,
            { method: 'GET', headers: { Accept: 'application/json' } },
            this.timeoutMs,
            'Stack Exchange',
          );
          apiCalls++;

          if (typeof json?.quota_remaining === 'number' && json.quota_remaining < 20) {
            warnings.push(
              `Stack Exchange quota is nearly gone (${json.quota_remaining} left today). ` +
                'Add a free key from stackapps.com to raise it to 10,000/day.',
            );
          }

          for (const item of json?.items || []) {
            if (posts.length >= params.limit) break;
            const mapped = this.mapItem(item, site);
            if (!mapped || seen.has(mapped.externalId)) continue;
            seen.add(mapped.externalId);
            posts.push(mapped);
          }
        } catch (err: any) {
          if (err?.status === 400 || err?.status === 502) {
            warnings.push(`Stack Exchange: "${site}" is not a valid site id.`);
            break;
          }
          this.logger.warn(`Stack Exchange ${site}/"${query}" failed: ${err?.message}`);
          warnings.push(`Stack Exchange query failed on ${site}: ${err?.message}`);
        }
      }
    }

    return { posts, apiCalls, warnings };
  }

  private mapItem(item: any, site: string): RawSocialPost | null {
    const id = item?.question_id;
    if (!id) return null;

    const title: string = decodeEntities(item.title || '');
    const body = normalizeBody(stripHtml(item.body || ''));
    if (!title && !body) return null;

    return {
      externalId: `se_${site}_${id}`,
      sourceUrl: item.link || `https://${site}.stackexchange.com/q/${id}`,
      title,
      body: body || title,
      authorHandle: item?.owner?.display_name,
      authorProfileUrl: item?.owner?.link,
      communityName: `${site}.stackexchange.com`,
      postedAt: item.creation_date ? new Date(item.creation_date * 1000) : undefined,
      // The API returns real unix timestamps.
      dateConfidence: 'exact',
      engagement: {
        upvotes: item.score || 0,
        comments: item.answer_count || 0,
        views: item.view_count || 0,
      },
      raw: { tags: item.tags, isAnswered: item.is_answered, site },
    };
  }
}

/** Question bodies come back as HTML; the AI only needs the prose. */
function stripHtml(value: string): string {
  return decodeEntities(
    String(value || '')
      .replace(/<(pre|code)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+([,.!?;:])/g, '$1');
}

function decodeEntities(value: string): string {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
