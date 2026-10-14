import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { LOSS_REASONS, QA_CHECKS, type LossReason } from '../../schemas/call-review.schema';
import { ExperimentService } from './experiment.service';

const DEFAULT_POLL_MS = 120_000;
const MAX_PER_TICK = 25;
/** Nothing useful to grade in a ten-second call that nobody answered. */
const MIN_GRADEABLE_SECONDS = 20;

/**
 * How much each rubric item is worth. They are not equal: a call that never
 * asks for the next step has failed at the only thing it was for, however
 * polite it was.
 */
const WEIGHTS: Record<string, number> = {
  opened_well: 8,
  asked_need: 14,
  asked_budget: 8,
  asked_timeline: 8,
  handled_objection: 12,
  asked_for_meeting: 18,
  confirmed_next_step: 14,
  let_lead_speak: 8,
  stayed_in_language: 5,
  stayed_truthful: 5,
};

/**
 * Grades finished calls against a fixed rubric and records why each one did
 * not move forward.
 *
 * It sweeps rather than hooking into the call flow on purpose: the calling
 * path stays untouched, a grading failure can never break a call, and calls
 * that finished before this existed get graded too.
 *
 * With several API replicas set REVENUE_BRAIN_ENABLED=false on all but one.
 */
@Injectable()
export class CallQaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallQaService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel('CallLog') private readonly callModel: Model<any>,
    @InjectModel('CallReview') private readonly reviewModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    private readonly aiFactory: AIProviderFactory,
    private readonly experiments: ExperimentService,
  ) {}

  onModuleInit() {
    if (process.env.REVENUE_BRAIN_ENABLED === 'false') {
      this.logger.log('Revenue Brain disabled by environment');
      return;
    }
    const ms = parseInt(process.env.REVENUE_BRAIN_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.tick(), ms);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 45_000).unref?.();
    this.logger.log(`Revenue Brain: grading sweep every ${Math.round(ms / 1000)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One sweep. Returns how many calls were graded. Safe to call by hand. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let graded = 0;
    try {
      const done = await this.reviewModel.distinct('callId').then((ids: string[]) => ids.map(String));
      const calls: any[] = await this.callModel
        .find({
          _id: { $nin: done },
          endedAt: { $ne: null },
          leadId: { $ne: 'test' },
          durationSeconds: { $gte: MIN_GRADEABLE_SECONDS },
        })
        .sort({ endedAt: -1 })
        .limit(MAX_PER_TICK)
        .lean();

      for (const call of calls) {
        try {
          await this.grade(call);
          graded++;
        } catch (err: any) {
          this.logger.warn(`Grading call ${call._id} failed: ${err?.message}`);
        }
      }
      if (graded) this.logger.log(`Revenue Brain: graded ${graded} call(s)`);
      // A winner can become clear without a new call being graded this minute
      await this.experiments.evaluateAll().catch((err) => this.logger.warn(`Experiment sweep failed: ${err?.message}`));
      return graded;
    } catch (err: any) {
      this.logger.error(`Grading sweep failed: ${err?.message}`);
      return graded;
    } finally {
      this.running = false;
    }
  }

  /** Grade one call and store its marksheet. Idempotent per call. */
  async grade(call: any): Promise<any> {
    const existing = await this.reviewModel.findOne({ callId: String(call._id) }).lean();
    if (existing) return existing;

    const lead = await this.leadModel.findById(call.leadId).lean().catch(() => null);
    const transcript = String(call.transcript || '').trim();

    const base = {
      tenantId: call.tenantId,
      callId: String(call._id),
      leadId: String(call.leadId),
      outcome: call.outcome || '',
      interestLevel: Number(call.analysis?.interestLevel) || 0,
      durationSeconds: Number(call.durationSeconds) || 0,
      callEndedAt: call.endedAt || call.updatedAt || new Date(),
      experimentId: call.experimentId || '',
      variantKey: call.variantKey || '',
      agentTalkRatio: this.talkRatio(call),
    };

    // No words to read - grade what we can from the outcome alone
    const judged = transcript
      ? await this.ask(call, lead, transcript).catch((err) => {
          this.logger.warn(`QA model call failed for ${call._id}: ${err?.message}`);
          return null;
        })
      : null;

    const review = judged
      ? { ...base, ...judged, score: this.score(judged.checks), source: 'llm' }
      : { ...base, ...this.withoutTranscript(call), source: 'heuristic' };

    const saved = await this.reviewModel.findOneAndUpdate(
      { callId: base.callId },
      { $set: review },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // The experiment only learns from calls that actually connected
    if (base.experimentId && base.variantKey) {
      await this.experiments.recordCall(base.experimentId, base.variantKey, {
        answered: base.durationSeconds >= MIN_GRADEABLE_SECONDS,
        meeting: base.outcome === 'meeting_booked',
        interested: base.outcome === 'interested' || base.outcome === 'meeting_booked',
        interestLevel: base.interestLevel,
        qaScore: saved.score,
      });
    }
    return saved;
  }

  // ─── The grader ───────────────────────────────────────────────────

  private async ask(call: any, lead: any, transcript: string) {
    const provider = await this.aiFactory.getProviderForTenant(call.tenantId);
    const leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || 'the lead';

    const completion = await provider.chatCompletion(
      [
        {
          role: 'system',
          content: `You are a hard but fair sales manager reviewing one recorded call made by an AI agent on our behalf.

Grade it against this rubric. For each key, decide pass (true/false) honestly - a near miss is a fail - and write one short note saying what it did, or what it should have said instead.

RUBRIC KEYS: ${QA_CHECKS.join(', ')}
- opened_well: said who it is and why it is calling, quickly, without waffle
- asked_need: found out what the lead actually wants
- asked_budget: money was raised at all
- asked_timeline: when they want it
- handled_objection: answered the push-back rather than talking past it (pass if there was no objection)
- asked_for_meeting: explicitly asked for the next step
- confirmed_next_step: both sides ended knowing what happens next
- let_lead_speak: the lead got real speaking time, the agent did not monologue
- stayed_in_language: answered in the language the lead used
- stayed_truthful: promised nothing we do not actually offer

Then return STRICT JSON with these keys and nothing else:
- checks: array of { "key": <rubric key>, "pass": boolean, "note": string }  (one entry per rubric key, in order)
- lossReason: one of ${LOSS_REASONS.join(' | ')} - why the deal did not move. Use "none" when the call went well and the next step is agreed.
- lossQuote: the lead's own words that show the reason, quoted exactly from the transcript. Empty if none.
- competitors: array of competitor names the lead mentioned, exactly as said. Empty array if none.
- unansweredQuestions: array of questions the lead asked that the agent could not answer. Empty array if none.
- coaching: ONE sentence - the single change that would most improve the next call like this.
- bestLine: the single best thing the agent said, quoted. Empty if nothing stood out.

Be specific. "Could have been better" is useless; "should have asked for the meeting after she said the price was fine" is useful. Output JSON only, no markdown.`,
        },
        {
          role: 'user',
          content: `Lead: ${leadName}${lead?.company ? ` (${lead.company})` : ''}
Call outcome recorded by the system: ${call.outcome || 'unknown'}
Duration: ${call.durationSeconds || 0}s

TRANSCRIPT:
${transcript.slice(0, 22_000)}`,
        },
      ],
      { temperature: 0.1, maxTokens: 1200 },
    );

    const cleaned = (completion.content || '').replace(/```json\n?|\n?```/g, '').trim();
    const raw = JSON.parse(cleaned);
    return {
      checks: this.normaliseChecks(raw.checks),
      lossReason: this.normaliseLossReason(raw.lossReason),
      lossQuote: String(raw.lossQuote || '').slice(0, 400),
      competitors: this.strings(raw.competitors, 8, 60),
      unansweredQuestions: this.strings(raw.unansweredQuestions, 6, 200),
      coaching: String(raw.coaching || '').slice(0, 400),
      bestLine: String(raw.bestLine || '').slice(0, 400),
      model: provider.constructor?.name || '',
    };
  }

  /** Every rubric key present exactly once, whatever the model returned. */
  private normaliseChecks(raw: any) {
    const byKey = new Map<string, any>();
    if (Array.isArray(raw)) {
      for (const c of raw) {
        const key = String(c?.key || '').trim();
        if (QA_CHECKS.includes(key as any) && !byKey.has(key)) byKey.set(key, c);
      }
    }
    return QA_CHECKS.map((key) => {
      const c = byKey.get(key);
      return { key, pass: !!c?.pass, note: String(c?.note || '').slice(0, 300) };
    });
  }

  private normaliseLossReason(v: any): LossReason {
    const s = String(v || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return (LOSS_REASONS as readonly string[]).includes(s) ? (s as LossReason) : 'other';
  }

  private strings(v: any, max: number, len: number): string[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x: string) => x.trim().slice(0, len))
      .slice(0, max);
  }

  /** Weighted pass rate, 0-100. */
  private score(checks: { key: string; pass: boolean }[]): number {
    let got = 0;
    let total = 0;
    for (const c of checks) {
      const w = WEIGHTS[c.key] ?? 0;
      total += w;
      if (c.pass) got += w;
    }
    return total ? Math.round((got / total) * 100) : 0;
  }

  /**
   * Share of spoken words that came from the agent. Vapi gives per-speaker
   * segments; without them this is simply unknown rather than guessed.
   */
  private talkRatio(call: any): number {
    const segments = call.transcriptSegments;
    if (!Array.isArray(segments) || !segments.length) return 0;
    let agent = 0;
    let all = 0;
    for (const s of segments) {
      const words = String(s?.text || s?.message || '').trim().split(/\s+/).filter(Boolean).length;
      if (!words) continue;
      all += words;
      // Vapi writes 'ai' / 'lead'; other providers say assistant / bot / user
      const who = String(s?.role || s?.speaker || '').toLowerCase();
      if (/^(ai|assistant|agent|bot)$/.test(who) || who.includes('assistant') || who.includes('agent')) agent += words;
    }
    return all ? Math.round((agent / all) * 100) : 0;
  }

  /**
   * A call with no transcript still tells us something: nobody answered, or
   * the line dropped. Grade only what is actually known.
   */
  private withoutTranscript(call: any) {
    const outcome = String(call.outcome || '');
    const noContact = ['no_answer', 'voicemail', 'busy', 'wrong_number'].includes(outcome);
    return {
      checks: QA_CHECKS.map((key) => ({ key, pass: false, note: 'No transcript to review.' })),
      score: 0,
      lossReason: (noContact ? 'unreachable' : 'other') as LossReason,
      lossQuote: '',
      competitors: [],
      unansweredQuestions: [],
      coaching: noContact
        ? 'Nobody picked up. Try a different hour of the day before writing this lead off.'
        : 'No transcript was recorded for this call, so it could not be reviewed.',
      bestLine: '',
      model: '',
    };
  }
}
