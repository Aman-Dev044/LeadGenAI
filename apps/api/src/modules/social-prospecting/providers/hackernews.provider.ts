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
const MAX_HITS_PER_PAGE = 100;

/**
 * Hacker News via Algolia's public search index.
 *
 * The only source here that needs no key and no account at all, which is why the
 * pipeline was built against it first: a campaign can be proven end to end
 * without spending anything. `search_by_date` is ranked newest-first and
 * `created_at_i` is a real unix timestamp, so dates are exact.
 *
 * Both stories and comments are pulled - the monthly "Ask HN: Freelancer?
 * Seeking freelancer?" threads live in the comments and are the richest vein of
 * explicit "I need this built" posts on the site.
 */
@Injectable()
export class HackerNewsProvider implements ISocialSourceProvider {
  readonly id = 'hackernews';
  readonly label = 'Hacker News';
  readonly requiredEnv: string[] = [];
  readonly setupHint = 'No setup needed - the Hacker News search index is free and open.';

  private readonly logger = new Logger(HackerNewsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private resolveBaseUrl(credentials?: Record<string, string>): string {
    return (
      credentials?.baseUrl ||
      this.configService.get<string>('socialProspecting.hackerNews.baseUrl') ||
      'https://hn.algolia.com/api/v1'
    );
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  /** Always available - there is nothing to configure. */
  isConfigured(): boolean {
    return true;
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const baseUrl = this.resolveBaseUrl(params.credentials);
    const since = Math.floor((Date.now() - params.maxAgeDays * DAY_MS) / 1000);
    const perQuery = Math.max(10, Math.ceil(params.limit / Math.max(1, params.queries.length)));

    for (const query of params.queries) {
      if (posts.length >= params.limit) break;

      const url =
        `${baseUrl}/search_by_date?` +
        new URLSearchParams({
          query,
          tags: '(story,comment)',
          numericFilters: `created_at_i>${since}`,
          hitsPerPage: String(Math.min(perQuery, MAX_HITS_PER_PAGE)),
        }).toString();

      try {
        const json = await fetchJson(url, { method: 'GET' }, this.timeoutMs, 'Hacker News');
        apiCalls++;

        for (const hit of json?.hits || []) {
          if (posts.length >= params.limit) break;
          const post = this.mapHit(hit);
          if (!post || seen.has(post.externalId)) continue;
          seen.add(post.externalId);
          posts.push(post);
        }
      } catch (err: any) {
        // One bad query must not sink the whole run.
        this.logger.warn(`HN query "${query}" failed: ${err?.message}`);
        warnings.push(`Hacker News query "${query}" failed: ${err?.message}`);
      }
    }

    return { posts, apiCalls, warnings };
  }

  private mapHit(hit: any): RawSocialPost | null {
    const externalId = hit?.objectID ? String(hit.objectID) : '';
    if (!externalId) return null;

    // Stories carry `title` + `story_text`; comments carry `comment_text` and
    // inherit their thread's title via `story_title`.
    const isComment = !!hit.comment_text;
    const body = normalizeBody(stripHtml(hit.comment_text || hit.story_text || hit.title || ''));
    if (!body) return null;

    const createdAt = hit.created_at_i
      ? new Date(hit.created_at_i * 1000)
      : hit.created_at
        ? new Date(hit.created_at)
        : undefined;

    return {
      externalId: `hn_${externalId}`,
      sourceUrl: `https://news.ycombinator.com/item?id=${externalId}`,
      title: hit.title || hit.story_title || undefined,
      body,
      authorHandle: hit.author || undefined,
      authorProfileUrl: hit.author
        ? `https://news.ycombinator.com/user?id=${encodeURIComponent(hit.author)}`
        : undefined,
      communityName: isComment ? hit.story_title || 'Hacker News thread' : 'Hacker News',
      postedAt: createdAt,
      // Algolia returns a real unix timestamp.
      dateConfidence: 'exact',
      engagement: {
        upvotes: typeof hit.points === 'number' ? hit.points : 0,
        comments: typeof hit.num_comments === 'number' ? hit.num_comments : 0,
      },
      raw: hit,
    };
  }
}

/** HN comment bodies are HTML fragments; the AI only needs the prose. */
function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // Inline tags become a space, which would otherwise orphan the punctuation
    // that followed them ("a <i>CRM</i>." -> "a CRM .").
    .replace(/\s+([,.!?;:])/g, '$1');
}
