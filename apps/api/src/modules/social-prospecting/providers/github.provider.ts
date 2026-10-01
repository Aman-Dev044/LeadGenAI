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
 * GitHub issues and discussions.
 *
 * People post real briefs in issues - "looking for a developer to build X",
 * "need help integrating Y", "our team needs a maintainer" - and the search API
 * indexes issue bodies, which few other sources do.
 *
 * Works unauthenticated at 10 searches a minute; a free personal access token
 * (no scopes needed for public data) raises that to 30.
 */
@Injectable()
export class GitHubProvider implements ISocialSourceProvider {
  readonly id = 'github';
  readonly label = 'GitHub';
  readonly requiredEnv: string[] = [];
  readonly setupHint =
    'Works with no token at 10 searches/minute. A free personal access token from ' +
    'github.com/settings/tokens (no scopes required for public data) raises it to 30/minute.';

  private readonly logger = new Logger(GitHubProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private cfg<T>(key: string): T | undefined {
    return this.configService.get<T>(`socialProspecting.github.${key}`);
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  private settings(credentials?: Record<string, string>) {
    return {
      token: credentials?.token || this.cfg<string>('token') || '',
      baseUrl: credentials?.baseUrl || this.cfg<string>('baseUrl') || 'https://api.github.com',
    };
  }

  /** Public search needs no token; one only raises the rate limit. */
  isConfigured(): boolean {
    return true;
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const settings = this.settings(params.credentials);
    const since = new Date(Date.now() - params.maxAgeDays * DAY_MS).toISOString().slice(0, 10);
    const perQuery = Math.max(10, Math.ceil(params.limit / Math.max(1, params.queries.length)));

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub rejects requests without one.
      'User-Agent': 'LeadGenAI-prospecting',
    };
    if (settings.token) headers.Authorization = `Bearer ${settings.token}`;

    for (const query of params.queries) {
      if (posts.length >= params.limit) break;

      // Searching the body is what surfaces briefs; titles alone are too terse.
      const phrase = query.includes('"') ? query : `"${query}"`;
      const url =
        `${settings.baseUrl}/search/issues?` +
        new URLSearchParams({
          q: `${phrase} in:body,title state:open created:>=${since}`,
          sort: 'created',
          order: 'desc',
          per_page: String(Math.min(perQuery, 100)),
        }).toString();

      try {
        const json = await fetchJson(url, { method: 'GET', headers }, this.timeoutMs, 'GitHub');
        apiCalls++;

        for (const item of json?.items || []) {
          if (posts.length >= params.limit) break;
          const mapped = this.mapIssue(item);
          if (!mapped || seen.has(mapped.externalId)) continue;
          seen.add(mapped.externalId);
          posts.push(mapped);
        }
      } catch (err: any) {
        if (err?.status === 403 || err?.status === 429) {
          warnings.push(
            settings.token
              ? 'GitHub rate limit reached - partial results.'
              : 'GitHub rate limit reached (10 searches/minute without a token). Add a free ' +
                'personal access token to raise it to 30/minute.',
          );
          break;
        }
        if (err?.status === 422) {
          warnings.push(`GitHub rejected the query "${query}" as malformed.`);
          continue;
        }
        this.logger.warn(`GitHub query "${query}" failed: ${err?.message}`);
        warnings.push(`GitHub query failed: ${err?.message}`);
      }
    }

    return { posts, apiCalls, warnings };
  }

  private mapIssue(item: any): RawSocialPost | null {
    const id = item?.id;
    const url: string = item?.html_url || '';
    if (!id || !url) return null;

    const title: string = item.title || '';
    const body = normalizeBody(item.body || '');
    if (!title && !body) return null;

    // html_url is .../owner/repo/issues/123 - the repo is the community here.
    const repo = url.match(/github\.com\/([^/]+\/[^/]+)\//)?.[1];

    return {
      externalId: `gh_${id}`,
      sourceUrl: url,
      title,
      body: body || title,
      authorHandle: item?.user?.login,
      authorProfileUrl: item?.user?.html_url,
      communityName: repo ? `github.com/${repo}` : 'GitHub',
      postedAt: item.created_at ? new Date(item.created_at) : undefined,
      // GitHub returns real ISO timestamps.
      dateConfidence: 'exact',
      engagement: {
        comments: item.comments || 0,
        upvotes: item?.reactions?.total_count || 0,
      },
      raw: { repo, labels: (item.labels || []).map((l: any) => l?.name).filter(Boolean) },
    };
  }
}
