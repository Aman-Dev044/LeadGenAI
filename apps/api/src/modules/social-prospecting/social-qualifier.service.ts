import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { SERVICE_LABELS } from '../lead-automation/ai-qualifier.service';
import { RawSocialPost } from './providers/social-source.interface';
import { COUNTRY_NAMES, GENERIC_KEYWORDS, KEYWORD_PACKS } from './presets';

/** Posts sent to the model per classification request - keeps prompts a safe size. */
const BATCH_SIZE = 8;
/** Post bodies are truncated before they reach the model; intent shows up early. */
const BODY_LIMIT = 1500;

export interface ClassificationResult {
  isLead: boolean;
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  intent: string;
  needSummary: string;
  wantedServices: string[];
  recommendedService: string;
  budgetHint?: string;
  urgency: 'high' | 'medium' | 'low';
  painPoints: string[];
  rejectReason?: string;
  /** ISO alpha-2 inferred from the post, or '' when the post gives no clue. */
  country: string;
  /** The place the post actually names, e.g. "Jaipur" or "the Bay Area". */
  locationText: string;
}

export interface GeneratedMessage {
  message: string;
  subject?: string;
  channel: string;
}

const CHANNEL_RULES: Record<string, { label: string; maxWords: number; rule: string }> = {
  reddit_comment: {
    label: 'a public Reddit comment in the same thread',
    maxWords: 80,
    rule:
      'Lead with genuinely useful advice that stands on its own, then mention you do this work in ' +
      'at most one short closing sentence. Reddit downvotes anything that reads like an ad.',
  },
  reddit_dm: {
    label: 'a Reddit direct message',
    maxWords: 60,
    rule: 'Quote one specific detail from their post in the first sentence so it cannot read as a mass DM.',
  },
  hn_reply: {
    label: 'a Hacker News reply',
    maxWords: 60,
    rule:
      'Be concrete and technical. No marketing language, no adjectives about your own quality, ' +
      'no exclamation marks. HN readers punish salesy tone.',
  },
  quora_answer: {
    label: 'a Quora answer',
    maxWords: 150,
    rule:
      'Actually answer the question so the answer is useful even to someone who never hires you. ' +
      'Mention what you do only in the final sentence.',
  },
  email: {
    label: 'a cold email',
    maxWords: 90,
    rule: 'Also produce a "subject" of at most 8 words. No greeting fluff.',
  },
  manual: {
    label: 'a short outreach note',
    maxWords: 80,
    rule: 'Reference something specific from their post.',
  },
};

