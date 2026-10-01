import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HackerNewsProvider } from './hackernews.provider';

describe('HackerNewsProvider', () => {
  let provider: HackerNewsProvider;
  let fetchMock: jest.Mock;

  const config: Record<string, any> = {
    'socialProspecting.hackerNews.baseUrl': 'https://hn.test/api/v1',
    'socialProspecting.httpTimeoutMs': 5000,
  };

  const ok = (body: any) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  });

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HackerNewsProvider,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();

    provider = module.get<HackerNewsProvider>(HackerNewsProvider);
  });

  afterEach(() => jest.restoreAllMocks());

  it('is always configured - the index needs no key', () => {
    expect(provider.isConfigured()).toBe(true);
    expect(provider.requiredEnv).toEqual([]);
  });

  it('maps a story hit to a post with an exact date and a permalink', async () => {
    const createdAt = Math.floor(Date.now() / 1000) - 3600;
    fetchMock.mockResolvedValue(
      ok({
        hits: [
          {
            objectID: '4242',
            title: 'Ask HN: need a developer for my shop',
            story_text: 'Looking for someone to build a small store site.',
            author: 'shopowner',
            created_at_i: createdAt,
            points: 12,
            num_comments: 3,
          },
        ],
      }),
    );

    const result = await provider.search({
      queries: ['need a developer'],
      maxAgeDays: 7,
      limit: 10,
      languageCode: 'en',
      regionCodes: ['IN'],
    });

    expect(result.apiCalls).toBe(1);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      externalId: 'hn_4242',
      sourceUrl: 'https://news.ycombinator.com/item?id=4242',
      authorHandle: 'shopowner',
      dateConfidence: 'exact',
    });
    expect(result.posts[0].postedAt?.getTime()).toBe(createdAt * 1000);
    expect(result.posts[0].engagement).toEqual({ upvotes: 12, comments: 3 });
  });

  it('strips HTML out of comment bodies', async () => {
    fetchMock.mockResolvedValue(
      ok({
        hits: [
          {
            objectID: '99',
            comment_text: 'We need a <i>CRM</i>.<p>Budget is ~$5k &amp; flexible.',
            story_title: 'Ask HN: Freelancer? Seeking freelancer?',
            author: 'someone',
            created_at_i: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    );

    const result = await provider.search({
      queries: ['CRM'],
      maxAgeDays: 30,
      limit: 5,
      languageCode: 'en',
      regionCodes: ['IN'],
    });

    expect(result.posts[0].body).toBe('We need a CRM. Budget is ~$5k & flexible.');
    expect(result.posts[0].communityName).toBe('Ask HN: Freelancer? Seeking freelancer?');
  });

  it('de-duplicates the same hit returned by two queries', async () => {
    const hit = {
      objectID: '7',
      title: 'need a website',
      story_text: 'a body long enough to matter',
      created_at_i: Math.floor(Date.now() / 1000),
    };
    fetchMock.mockResolvedValue(ok({ hits: [hit] }));

    const result = await provider.search({
      queries: ['need a website', 'looking for a web developer'],
      maxAgeDays: 7,
      limit: 10,
      languageCode: 'en',
      regionCodes: ['IN'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.posts).toHaveLength(1);
  });

  it('records a failed query as a warning instead of throwing', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' })
      .mockResolvedValueOnce(
        ok({ hits: [{ objectID: '1', title: 'need an app', story_text: 'body text here', created_at_i: 1 }] }),
      );

    const result = await provider.search({
      queries: ['first', 'second'],
      maxAgeDays: 7,
      limit: 10,
      languageCode: 'en',
      regionCodes: ['IN'],
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('503');
    // The second query still ran and its result survived.
    expect(result.posts).toHaveLength(1);
  });

  it('stops once the limit is reached', async () => {
    fetchMock.mockResolvedValue(
      ok({
        hits: Array.from({ length: 5 }, (_, i) => ({
          objectID: String(i),
          title: `need a website ${i}`,
          story_text: 'a body long enough to matter',
          created_at_i: Math.floor(Date.now() / 1000),
        })),
      }),
    );

    const result = await provider.search({
      queries: ['a', 'b', 'c'],
      maxAgeDays: 7,
      limit: 2,
      languageCode: 'en',
      regionCodes: ['IN'],
    });

    expect(result.posts).toHaveLength(2);
  });
});
