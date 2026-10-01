import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { RawProspect } from './providers/lead-source.interface';
import { countryName } from '../../common/constants/countries';

export const SERVICE_LABELS: Record<string, string> = {
  website: 'business website design & development',
  ecommerce: 'e-commerce store / online ordering',
  mobile_app: 'cross-platform mobile app',
  ios_app: 'iOS app',
  android_app: 'Android app',
  erp_system: 'ERP system',
  crm: 'CRM software',
  custom_software: 'custom software / internal tools',
  ai_chatbot: 'AI chatbot / virtual assistant',
  llm_application: 'LLM / AI-powered application',
  automation: 'workflow automation',
  seo_marketing: 'SEO & digital marketing',
};

export interface QualificationResult {
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  fitReason: string;
  recommendedService: string;
  painPoints: string[];
  outreachMessage?: string;
}

/** Prospects sent to the model per request - keeps prompts inside a safe size. */
const BATCH_SIZE = 8;

@Injectable()
export class AiQualifierService {
  private readonly logger = new Logger(AiQualifierService.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  /**
   * Turns a campaign's categories x locations into Google Maps text queries. When
   * the user gave no categories, the model proposes the business types most likely
   * to need the selected services.
   */
  async buildQueries(campaign: {
    serviceTypes?: string[];
    businessCategories?: string[];
    locations?: string[];
    extraQueries?: string[];
    regionCode?: string;
  }): Promise<string[]> {
    const locations = (campaign.locations || []).map((l) => l.trim()).filter(Boolean);
    // Without this, a campaign that set only a country searches "gym" globally:
    // Places biases by region code, it does not confine the text query.
    const country = countryName(campaign.regionCode);
    let categories = (campaign.businessCategories || []).map((c) => c.trim()).filter(Boolean);

    if (!categories.length) {
      categories = await this.suggestCategories(campaign.serviceTypes || []);
    }

    const queries: string[] = [];
    const mentionsCountry = (text: string) =>
      !!country && text.toLowerCase().includes(country.toLowerCase());

    for (const category of categories) {
      if (!locations.length) {
        // A bare category plus a country still beats a bare category.
        queries.push(country ? `${category} in ${country}` : category);
        continue;
      }
      for (const location of locations) {
        const base = `${category} in ${location}`;
        // "dentist in Sydney, Australia" disambiguates the several Sydneys.
        queries.push(country && !mentionsCountry(location) ? `${base}, ${country}` : base);
      }
    }

    for (const extra of campaign.extraQueries || []) {
      const trimmed = extra.trim();
      if (trimmed) queries.push(trimmed);
    }

    // De-duplicate case-insensitively while preserving order.
    const seen = new Set<string>();
    return queries.filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Business types that typically buy the given services. Falls back to a static list. */
  async suggestCategories(serviceTypes: string[]): Promise<string[]> {
    const fallback = [
      'restaurant',
      'gym',
      'dental clinic',
      'real estate agency',
      'boutique',
      'travel agency',
      'coaching institute',
      'beauty salon',
    ];

    const services = serviceTypes.map((s) => SERVICE_LABELS[s] || s).filter(Boolean);
    if (!services.length) return fallback;

    try {
      const provider = this.aiFactory.getProvider();
      const result = await provider.chatCompletion(
        [
          {
            role: 'system',
            content:
              'You help a software agency find prospects on Google Maps. Reply with JSON only.',
          },
          {
            role: 'user',
            content:
              `The agency sells: ${services.join(', ')}.\n` +
              'List 8 local business categories, as they would be typed into Google Maps search, ' +
              'that most often need these services and are likely to be small or newly opened.\n' +
              'Respond as {"categories": ["...", "..."]} and nothing else.',
          },
        ],
        { temperature: 0.4, maxTokens: 300 },
      );

      const parsed = this.parseJson(result.content);
      const categories = Array.isArray(parsed?.categories)
        ? parsed.categories.filter((c: any) => typeof c === 'string' && c.trim())
        : [];
      return categories.length ? categories.slice(0, 10) : fallback;
    } catch (err: any) {
      this.logger.warn(`Category suggestion failed, using defaults: ${err?.message}`);
      return fallback;
    }
  }

  /**
   * Scores prospects for how likely they are to buy the campaign's services and
   * drafts a first outreach line. Returns a map keyed by `externalId`; prospects
   * missing from the map simply keep a neutral score.
   */
  async qualify(
    prospects: RawProspect[],
    options: { serviceTypes: string[]; generateOutreach: boolean; tenantName?: string },
  ): Promise<Map<string, QualificationResult>> {
    const results = new Map<string, QualificationResult>();
    if (!prospects.length) return results;

    const services = options.serviceTypes.map((s) => SERVICE_LABELS[s] || s).filter(Boolean);
    const serviceList = services.length ? services.join(', ') : 'software and web development services';

    for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
      const batch = prospects.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await this.qualifyBatch(batch, serviceList, options);
        for (const [id, value] of batchResults) results.set(id, value);
      } catch (err: any) {
        this.logger.warn(`Qualification batch failed: ${err?.message}`);
      }
    }

    return results;
  }