@Injectable()
export class SocialQualifierService {
  private readonly logger = new Logger(SocialQualifierService.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  // Query building

  /**
   * Turns a campaign into the buying-intent phrases its sources will search for.
   * Keyword packs cover the common cases for free; the model is only asked when
   * the campaign gave neither keywords nor a recognised service type.
   */
  async buildQueries(campaign: {
    serviceTypes?: string[];
    keywords?: string[];
    extraQueries?: string[];
  }): Promise<string[]> {
    const queries: string[] = [];

    const keywords = (campaign.keywords || []).map((k) => k.trim()).filter(Boolean);
    if (keywords.length) {
      queries.push(...keywords);
    } else {
      const packed = (campaign.serviceTypes || []).flatMap((s) => KEYWORD_PACKS[s] || []);
      queries.push(...(packed.length ? packed : GENERIC_KEYWORDS));
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

  /** Extra phrases for the campaign form's "suggest" button. Falls back to the packs. */
  async suggestKeywords(serviceTypes: string[]): Promise<string[]> {
    const fallback = serviceTypes.flatMap((s) => KEYWORD_PACKS[s] || []);
    const services = serviceTypes.map((s) => SERVICE_LABELS[s] || s).filter(Boolean);
    if (!services.length) return GENERIC_KEYWORDS;

    try {
      const provider = this.aiFactory.getProvider();
      const result = await provider.chatCompletion(
        [
          {
            role: 'system',
            content:
              'You help a software agency find buying-intent posts on forums and Q&A sites. ' +
              'Reply with JSON only.',
          },
          {
            role: 'user',
            content:
              `The agency sells: ${services.join(', ')}.\n` +
              'List 10 short phrases a potential CUSTOMER would actually type when asking for help ' +
              'on Reddit, Quora or Hacker News. Write them the way a non-technical business owner ' +
              'would phrase it, not the way a marketer would. Exclude phrases a seller would post.\n' +
              'Respond as {"keywords": ["...", "..."]} and nothing else.',
          },
        ],
        { temperature: 0.5, maxTokens: 400 },
      );

      const parsed = this.parseJson(result.content);
      const keywords = Array.isArray(parsed?.keywords)
        ? parsed.keywords.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 12)
        : [];
      return keywords.length ? keywords : fallback.length ? fallback : GENERIC_KEYWORDS;
    } catch (err: any) {
      this.logger.warn(`Keyword suggestion failed, using presets: ${err?.message}`);
      return fallback.length ? fallback : GENERIC_KEYWORDS;
    }
  }

  // Classification

  /**
   * Decides which posts are real buying intent. Returns a map keyed by
   * `externalId`; a post missing from the map was not classified (a failed batch)
   * and the caller treats it as unqualified rather than guessing.
   */
  async classify(
    posts: RawSocialPost[],
    options: {
      serviceTypes: string[];
      tenantName?: string;
      regionCodes?: string[];
      tenantId?: string;
    },
  ): Promise<{ results: Map<string, ClassificationResult>; tokens: number }> {
    const results = new Map<string, ClassificationResult>();
    let tokens = 0;
    if (!posts.length) return { results, tokens };

    const services = options.serviceTypes.map((s) => SERVICE_LABELS[s] || s).filter(Boolean);
    const serviceList = services.length
      ? services.join(', ')
      : 'software and web development services';

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      try {
        const outcome = await this.classifyBatch(
          batch,
          serviceList,
          options.tenantName,
          options.regionCodes,
          options.tenantId,
        );
        for (const [id, value] of outcome.results) results.set(id, value);
        tokens += outcome.tokens;
      } catch (err: any) {
        this.logger.warn(`Classification batch failed: ${err?.message}`);
      }
    }

    return { results, tokens };
  }

  private async classifyBatch(
    batch: RawSocialPost[],
    serviceList: string,
    tenantName?: string,
    regionCodes?: string[],
    tenantId?: string,
  ): Promise<{ results: Map<string, ClassificationResult>; tokens: number }> {
    const provider = await this.aiFactory.getProviderForTenant(tenantId);

    const payload = batch.map((p) => ({
      id: p.externalId,
      community: p.communityName,
      title: p.title || null,
      body: p.body.slice(0, BODY_LIMIT),
      author: p.authorHandle || null,
      postedAt: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
      engagement: p.engagement || {},
      // Which country the source was searched in, where it supports that at all.
      searchedIn: p.countryHint || null,
    }));

    const seller = tenantName ? `${tenantName}, a software agency` : 'a software agency';

    // Naming the target countries sharpens the call without letting the model
    // pretend every post belongs to one of them.
    const wanted = (regionCodes || []).map((c) => COUNTRY_NAMES[c] || c).filter(Boolean);
    const countryInstruction = wanted.length
      ? `The seller only works with clients in: ${wanted.join(', ')}. Still report the country you ` +
        'genuinely infer, even when it is none of those - the caller filters, not you.\n'
      : '';

    const result = await provider.chatCompletion(
      [
        {
          role: 'system',
          content:
            'You classify social and forum posts as sales leads for a software agency. ' +
            'Judge ONLY from the supplied text - never invent facts about the author or their business. ' +
            'Most posts are NOT leads. Be strict. Reply with JSON only.',
        },
        {
          role: 'user',
          content:
            `Seller: ${seller} offering: ${serviceList}.\n\n` +
            `Posts:\n${JSON.stringify(payload, null, 1)}\n\n` +
            'For each post return an object with:\n' +
            '- "id": the id given\n' +
            '- "isLead": true ONLY if the author is looking to BUY or commission something the seller ' +
            'can deliver. A developer advertising their own services is NOT a lead. A company posting a ' +
            'full-time job opening is NOT a lead. A general discussion, news link or opinion is NOT a lead. ' +
            'Someone asking which tool to pick IS a lead if the seller could build or implement it.\n' +
            '- "score": 0-100 confidence that this is a reachable, worthwhile prospect. A clear budget, ' +
            'a deadline, or a specific described need raises it. Vagueness lowers it.\n' +
            '- "temperature": "hot" (>=70), "warm" (40-69) or "cold" (<40)\n' +
            '- "intent": one of buying, researching, hiring, complaining, offering, irrelevant\n' +
            '- "needSummary": one sentence, max 20 words, what they actually need\n' +
            '- "wantedServices": array drawn ONLY from the seller list above\n' +
            '- "recommendedService": the single service to pitch first\n' +
            '- "budgetHint": their stated budget, or null if they did not state one\n' +
            '- "urgency": "high", "medium" or "low"\n' +
            '- "painPoints": up to 3 short phrases grounded in what they wrote\n' +
            '- "rejectReason": when isLead is false, one short phrase saying why\n' +
            '- "country": ISO 3166-1 alpha-2 for where the AUTHOR appears to be, inferred from places, ' +
            'currencies, phone formats, spelling or the community they posted in. Use null when the post ' +
            'gives no real clue - do NOT guess from "searchedIn" alone, and do NOT default to the US.\n' +
            '- "locationText": the place the post actually names, or null\n\n' +
            countryInstruction +
            'Respond as {"results": [...]} and nothing else.',
        },
      ],
      { temperature: 0.2, maxTokens: 2500 },
    );

    const parsed = this.parseJson(result.content);
    const rows: any[] = Array.isArray(parsed?.results) ? parsed.results : [];

    const results = new Map<string, ClassificationResult>();
    for (const row of rows) {
      if (!row?.id) continue;
      const score = clampScore(row.score);
      const isLead = row.isLead === true;
      results.set(String(row.id), {
        isLead,
        // A post the model rejected must not keep a flattering score.
        score: isLead ? score : Math.min(score, 30),
        temperature: normalizeTemperature(row.temperature, score),
        intent: normalizeIntent(row.intent, isLead),
        needSummary: text(row.needSummary),
        wantedServices: stringArray(row.wantedServices, 5),
        recommendedService: text(row.recommendedService),
        budgetHint: text(row.budgetHint) || undefined,
        urgency: normalizeUrgency(row.urgency),
        painPoints: stringArray(row.painPoints, 3),
        rejectReason: isLead ? undefined : text(row.rejectReason) || 'Not a buying-intent post',
        country: normalizeCountry(row.country),
        locationText: text(row.locationText),
      });
    }

    return { results, tokens: result.usage?.totalTokens || 0 };
  }

  // Message drafting

  /**
   * Drafts one reply for one post. Deliberately a single call per post: a batched
   * prompt produces interchangeable messages, which is exactly what makes
   * outreach read as spam.
   */
  async generateMessage(
    post: {
      title?: string;
      body: string;
      communityName?: string;
      authorHandle?: string;
      source: string;
      ai?: { needSummary?: string; recommendedService?: string; painPoints?: string[] };
    },
    options: {
      serviceTypes: string[];
      tone: string;
      language: string;
      tenantName?: string;
      channel?: string;
      tenantId?: string;
    },
  ): Promise<{ result: GeneratedMessage; tokens: number }> {
    const channel = options.channel || defaultChannelFor(post.source);
    const rules = CHANNEL_RULES[channel] || CHANNEL_RULES.manual;
    const provider = await this.aiFactory.getProviderForTenant(options.tenantId);

    const services = options.serviceTypes.map((s) => SERVICE_LABELS[s] || s).filter(Boolean);
    const seller = options.tenantName || 'a small software agency';

    const result = await provider.chatCompletion(
      [
        {
          role: 'system',
          content:
            'You write short, personal outreach messages for a software agency. ' +
            'You never invent facts about the recipient, never promise prices or timelines, ' +
            'and never use marketing cliches. Reply with JSON only.',
        },
        {
          role: 'user',
          content:
            `Write ${rules.label}.\n\n` +
            `Seller: ${seller}, offering: ${services.join(', ') || 'software development'}.\n` +
            `Posted in: ${post.communityName || post.source}\n` +
            `Author: ${post.authorHandle || 'unknown'}\n` +
            `Their post:\n"""${post.body.slice(0, BODY_LIMIT)}"""\n` +
            (post.ai?.needSummary ? `What they need: ${post.ai.needSummary}\n` : '') +
            (post.ai?.recommendedService ? `Pitch first: ${post.ai.recommendedService}\n` : '') +
            `\nRules:\n` +
            `- ${rules.rule}\n` +
            `- Maximum ${rules.maxWords} words.\n` +
            `- Tone: ${options.tone}.\n` +
            `- ${languageInstruction(options.language)}\n` +
            '- Reference at least one specific detail they wrote, so it cannot read as a template.\n' +
            '- No emoji. No "I hope this finds you well". No made-up credentials, clients or numbers.\n' +
            '- Do not state a price or a delivery date.\n\n' +
            (channel === 'email'
              ? 'Respond as {"message": "...", "subject": "..."} and nothing else.'
              : 'Respond as {"message": "..."} and nothing else.'),
        },
      ],
      { temperature: 0.7, maxTokens: 600 },
    );

    const parsed = this.parseJson(result.content);
    const message = text(parsed?.message);

    return {
      result: {
        // Fall back to the raw completion rather than handing back an empty draft.
        message: message || text(result.content),
        subject: channel === 'email' ? text(parsed?.subject) || undefined : undefined,
        channel,
      },
      tokens: result.usage?.totalTokens || 0,
    };
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

/** Where a reply for this platform would naturally go. */
export function defaultChannelFor(source: string): string {
  switch (source) {
    case 'reddit':
      return 'reddit_comment';
    case 'hackernews':
      return 'hn_reply';
    case 'quora':
      return 'quora_answer';
    default:
      return 'manual';
  }
}

function languageInstruction(language: string): string {
  switch (language) {
    case 'en':
      return 'Write in English.';
    case 'hi':
      return 'Write in Hindi (Devanagari script).';
    case 'hinglish':
      return 'Write in natural Hinglish (Hindi written in Latin script, mixed with English).';
    default:
      return 'Write in the same language the post itself uses.';
  }
}

function text(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: any, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim()).slice(0, max);
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

function normalizeIntent(value: any, isLead: boolean): string {
  const allowed = ['buying', 'researching', 'hiring', 'complaining', 'offering', 'irrelevant'];
  const raw = String(value || '').toLowerCase();
  if (allowed.includes(raw)) return raw;
  return isLead ? 'buying' : 'irrelevant';
}

/** Accepts only a plausible ISO alpha-2; anything else means "we do not know". */
function normalizeCountry(value: any): string {
  const raw = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function normalizeUrgency(value: any): 'high' | 'medium' | 'low' {
  const raw = String(value || '').toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'low';
}
