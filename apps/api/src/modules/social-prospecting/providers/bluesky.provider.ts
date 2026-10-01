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
/** Access tokens last ~2h; refresh early so a long run never trips over expiry. */
const TOKEN_TTL_MS = 90 * 60 * 1000;

/**
 * Bluesky post search over the AT Protocol.
 *
 * The unauthenticated `public.api.bsky.app` host still serves profiles, but
 * `searchPosts` now answers 403 there and 401 on `bsky.social` - so this needs a
 * session. Creating one is free: any Bluesky account plus an App Password
 * (Settings > App Passwords), which is revocable and cannot change the account.
 *
 * Posts carry a real `createdAt`, so dates are exact.
 */
@Injectable()
export class BlueskyProvider implements ISocialSourceProvider {
  readonly id = 'bluesky';
  readonly label = 'Bluesky';
  readonly requiredEnv = ['BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'];
  readonly setupHint =
    'Free: sign in at bsky.app, open Settings > App Passwords, create one, and save the handle ' +
    'plus that app password here. Never use your account password.';

  private readonly logger = new Logger(BlueskyProvider.name);

  /** Sessions cached per handle so two workspaces never share one. */
  private readonly sessions = new Map<string, { jwt: string; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {}

  private cfg<T>(key: string): T | undefined {
    return this.configService.get<T>(`socialProspecting.bluesky.${key}`);
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  private settings(credentials?: Record<string, string>) {
    return {
      identifier: credentials?.identifier || this.cfg<string>('identifier') || '',
      appPassword: credentials?.appPassword || this.cfg<string>('appPassword') || '',
      baseUrl: credentials?.baseUrl || this.cfg<string>('baseUrl') || 'https://bsky.social',
    };
  }

  isConfigured(credentials?: Record<string, string>): boolean {
    const s = this.settings(credentials);
    return !!(s.identifier && s.appPassword);
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const settings = this.settings(params.credentials);
    if (!this.isConfigured(params.credentials)) {
      return { posts, apiCalls, warnings: ['Bluesky is not configured - skipped.'] };
    }

    let jwt: string;
    try {
      jwt = await this.getSession(settings);
      apiCalls++;
    } catch (err: any) {
      return { posts, apiCalls: 1, warnings: [`Bluesky sign-in failed: ${err?.message}`] };
    }

    const since = new Date(Date.now() - params.maxAgeDays * DAY_MS).toISOString();
    const perQuery = Math.max(10, Math.ceil(params.limit / Math.max(1, params.queries.length)));

    for (const query of params.queries) {
      if (posts.length >= params.limit) break;

      const url =
        `${settings.baseUrl}/xrpc/app.bsky.feed.searchPosts?` +
        new URLSearchParams({
          q: query,
          limit: String(Math.min(perQuery, MAX_LIMIT_PER_CALL)),
          sort: 'latest',
          since,
        }).toString();

      try {
        const json = await fetchJson(
          url,
          { method: 'GET', headers: { Authorization: `Bearer ${jwt}` } },
          this.timeoutMs,
          'Bluesky',
        );
        apiCalls++;

        for (const post of json?.posts || []) {
          if (posts.length >= params.limit) break;
          const mapped = this.mapPost(post);
          if (!mapped || seen.has(mapped.externalId)) continue;
          seen.add(mapped.externalId);
          posts.push(mapped);
        }
      } catch (err: any) {
        if (err?.status === 429) {
          warnings.push('Bluesky rate limit reached - partial results.');
          break;
        }
        this.logger.warn(`Bluesky query "${query}" failed: ${err?.message}`);
        warnings.push(`Bluesky query "${query}" failed: ${err?.message}`);
      }
    }

    return { posts, apiCalls, warnings };
  }

  private async getSession(settings: ReturnType<BlueskyProvider['settings']>): Promise<string> {
    const cached = this.sessions.get(settings.identifier);
    if (cached && cached.expiresAt > Date.now()) return cached.jwt;

    const json = await fetchJson(
      `${settings.baseUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: settings.identifier.replace(/^@/, ''),
          password: settings.appPassword,
        }),
      },
      this.timeoutMs,
      'Bluesky auth',
    );

    const jwt = json?.accessJwt;
    if (!jwt) throw new Error('no accessJwt in response');
    this.sessions.set(settings.identifier, { jwt, expiresAt: Date.now() + TOKEN_TTL_MS });
    return jwt;
  }

  private mapPost(post: any): RawSocialPost | null {
    const uri: string = post?.uri || '';
    const text: string = post?.record?.text || '';
    if (!uri || !text) return null;

    const handle: string = post?.author?.handle || '';
    // at://did:plc:xxx/app.bsky.feed.post/RKEY -> the public web permalink.
    const rkey = uri.split('/').pop();

    return {
      externalId: `bsky_${uri}`,
      sourceUrl: handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : uri,
      body: normalizeBody(text),
      authorHandle: handle || undefined,
      authorProfileUrl: handle ? `https://bsky.app/profile/${handle}` : undefined,
      communityName: 'Bluesky',
      postedAt: post?.record?.createdAt ? new Date(post.record.createdAt) : undefined,
      // AT Protocol records carry a real timestamp.
      dateConfidence: 'exact',
      language: post?.record?.langs?.[0],
      engagement: {
        upvotes: post?.likeCount || 0,
        comments: post?.replyCount || 0,
      },
      raw: { cid: post?.cid, repostCount: post?.repostCount },
    };
  }
}
