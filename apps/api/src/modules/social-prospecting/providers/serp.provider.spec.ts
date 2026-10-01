import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QuoraSerpProvider, SerpProvider } from './serp.provider';

describe('SerpProvider', () => {
  let web: SerpProvider;
  let quora: QuoraSerpProvider;
  let fetchMock: jest.Mock;

  const config: Record<string, any> = {
    'socialProspecting.serp.apiKey': 'test-key',
    'socialProspecting.serp.baseUrl': 'https://serp.test/search.json',
    'socialProspecting.serp.engine': 'google',
    'socialProspecting.serp.maxSearchesPerRun': 2,
    'socialProspecting.serp.resultsPerSearch': 10,
    'socialProspecting.serp.keywordsPerSearch': 2,
    'socialProspecting.httpTimeoutMs': 5000,
  };

  const ok = (body: any) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  });

  const baseParams = {
    maxAgeDays: 30,
    limit: 50,
    languageCode: 'en',
    regionCodes: ['IN'],
  };

  /** Every query URL the provider actually requested. */
  const requestedQueries = () =>
    fetchMock.mock.calls.map((c) => new URL(c[0] as string).searchParams.get('q'));

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SerpProvider,
        QuoraSerpProvider,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();

    web = module.get<SerpProvider>(SerpProvider);
    quora = module.get<QuoraSerpProvider>(QuoraSerpProvider);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports unconfigured when the key is missing instead of throwing', async () => {
    const bare = new SerpProvider({ get: () => undefined } as any);
    expect(bare.isConfigured()).toBe(false);

    const result = await bare.search({ ...baseParams, queries: ['need a website'] });
    expect(result.posts).toHaveLength(0);
    expect(result.apiCalls).toBe(0);
    expect(result.warnings[0]).toContain('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pins Quora to quora.com and leaves recency to tbs, not an after: operator', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    await quora.search({ ...baseParams, queries: ['need a website'] });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    const q = url.searchParams.get('q')!;
    expect(q).toContain('site:quora.com');
    expect(q).toContain('"need a website"');
    // Google publishes no date for most Q&A pages, so after: would exclude them.
    expect(q).not.toContain('after:');
    expect(url.searchParams.get('tbs')).toBe('qdr:m');
  });

  it('runs one search per selected country and tags results with it', async () => {
    fetchMock.mockResolvedValue(
      ok({
        organic_results: [
          { title: 'Need a website', link: 'https://www.quora.com/A', snippet: 'Long enough body here.' },
        ],
      }),
    );

    const result = await quora.search({
      ...baseParams,
      queries: ['need a website'],
      regionCodes: ['IN', 'AE'],
    });

    const gls = fetchMock.mock.calls.map((c) => new URL(c[0] as string).searchParams.get('gl'));
    expect(gls).toEqual(['in', 'ae']);
    // The same page found twice is still one prospect.
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].countryHint).toBe('IN');
  });

  it('sends no gl at all when the campaign targets no country', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    await quora.search({ ...baseParams, queries: ['need a website'], regionCodes: [] });

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('gl')).toBeNull();
  });

  it('counts every country against the search budget and says which were reached', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    // 2 batches x 3 countries = 6 searches, against a budget of 2.
    const result = await quora.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd'],
      regionCodes: ['IN', 'AE', 'US'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.warnings.join(' ')).toContain('ran 2 of 6 searches');
    expect(result.warnings.join(' ')).toContain('pick fewer countries');
  });

  it('OR-batches phrases so one paid search covers several keywords', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    // 4 keywords at 2 per search = 2 searches, not 4.
    await quora.search({
      ...baseParams,
      queries: ['need a website', 'need an app', 'need a CRM', 'need a chatbot'],
    });

    const qs = requestedQueries();
    expect(qs).toHaveLength(2);
    expect(qs[0]).toBe('site:quora.com ("need a website" OR "need an app")');
    expect(qs[1]).toBe('site:quora.com ("need a CRM" OR "need a chatbot")');
  });

  it('does not wrap a lone phrase in redundant parentheses', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));
    await quora.search({ ...baseParams, queries: ['need a website'] });
    expect(requestedQueries()[0]).toBe('site:quora.com "need a website"');
  });

  it('previewQueries returns exactly what search would send', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));
    const queries = ['need a website', 'need an app', 'need a CRM'];

    const preview = quora.previewQueries({ ...baseParams, queries });
    await quora.search({ ...baseParams, queries });

    expect(preview).toEqual(requestedQueries());
  });

  it('builds one search per site for the web source', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    await web.search({
      ...baseParams,
      queries: ['need a website'],
      siteFilters: ['indiehackers.com', 'reddit.com'],
    });

    expect(requestedQueries()).toEqual([
      expect.stringContaining('site:indiehackers.com'),
      expect.stringContaining('site:reddit.com'),
    ]);
  });

  it('interleaves sites with batches so a truncated budget still covers each site', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    // 4 keywords (2 batches) x 2 sites = 4 searches, budget 2.
    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd'],
      siteFilters: ['quora.com', 'indiehackers.com'],
    });

    // Both sites got a search rather than the first one eating the budget.
    expect(requestedQueries()).toEqual([
      expect.stringContaining('site:quora.com'),
      expect.stringContaining('site:indiehackers.com'),
    ]);
    expect(result.warnings.join(' ')).toContain('ran 2 of 4 searches');
  });

  it('stops at the per-run search budget and says how many it skipped', async () => {
    fetchMock.mockResolvedValue(ok({ organic_results: [] }));

    // 8 keywords batch into 4 searches on 1 site, against a budget of 2.
    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      siteFilters: ['quora.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.apiCalls).toBe(2);
    expect(result.warnings.join(' ')).toContain('ran 2 of 4 searches');
    // The warning must say what to do, not just that something was skipped.
    expect(result.warnings.join(' ')).toContain('Trim keywords');
    // With a single country the sentence must not mention countries at all.
    expect(result.warnings.join(' ')).not.toContain('selected countries');
  });

  it('keeps a result that carries no date - Google does not date every page', async () => {
    fetchMock.mockResolvedValue(
      ok({
        organic_results: [
          {
            title: 'How do I get a website for my bakery?',
            link: 'https://www.quora.com/How-do-I-get-a-website',
            snippet: 'I run a small bakery and need a simple site with online ordering.',
            // No `date` field at all - the common case for Quora pages.
          },
        ],
      }),
    );

    const result = await quora.search({ ...baseParams, queries: ['need a website'] });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].postedAt).toBeUndefined();
    // Recency was already enforced by tbs=qdr:, so we never claim per-post precision.
    expect(result.posts[0].dateConfidence).toBe('approx');
    expect(result.posts[0].communityName).toBe('quora.com');
    expect(result.posts[0].externalId).toMatch(/^serp_[0-9a-f]{24}$/);
  });

  it('parses a relative date when one is present', async () => {
    fetchMock.mockResolvedValue(
      ok({
        organic_results: [
          {
            title: 'Need a CRM',
            link: 'https://www.quora.com/Need-a-CRM',
            snippet: 'Our team outgrew spreadsheets.',
            date: '3 days ago',
          },
        ],
      }),
    );

    const result = await quora.search({ ...baseParams, queries: ['need a CRM'] });
    const posted = result.posts[0].postedAt!;
    const ageDays = (Date.now() - posted.getTime()) / 86_400_000;
    expect(ageDays).toBeGreaterThan(2.5);
    expect(ageDays).toBeLessThan(3.5);
  });

  it('drops a result that is clearly older than the window', async () => {
    fetchMock.mockResolvedValue(
      ok({
        organic_results: [
          {
            title: 'Old thread',
            link: 'https://www.quora.com/Old',
            snippet: 'Something from long ago.',
            date: '2 years ago',
          },
        ],
      }),
    );

    const result = await quora.search({ ...baseParams, maxAgeDays: 7, queries: ['need a website'] });
    expect(result.posts).toHaveLength(0);
  });

  it('de-duplicates the same URL returned by two searches', async () => {
    fetchMock.mockResolvedValue(
      ok({
        organic_results: [
          { title: 'Same page', link: 'https://www.quora.com/Same', snippet: 'Need a website built.' },
        ],
      }),
    );

    // 4 keywords at 2 per search = 2 searches, both returning the same page.
    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd'],
      siteFilters: ['quora.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.posts).toHaveLength(1);
  });

  it('warns and stops when the monthly quota is exhausted', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => '',
    });

    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b'],
      siteFilters: ['quora.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // stopped rather than burning the rest
    expect(result.warnings.join(' ')).toContain('quota exhausted');
  });

  it('warns and stops when the key is rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => '',
    });

    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b'],
      siteFilters: ['quora.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.warnings.join(' ')).toContain('SERPAPI_API_KEY');
  });

  it('surfaces a body-level error and moves to the next search', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ error: "Google hasn't returned any results for this query." }))
      .mockResolvedValueOnce(
        ok({
          organic_results: [
            { title: 'Need an app', link: 'https://www.quora.com/App', snippet: 'Want an app built.' },
          ],
        }),
      );

    // 4 keywords at 2 per search = 2 searches: the first errors, the second works.
    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd'],
      siteFilters: ['quora.com'],
    });

    expect(result.warnings.join(' ')).toContain('no matches for one phrase batch');
    expect(result.posts).toHaveLength(1);
  });

  it('collapses an identical warning repeated across searches', async () => {
    fetchMock.mockResolvedValue(ok({ error: "Google hasn't returned any results for this query." }));

    const result = await web.search({
      ...baseParams,
      queries: ['a', 'b', 'c', 'd'],
      siteFilters: ['quora.com'],
    });

    const noMatch = result.warnings.filter((w) => w.includes('no matches for one phrase batch'));
    expect(noMatch).toHaveLength(1);
    expect(noMatch[0]).toContain('(x2)');
  });
});
