import { Injectable } from '@nestjs/common';
import { ISocialSourceProvider } from './social-source.interface';
import { HackerNewsProvider } from './hackernews.provider';
import { RedditProvider } from './reddit.provider';
import { QuoraSerpProvider, SerpProvider } from './serp.provider';
import { TendersProvider } from './tenders.provider';
import { BlueskyProvider } from './bluesky.provider';
import { StackExchangeProvider } from './stackexchange.provider';
import { GitHubProvider } from './github.provider';

/**
 * Lookup for the Leads Scrap AI sources this build supports. Adding a platform
 * means writing one provider and listing it here - the campaign engine, filters,
 * qualification and review queue never change.
 */
@Injectable()
export class SocialSourceRegistry {
  private readonly providers: ISocialSourceProvider[];

  constructor(
    private readonly hackerNews: HackerNewsProvider,
    private readonly reddit: RedditProvider,
    private readonly quora: QuoraSerpProvider,
    private readonly web: SerpProvider,
    private readonly tenders: TendersProvider,
    private readonly bluesky: BlueskyProvider,
    private readonly stackExchange: StackExchangeProvider,
    private readonly github: GitHubProvider,
  ) {
    this.providers = [
      hackerNews,
      reddit,
      quora,
      web,
      tenders,
      bluesky,
      stackExchange,
      github,
    ];
  }

  get(id: string): ISocialSourceProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /** Free and keyless, so a campaign always has at least one working source. */
  default(): ISocialSourceProvider {
    return this.hackerNews;
  }

  /** `credentialsFor` supplies each source's tenant settings, when there are any. */
  list(credentialsFor?: (id: string) => Record<string, string> | undefined) {
    return this.providers.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(credentialsFor?.(p.id)),
      requiredEnv: p.requiredEnv,
      setupHint: p.setupHint,
    }));
  }

  all() {
    return this.providers;
  }
}
