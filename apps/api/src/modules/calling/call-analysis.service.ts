import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';

/** Normalised result of reading a call - whether Vapi extracted it or we did. */
export interface CallAnalysis {
  outcome: string;
  interestLevel: number;
  summary: string;
  /** What the agent promised to send on WhatsApp, written for the customer. */
  whatsappDetails?: string;
  requirement?: string;
  budget?: string;
  timeline?: string;
  objections: string[];
  keyPoints: string[];
  callbackAt?: Date;
  meetingAt?: Date;
  nextAction: { type: string; title: string; dueInHours: number; reason?: string };
  suggestedStatus: string;
  temperature: string;
  sentiment?: string;
  language?: string;
  source: 'provider' | 'llm' | 'manual';
}

const OUTCOMES = new Set([
  'interested',
  'not_interested',
  'callback',
  'meeting_booked',
  'no_answer',
  'voicemail',
  'wrong_number',
  'busy',
  'won',
  'lost',
  'unknown',
]);
const ACTIONS = new Set(['call', 'whatsapp', 'email', 'meeting', 'none']);
const NO_CONTACT = new Set(['no_answer', 'voicemail', 'busy', 'wrong_number']);
const STATUSES = new Set(['contacted', 'interested', 'follow_up', 'meeting', 'won', 'lost']);

const DEFAULT_TITLES: Record<string, string> = {
  call: 'Call the lead',
  whatsapp: 'Send a WhatsApp follow-up',
  email: 'Send an email with details',
  meeting: 'Meeting / demo with the lead',
  none: 'No action needed',
};