  private async qualifyBatch(
    batch: RawProspect[],
    serviceList: string,
    options: { generateOutreach: boolean; tenantName?: string },
  ): Promise<Map<string, QualificationResult>> {
    const provider = this.aiFactory.getProvider();

    const payload = batch.map((p) => ({
      id: p.externalId,
      name: p.businessName,
      category: p.category || (p.categories || [])[0],
      address: p.address,
      hasWebsite: !!p.website,
      website: p.website || null,
      hasPhone: !!p.phone,
      rating: p.rating || 0,
      reviewCount: p.reviewCount || 0,
      oldestReview: p.oldestReviewAt ? p.oldestReviewAt.toISOString().slice(0, 10) : null,
      recentReviews: (p.reviewSamples || [])
        .slice(0, 3)
        .map((r) => ({ rating: r.rating, text: (r.text || '').slice(0, 300) })),
    }));

    const outreachInstruction = options.generateOutreach
      ? '\n- "outreachMessage": 2 sentences, max 45 words, addressed to the owner. Reference something concrete ' +
        'from their listing (no website, few reviews, a complaint in a review). No greeting fluff, no emoji.'
      : '';

    const seller = options.tenantName ? `${options.tenantName}, an agency` : 'a software agency';

    const result = await provider.chatCompletion(
      [
        {
          role: 'system',
          content:
            'You qualify Google Maps businesses as sales prospects for a software agency. ' +
            'Judge only from the supplied data - never invent facts. Reply with JSON only.',
        },
        {
          role: 'user',
          content:
            `Seller: ${seller} offering: ${serviceList}.\n\n` +
            `Businesses:\n${JSON.stringify(payload, null, 1)}\n\n` +
            'For each business return an object with:\n' +
            '- "id": the id given\n' +
            '- "score": 0-100, how likely they need and can afford these services. ' +
            'No website is a strong positive. Very few reviews (new listing) is a positive. ' +
            'A big chain or an existing modern website is a negative.\n' +
            '- "temperature": "hot" (>=70), "warm" (40-69) or "cold" (<40)\n' +
            '- "fitReason": one sentence, max 25 words, why this score\n' +
            '- "recommendedService": the single service from the seller list to pitch first\n' +
            '- "painPoints": up to 3 short phrases grounded in the data' +
            outreachInstruction +
            '\n\nRespond as {"results": [...]} and nothing else.',
        },
      ],
      { temperature: 0.3, maxTokens: 2000 },
    );

    const parsed = this.parseJson(result.content);
    const rows: any[] = Array.isArray(parsed?.results) ? parsed.results : [];

    const map = new Map<string, QualificationResult>();
    for (const row of rows) {
      if (!row?.id) continue;
      const score = clampScore(row.score);
      map.set(String(row.id), {
        score,
        temperature: normalizeTemperature(row.temperature, score),
        fitReason: typeof row.fitReason === 'string' ? row.fitReason.trim() : '',
        recommendedService:
          typeof row.recommendedService === 'string' ? row.recommendedService.trim() : '',
        painPoints: Array.isArray(row.painPoints)
          ? row.painPoints.filter((p: any) => typeof p === 'string').slice(0, 3)
          : [],
        outreachMessage:
          options.generateOutreach && typeof row.outreachMessage === 'string'
            ? row.outreachMessage.trim()
            : undefined,
      });
    }
    return map;
  }

  /** Models like to wrap JSON in prose or a fenced block; pull out the object. */
  private parseJson(raw: string): any {
    if (!raw) return null;
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
}

function clampScore(value: any): number {
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeTemperature(value: any, score: number): 'hot' | 'warm' | 'cold' {
  const raw = String(value || '').toLowerCase();
  if (raw === 'hot' || raw === 'warm' || raw === 'cold') return raw;
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}
