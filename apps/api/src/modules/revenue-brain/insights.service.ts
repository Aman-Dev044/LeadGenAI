import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LOSS_REASONS, QA_CHECKS } from '../../schemas/call-review.schema';

/** How each rubric key and loss reason reads on screen. */
const CHECK_LABELS: Record<string, string> = {
  opened_well: 'Opened well',
  asked_need: 'Found the need',
  asked_budget: 'Raised budget',
  asked_timeline: 'Asked the timeline',
  handled_objection: 'Handled the objection',
  asked_for_meeting: 'Asked for the meeting',
  confirmed_next_step: 'Confirmed the next step',
  let_lead_speak: 'Let the lead speak',
  stayed_in_language: 'Stayed in their language',
  stayed_truthful: 'Promised nothing extra',
};

const LOSS_LABELS: Record<string, string> = {
  price: 'Price was too high',
  timing: 'Not right now',
  competitor: 'Already with someone else',
  trust: 'Did not trust us yet',
  not_relevant: 'We do not sell what they need',
  no_authority: 'Spoke to the wrong person',
  unreachable: 'Never actually spoke',
  none: 'Nothing lost - it went well',
  other: 'Something else',
};

export interface Period {
  from: Date;
  to: Date;
}

/**
 * Turns the pile of per-call marksheets into the handful of numbers a manager
 * acts on: how the agent is performing, where the deals leak, which questions
 * it cannot answer, and whether any of that is moving.
 */
@Injectable()
export class InsightsService {
  constructor(
    @InjectModel('CallReview') private readonly reviewModel: Model<any>,
    @InjectModel('CallLog') private readonly callModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
  ) {}

  static periodFor(days: number): Period {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  /** Everything the dashboard needs, in one round trip. */
  async overview(tenantId: string, days = 30) {
    const period = InsightsService.periodFor(days);
    const previous: Period = {
      from: new Date(period.from.getTime() - days * 24 * 60 * 60 * 1000),
      to: period.from,
    };

    const [now, before, lossReasons, weakest, questions, competitors, worstCalls, bestLines] = await Promise.all([
      this.headline(tenantId, period),
      this.headline(tenantId, previous),
      this.lossReasons(tenantId, period),
      this.rubric(tenantId, period),
      this.unansweredQuestions(tenantId, period),
      this.competitors(tenantId, period),
      this.worstCalls(tenantId, period),
      this.bestLines(tenantId, period),
    ]);

    return {
      days,
      period,
      headline: { ...now, previous: before, delta: this.delta(now, before) },
      lossReasons,
      rubric: weakest,
      unansweredQuestions: questions,
      competitors,
      worstCalls,
      bestLines,
      /** The one sentence worth putting at the top of the page. */
      biggestLeak: lossReasons.find((r) => r.key !== 'none')?.label || '',
      weakestSkill: weakest.length ? weakest[weakest.length - 1].label : '',
    };
  }

  /** Reviewed calls, average grade, meeting rate. */
  async headline(tenantId: string, p: Period) {
    const [row] = await this.reviewModel.aggregate([
      { $match: { tenantId, callEndedAt: { $gte: p.from, $lt: p.to } } },
      {
        $group: {
          _id: null,
          reviewed: { $sum: 1 },
          scoreSum: { $sum: '$score' },
          connected: { $sum: { $cond: [{ $gt: ['$durationSeconds', 20] }, 1, 0] } },
          meetings: { $sum: { $cond: [{ $eq: ['$outcome', 'meeting_booked'] }, 1, 0] } },
          interested: {
            $sum: { $cond: [{ $in: ['$outcome', ['interested', 'meeting_booked']] }, 1, 0] },
          },
          talkSum: { $sum: '$agentTalkRatio' },
          talkCount: { $sum: { $cond: [{ $gt: ['$agentTalkRatio', 0] }, 1, 0] } },
        },
      },
    ]);

    const reviewed = row?.reviewed || 0;
    const connected = row?.connected || 0;
    return {
      reviewed,
      connected,
      avgScore: reviewed ? Math.round((row.scoreSum || 0) / reviewed) : 0,
      meetings: row?.meetings || 0,
      meetingRate: connected ? Math.round(((row.meetings || 0) / connected) * 1000) / 10 : 0,
      interestedRate: connected ? Math.round(((row.interested || 0) / connected) * 1000) / 10 : 0,
      agentTalkRatio: row?.talkCount ? Math.round((row.talkSum || 0) / row.talkCount) : 0,
    };
  }

  private delta(now: any, before: any) {
    const d = (a: number, b: number) => Math.round((a - b) * 10) / 10;
    return {
      /** False when the previous period had no reviewed calls - there is nothing to compare against. */
      comparable: (before.reviewed || 0) > 0,
      avgScore: d(now.avgScore, before.avgScore),
      meetingRate: d(now.meetingRate, before.meetingRate),
      interestedRate: d(now.interestedRate, before.interestedRate),
      reviewed: now.reviewed - before.reviewed,
    };
  }

  /** Why deals did not move, biggest first. */
  async lossReasons(tenantId: string, p: Period) {
    const rows = await this.reviewModel.aggregate([
      { $match: { tenantId, callEndedAt: { $gte: p.from, $lt: p.to } } },
      { $group: { _id: '$lossReason', count: { $sum: 1 }, quote: { $first: '$lossQuote' } } },
      { $sort: { count: -1 } },
    ]);
    const total = rows.reduce((n: number, r: any) => n + r.count, 0) || 1;
    return rows
      .filter((r: any) => (LOSS_REASONS as readonly string[]).includes(r._id))
      .map((r: any) => ({
        key: r._id,
        label: LOSS_LABELS[r._id] || r._id,
        count: r.count,
        share: Math.round((r.count / total) * 1000) / 10,
        quote: r.quote || '',
      }));
  }

  /** Pass rate per rubric item - the weakest one is what to fix in the script. */
  async rubric(tenantId: string, p: Period) {
    const rows = await this.reviewModel.aggregate([
      { $match: { tenantId, callEndedAt: { $gte: p.from, $lt: p.to }, source: 'llm' } },
      { $unwind: '$checks' },
      {
        $group: {
          _id: '$checks.key',
          total: { $sum: 1 },
          passed: { $sum: { $cond: ['$checks.pass', 1, 0] } },
          miss: { $first: { $cond: ['$checks.pass', '', '$checks.note'] } },
        },
      },
    ]);
    const byKey = new Map(rows.map((r: any) => [r._id, r]));
    return QA_CHECKS.map((key) => {
      const r: any = byKey.get(key);
      const total = r?.total || 0;
      return {
        key,
        label: CHECK_LABELS[key] || key,
        total,
        passed: r?.passed || 0,
        passRate: total ? Math.round(((r.passed || 0) / total) * 1000) / 10 : 0,
        example: r?.miss || '',
      };
    })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.passRate - a.passRate);
  }