const clamp = (n: any, lo: number, hi: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

const parseDate = (v: any): Date | undefined => {
  if (!v || typeof v !== 'string') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const strArr = (v: any) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 8) : [];

/**
 * Turns a transcript (or a salesperson's notes) into the structured read the
 * pipeline acts on: outcome, interest, next action, suggested stage.
 */
@Injectable()
export class CallAnalysisService {
  private readonly logger = new Logger(CallAnalysisService.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  /**
   * Shapes whatever the voice provider extracted into a CallAnalysis. Returns
   * null when the payload is too thin to act on, so the LLM pass runs instead.
   */
  fromStructured(
    structured: Record<string, any> | undefined,
    summary: string | undefined,
    hotThreshold: number,
  ): CallAnalysis | null {
    if (!structured || typeof structured !== 'object') return null;
    if (!OUTCOMES.has(structured.outcome)) return null;
    return this.normalise({ ...structured, summary: summary || structured.summary }, hotThreshold, 'provider');
  }

  /** No transcript at all (never answered): a deterministic read. */
  fromEndedReason(endedReason: string | undefined, hotThreshold: number): CallAnalysis {
    const r = (endedReason || '').toLowerCase();
    let outcome = 'no_answer';
    if (r.includes('voicemail')) outcome = 'voicemail';
    else if (r.includes('busy')) outcome = 'busy';
    else if (r.includes('invalid') || r.includes('unallocated') || r.includes('wrong')) outcome = 'wrong_number';
    return this.normalise(
      { outcome, interestLevel: 0, summary: `Call ended: ${endedReason || 'no answer'}` },
      hotThreshold,
      'provider',
    );
  }

  /** LLM read of a transcript or of a salesperson's notes. */
  async fromTranscript(
    tenantId: string,
    input: { transcript?: string; notes?: string; lead: any; byHuman?: boolean; outcomeHint?: string },
    hotThreshold: number,
  ): Promise<CallAnalysis> {
    const text = [
      input.transcript && `TRANSCRIPT:\n${input.transcript}`,
      input.notes && `SALESPERSON NOTES:\n${input.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!text.trim()) return this.fromEndedReason('no transcript', hotThreshold);

    const lead = input.lead || {};
    const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'the lead';
    const now = new Date().toISOString();
    const source: CallAnalysis['source'] = input.byHuman ? 'manual' : 'llm';

    try {
      const provider = await this.aiFactory.getProviderForTenant(tenantId);
      const completion = await provider.chatCompletion(
        [
          {
            role: 'system',
            content: `You are a sales operations analyst. Read a ${
              input.byHuman ? 'call between a salesperson and a lead' : 'call between our AI agent and a lead'
            } and return STRICT JSON with keys:
- outcome: one of interested | not_interested | callback | meeting_booked | no_answer | voicemail | wrong_number | won | lost | unknown
- interestLevel: 0-100 (how likely they are to buy)
- summary: 2-3 sentences, plain language, for a busy manager
- requirement: what they need (string, may be empty)
- budget: string or empty
- timeline: string or empty
- objections: array of strings
- keyPoints: array of up to 5 strings
- whatsappDetails: if the agent promised to send anything on WhatsApp (prices, options, package details, timings, address, next steps), the exact details discussed written as a short plain-text message to the customer (2-5 lines, no greeting); empty string otherwise
- callbackAt: ISO 8601 datetime with timezone if they asked for a callback at a specific time, else null
- meetingAt: ISO 8601 datetime if a meeting/demo/visit was agreed, else null
- nextAction: { "type": call|whatsapp|email|meeting|none, "title": short imperative, "dueInHours": number, "reason": one sentence }
- suggestedStatus: one of contacted | interested | follow_up | meeting | won | lost
- sentiment: positive | neutral | negative
- language: language the lead spoke (en, hi, hinglish, ...)

Current time is ${now}. Relative times ("kal", "tomorrow 11 baje", "next week") must be converted to absolute ISO datetimes in Asia/Kolkata unless another zone is obvious.
${
  input.outcomeHint
    ? `The salesperson marked the outcome as "${input.outcomeHint}" - trust that unless the notes clearly contradict it.`
    : ''
}
Output JSON only. No markdown.`,
          },
          {
            role: 'user',
            content: `Lead: ${leadName}${lead.company ? ` (${lead.company})` : ''}${
              lead.source ? `, source ${lead.source}` : ''
            }\n\n${text.slice(0, 24_000)}`,
          },
        ],
        { temperature: 0.2, maxTokens: 900 },
      );
      const cleaned = (completion.content || '').replace(/```json\n?|\n?```/g, '').trim();
      return this.normalise(JSON.parse(cleaned), hotThreshold, source);
    } catch (err: any) {
      this.logger.warn(`Call analysis failed, using heuristic: ${err?.message}`);
      return this.heuristic(text, input.outcomeHint, hotThreshold, source);
    }
  }

  private heuristic(
    text: string,
    outcomeHint: string | undefined,
    hotThreshold: number,
    source: CallAnalysis['source'],
  ): CallAnalysis {
    const t = text.toLowerCase();
    let outcome = outcomeHint && OUTCOMES.has(outcomeHint) ? outcomeHint : 'unknown';
    if (outcome === 'unknown') {
      if (/not interested|no thanks|nahi chahiye|don't call/.test(t)) outcome = 'not_interested';
      else if (/call (me )?back|baad mein|later|busy right now/.test(t)) outcome = 'callback';
      else if (/meeting|demo|visit|appointment/.test(t)) outcome = 'meeting_booked';
      else if (/interested|send (me )?(the )?(quote|details|price)|haan|yes please/.test(t)) outcome = 'interested';
    }
    const interestLevel =
      outcome === 'interested' ? 65
      : outcome === 'meeting_booked' ? 80
      : outcome === 'callback' ? 45
      : outcome === 'not_interested' ? 5
      : 30;
    return this.normalise({ outcome, interestLevel, summary: text.slice(0, 280) }, hotThreshold, source);
  }

  private normalise(raw: any, hotThreshold: number, source: CallAnalysis['source']): CallAnalysis {
    const outcome = OUTCOMES.has(raw.outcome) ? raw.outcome : 'unknown';
    const noContact = NO_CONTACT.has(outcome);
    const interestLevel = noContact
      ? 0
      : Math.round(clamp(raw.interestLevel, 0, 100, outcome === 'interested' ? 60 : 20));

    const callbackAt = parseDate(raw.callbackAt);
    const meetingAt = parseDate(raw.meetingAt);

    const na = raw.nextAction && typeof raw.nextAction === 'object' ? raw.nextAction : {};
    let actionType: string | undefined = ACTIONS.has(na.type)
      ? na.type
      : ACTIONS.has(raw.nextAction)
        ? raw.nextAction
        : undefined;
    if (!actionType) {
      actionType =
        outcome === 'meeting_booked' ? 'meeting'
        : outcome === 'callback' || outcome === 'interested' ? 'call'
        : noContact ? 'whatsapp'
        : 'none';
    }
    let dueInHours = clamp(na.dueInHours ?? raw.nextActionInHours, 0.25, 24 * 30, 24);
    // "Send it right away" means now, not tomorrow - whatever the model put in dueInHours
    const urgency = `${na.reason ?? raw.nextActionReason ?? ''} ${raw.summary ?? ''}`;
    if (/(immediately|right away|right now|asap|at once|urgent(ly)?|turant|abhi)/i.test(urgency)) {
      dueInHours = Math.min(dueInHours, 0.25);
    }
    if (callbackAt) dueInHours = Math.max(0.25, (callbackAt.getTime() - Date.now()) / 3_600_000);
    if (meetingAt && actionType === 'meeting') {
      dueInHours = Math.max(0.25, (meetingAt.getTime() - Date.now()) / 3_600_000);
    }

    const title =
      (typeof na.title === 'string' && na.title.trim()) ||
      (actionType === 'call' && outcome === 'callback' ? 'Call back as requested' : DEFAULT_TITLES[actionType]);

    let suggestedStatus = typeof raw.suggestedStatus === 'string' ? raw.suggestedStatus : '';
    if (!STATUSES.has(suggestedStatus)) {
      suggestedStatus =
        outcome === 'meeting_booked' ? 'meeting'
        : outcome === 'won' ? 'won'
        : outcome === 'interested' ? 'interested'
        : outcome === 'callback' ? 'follow_up'
        : outcome === 'not_interested' || outcome === 'lost' || outcome === 'wrong_number' ? 'lost'
        : noContact ? '' // never answered: stage unchanged
        : 'contacted';
    }

    const temperature = interestLevel >= hotThreshold ? 'hot' : interestLevel >= 40 ? 'warm' : 'cold';
    const reason = na.reason ?? raw.nextActionReason;

    return {
      outcome,
      interestLevel,
      summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
      requirement: typeof raw.requirement === 'string' ? raw.requirement : undefined,
      budget: typeof raw.budget === 'string' ? raw.budget : undefined,
      timeline: typeof raw.timeline === 'string' ? raw.timeline : undefined,
      objections: strArr(raw.objections),
      keyPoints: strArr(raw.keyPoints),
      whatsappDetails: typeof raw.whatsappDetails === 'string' && raw.whatsappDetails.trim().length > 3 ? raw.whatsappDetails.trim().slice(0, 900) : undefined,
      callbackAt,
      meetingAt,
      nextAction: {
        type: actionType,
        title,
        dueInHours: Math.round(dueInHours * 4) / 4,
        reason: typeof reason === 'string' ? reason : undefined,
      },
      suggestedStatus,
      temperature,
      sentiment: typeof raw.sentiment === 'string' ? raw.sentiment : undefined,
      language: typeof raw.language === 'string' ? raw.language : undefined,
      source,
    };
  }
}
