import { Test, TestingModule } from '@nestjs/testing';
import { SocialQualifierService } from './social-qualifier.service';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { GENERIC_KEYWORDS, KEYWORD_PACKS } from './presets';
import { RawSocialPost } from './providers/social-source.interface';

describe('SocialQualifierService', () => {
  let service: SocialQualifierService;
  let chatCompletion: jest.Mock;

  const post = (externalId: string, body = 'I need a website for my bakery'): RawSocialPost => ({
    externalId,
    sourceUrl: `https://example.com/${externalId}`,
    body,
    dateConfidence: 'exact',
    raw: {},
  });

  beforeEach(async () => {
    chatCompletion = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialQualifierService,
        {
          provide: AIProviderFactory,
          useValue: {
            getProvider: () => ({ chatCompletion }),
            // Tenant-scoped lookup falls back to the same stub; the vault is
            // exercised by its own tests.
            getProviderForTenant: async () => ({ chatCompletion }),
          },
        },
      ],
    }).compile();

    service = module.get<SocialQualifierService>(SocialQualifierService);
  });

  describe('buildQueries', () => {
    it('uses the campaign keywords when it has them', async () => {
      const queries = await service.buildQueries({ keywords: ['need a CRM', 'want a chatbot'] });
      expect(queries).toEqual(['need a CRM', 'want a chatbot']);
    });

    it('falls back to the keyword pack for the selected services', async () => {
      const queries = await service.buildQueries({ serviceTypes: ['crm'] });
      expect(queries).toEqual(KEYWORD_PACKS.crm);
    });

    it('falls back to generic phrases when nothing is selected', async () => {
      const queries = await service.buildQueries({});
      expect(queries).toEqual(GENERIC_KEYWORDS);
    });

    it('appends extra queries and de-duplicates case-insensitively', async () => {
      const queries = await service.buildQueries({
        keywords: ['Need A Website'],
        extraQueries: ['need a website', 'site:quora.com help'],
      });
      expect(queries).toEqual(['Need A Website', 'site:quora.com help']);
    });

    it('never calls the model - query building must stay free', async () => {
      await service.buildQueries({ serviceTypes: ['website'] });
      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('suggestKeywords', () => {
    it('returns the model suggestions', async () => {
      chatCompletion.mockResolvedValue({
        content: '{"keywords":["need a shop site","looking for a dev"]}',
      });
      await expect(service.suggestKeywords(['website'])).resolves.toEqual([
        'need a shop site',
        'looking for a dev',
      ]);
    });

    it('falls back to the presets when the model fails', async () => {
      chatCompletion.mockRejectedValue(new Error('rate limited'));
      await expect(service.suggestKeywords(['crm'])).resolves.toEqual(KEYWORD_PACKS.crm);
    });
  });

  describe('classify', () => {
    it('parses a fenced JSON reply and reports token usage', async () => {
      chatCompletion.mockResolvedValue({
        content:
          '```json\n{"results":[{"id":"a","isLead":true,"score":82,"temperature":"hot",' +
          '"intent":"buying","needSummary":"Bakery owner wants a site","wantedServices":["website"],' +
          '"recommendedService":"website","urgency":"high","painPoints":["no online presence"]}]}\n```',
        usage: { totalTokens: 120 },
      });

      const { results, tokens } = await service.classify([post('a')], { serviceTypes: ['website'] });

      expect(tokens).toBe(120);
      expect(results.get('a')).toMatchObject({
        isLead: true,
        score: 82,
        temperature: 'hot',
        intent: 'buying',
        urgency: 'high',
      });
    });

    it('caps the score of a post the model rejected', async () => {
      chatCompletion.mockResolvedValue({
        content: '{"results":[{"id":"a","isLead":false,"score":95,"rejectReason":"seller advert"}]}',
      });

      const { results } = await service.classify([post('a')], { serviceTypes: ['website'] });

      const verdict = results.get('a')!;
      expect(verdict.isLead).toBe(false);
      // A rejected post must not keep a flattering score - the score gate reads it.
      expect(verdict.score).toBeLessThanOrEqual(30);
      expect(verdict.intent).toBe('irrelevant');
      expect(verdict.rejectReason).toBe('seller advert');
    });

    it('omits posts when the batch fails rather than guessing a verdict', async () => {
      chatCompletion.mockRejectedValue(new Error('upstream 500'));
      const { results } = await service.classify([post('a')], { serviceTypes: ['website'] });
      expect(results.size).toBe(0);
    });

    it('survives a reply that is not JSON at all', async () => {
      chatCompletion.mockResolvedValue({ content: 'Sorry, I cannot help with that.' });
      const { results } = await service.classify([post('a')], { serviceTypes: ['website'] });
      expect(results.size).toBe(0);
    });

    it('returns immediately for an empty batch without calling the model', async () => {
      const { results, tokens } = await service.classify([], { serviceTypes: ['website'] });
      expect(results.size).toBe(0);
      expect(tokens).toBe(0);
      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('generateMessage', () => {
    it('picks the channel from the platform and returns the draft', async () => {
      chatCompletion.mockResolvedValue({
        content: '{"message":"You could start with a one-page site."}',
        usage: { totalTokens: 60 },
      });

      const { result, tokens } = await service.generateMessage(
        { body: 'I need a website', source: 'reddit' },
        { serviceTypes: ['website'], tone: 'helpful', language: 'auto' },
      );

      expect(result.channel).toBe('reddit_comment');
      expect(result.message).toBe('You could start with a one-page site.');
      expect(tokens).toBe(60);
    });

    it('asks for a subject on the email channel', async () => {
      chatCompletion.mockResolvedValue({
        content: '{"message":"Body here","subject":"Your bakery site"}',
      });

      const { result } = await service.generateMessage(
        { body: 'I need a website', source: 'web' },
        { serviceTypes: ['website'], tone: 'direct', language: 'en', channel: 'email' },
      );

      expect(result.subject).toBe('Your bakery site');
    });
  });
});