  /** Questions the agent could not answer - each one is a knowledge-base gap. */
  async unansweredQuestions(tenantId: string, p: Period, limit = 10) {
    const rows = await this.reviewModel.aggregate([
      { $match: { tenantId, callEndedAt: { $gte: p.from, $lt: p.to } } },
      { $unwind: '$unansweredQuestions' },
      { $group: { _id: { $toLower: '$unansweredQuestions' }, count: { $sum: 1 }, text: { $first: '$unansweredQuestions' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r: any) => ({ question: r.text, count: r.count }));
  }

  /** Who the leads say they are already talking to. */
  async competitors(tenantId: string, p: Period, limit = 8) {
    const rows = await this.reviewModel.aggregate([
      { $match: { tenantId, callEndedAt: { $gte: p.from, $lt: p.to } } },
      { $unwind: '$competitors' },
      { $group: { _id: { $toLower: '$competitors' }, count: { $sum: 1 }, name: { $first: '$competitors' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r: any) => ({ name: r.name, count: r.count }));
  }

  /** The calls worth listening to, because they went worst. */
  async worstCalls(tenantId: string, p: Period, limit = 5) {
    const rows: any[] = await this.reviewModel
      .find({ tenantId, callEndedAt: { $gte: p.from, $lt: p.to }, source: 'llm', durationSeconds: { $gte: 30 } })
      .sort({ score: 1, callEndedAt: -1 })
      .limit(limit)
      .lean();
    return this.withLeadNames(rows);
  }

  /** Lines that worked, so a good one can be promoted into the script. */
  async bestLines(tenantId: string, p: Period, limit = 5) {
    const rows: any[] = await this.reviewModel
      .find({
        tenantId,
        callEndedAt: { $gte: p.from, $lt: p.to },
        bestLine: { $nin: ['', null] },
      })
      .sort({ score: -1, callEndedAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((r) => ({ callId: r.callId, line: r.bestLine, score: r.score }));
  }

  /** One call's full marksheet, for the drawer on the dashboard. */
  async forCall(tenantId: string, callId: string) {
    const review: any = await this.reviewModel.findOne({ tenantId, callId }).lean();
    if (!review) return null;
    const [withName] = await this.withLeadNames([review]);
    return {
      ...withName,
      checks: (review.checks || []).map((c: any) => ({ ...c, label: CHECK_LABELS[c.key] || c.key })),
      lossLabel: LOSS_LABELS[review.lossReason] || review.lossReason,
    };
  }

  /** A page of reviews for the list view. */
  async list(tenantId: string, opts: { days?: number; limit?: number; skip?: number; lossReason?: string } = {}) {
    const p = InsightsService.periodFor(opts.days ?? 30);
    const where: any = { tenantId, callEndedAt: { $gte: p.from, $lt: p.to } };
    if (opts.lossReason && (LOSS_REASONS as readonly string[]).includes(opts.lossReason)) {
      where.lossReason = opts.lossReason;
    }
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const [rows, total] = await Promise.all([
      this.reviewModel.find(where).sort({ callEndedAt: -1 }).skip(opts.skip || 0).limit(limit).lean(),
      this.reviewModel.countDocuments(where),
    ]);
    return { total, items: await this.withLeadNames(rows as any[]) };
  }

  /** Attach lead names in one query rather than one per row. */
  private async withLeadNames(rows: any[]) {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.leadId).filter(Boolean))];
    const leads: any[] = await this.leadModel.find({ _id: { $in: ids } }).select('firstName lastName company').lean();
    const byId = new Map(leads.map((l) => [String(l._id), l]));
    return rows.map((r) => {
      const l = byId.get(String(r.leadId));
      return {
        callId: r.callId,
        leadId: r.leadId,
        leadName: l ? `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown lead' : 'Unknown lead',
        company: l?.company || '',
        score: r.score,
        outcome: r.outcome,
        lossReason: r.lossReason,
        lossLabel: LOSS_LABELS[r.lossReason] || r.lossReason,
        lossQuote: r.lossQuote,
        coaching: r.coaching,
        bestLine: r.bestLine,
        agentTalkRatio: r.agentTalkRatio,
        durationSeconds: r.durationSeconds,
        callEndedAt: r.callEndedAt,
        checks: r.checks,
      };
    });
  }
}
