import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EXPERIMENT_FIELDS,
  EXPERIMENT_METRICS,
  type ExperimentField,
  type ExperimentMetric,
} from '../../schemas/script-experiment.schema';

/** Which assistant setting each testable field writes to. */
const FIELD_TO_SETTING: Record<ExperimentField, string> = {
  greeting: 'firstMessage',
  pitch: 'offerSummary',
  goal: 'extraInstructions',
};

export interface VariantPick {
  experimentId: string;
  variantKey: string;
  field: ExperimentField;
  text: string;
}

/**
 * A/B tests on the calling script.
 *
 * Calls are split between the variants, every finished call updates the
 * counters, and once both sides have enough answered calls the better one is
 * written back into the workspace's own settings. The point is not statistical
 * rigour - it is that the script stops being whatever somebody typed once and
 * starts being the one that books more meetings.
 */
@Injectable()
export class ExperimentService {
  private readonly logger = new Logger(ExperimentService.name);

  constructor(
    @InjectModel('ScriptExperiment') private readonly experimentModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
  ) {}

  // ─── Picking a variant for a call ─────────────────────────────────

  /**
   * The variant this call should run, or null when nothing is being tested.
   * Assignment is least-used-first rather than random: over the small call
   * volumes a sales team actually does, a coin flip leaves the sides uneven
   * for a long time.
   */
  async variantFor(tenantId: string): Promise<VariantPick | null> {
    const exp: any = await this.experimentModel
      .findOne({ tenantId, status: 'running' })
      .sort({ startedAt: 1 })
      .lean();
    if (!exp?.variants?.length) return null;

    const next = [...exp.variants].sort((a, b) => (a.calls || 0) - (b.calls || 0))[0];
    if (!next?.text) return null;

    await this.experimentModel.updateOne(
      { _id: exp._id, 'variants.key': next.key },
      { $inc: { 'variants.$.calls': 1 } },
    );

    return {
      experimentId: String(exp._id),
      variantKey: next.key,
      field: exp.field,
      text: next.text,
    };
  }

  // ─── Learning from a finished call ────────────────────────────────

  /** Called once per graded call. Then checks whether a winner is now clear. */
  async recordCall(
    experimentId: string,
    variantKey: string,
    r: { answered: boolean; meeting: boolean; interested: boolean; interestLevel: number; qaScore: number },
  ): Promise<void> {
    if (!experimentId || !variantKey) return;
    const inc: Record<string, number> = {};
    if (r.answered) inc['variants.$.answered'] = 1;
    if (r.meeting) inc['variants.$.meetings'] = 1;
    if (r.interested) inc['variants.$.interested'] = 1;
    if (r.interestLevel) inc['variants.$.interestSum'] = r.interestLevel;
    if (r.answered) {
      inc['variants.$.qaScoreSum'] = r.qaScore || 0;
      inc['variants.$.qaScored'] = 1;
    }
    if (!Object.keys(inc).length) return;

    await this.experimentModel.updateOne(
      { _id: experimentId, 'variants.key': variantKey },
      { $inc: inc },
    );
    await this.evaluate(experimentId).catch((err) =>
      this.logger.warn(`Evaluating experiment ${experimentId} failed: ${err?.message}`),
    );
  }

  /** The metric as a percentage, so two variants compare on one number. */
  private rate(v: any, metric: ExperimentMetric): number {
    const answered = v.answered || 0;
    if (!answered) return 0;
    if (metric === 'meetings') return ((v.meetings || 0) / answered) * 100;
    if (metric === 'interested') return ((v.interested || 0) / answered) * 100;
    return (v.interestSum || 0) / answered; // interest_score, already 0-100
  }

  /**
   * Declare a winner once every variant has enough answered calls. Nothing is
   * promoted on a hunch: below the minimum sample, the lead changes hands
   * every few calls and means nothing.
   */
  async evaluate(experimentId: string): Promise<{ promoted: boolean; winnerKey?: string }> {
    const exp: any = await this.experimentModel.findById(experimentId);
    if (!exp || exp.status !== 'running' || exp.variants.length < 2) return { promoted: false };

    const min = exp.minAnsweredPerVariant || 25;
    if (exp.variants.some((v: any) => (v.answered || 0) < min)) return { promoted: false };

    const ranked = [...exp.variants].sort((a: any, b: any) => this.rate(b, exp.metric) - this.rate(a, exp.metric));
    const [winner, runnerUp] = ranked;
    const lift = this.rate(winner, exp.metric) - this.rate(runnerUp, exp.metric);

    // A dead heat is not a result - keep running rather than promoting noise
    if (lift < 1) return { promoted: false };

    exp.winnerKey = winner.key;
    exp.winnerLiftPoints = Math.round(lift * 10) / 10;

    if (!exp.autoPromote) {
      exp.status = 'stopped';
      await exp.save();
      this.logger.log(`Experiment ${exp.name}: ${winner.key} won by ${exp.winnerLiftPoints}pts, awaiting approval`);
      return { promoted: false, winnerKey: winner.key };
    }

    await this.writeToSettings(exp, winner.text);
    exp.status = 'promoted';
    exp.promotedAt = new Date();
    await exp.save();
    this.logger.log(`Experiment ${exp.name}: promoted ${winner.key} (+${exp.winnerLiftPoints}pts)`);
    return { promoted: true, winnerKey: winner.key };
  }

  /** Write the winning text into the workspace's calling settings. */
  private async writeToSettings(exp: any, text: string): Promise<void> {
    const key = FIELD_TO_SETTING[exp.field as ExperimentField];
    if (!key) return;
    const tenant: any = await this.tenantModel.findById(exp.tenantId).select('callingSettings').lean();
    exp.previousText = tenant?.callingSettings?.assistant?.[key] || '';
    await this.tenantModel.updateOne(
      { _id: exp.tenantId },
      { $set: { [`callingSettings.assistant.${key}`]: text } },
    );
  }

  /**
   * Check every running test. Called from the grading sweep so a winner is
   * promoted even in a week where no new call happened to be graded.
   */
  async evaluateAll(): Promise<number> {
    const running: any[] = await this.experimentModel.find({ status: 'running' }).select('_id').lean();
    let promoted = 0;
    for (const e of running) {
      const r = await this.evaluate(String(e._id)).catch(() => ({ promoted: false }));
      if (r.promoted) promoted++;
    }
    return promoted;
  }

  /** Put back what the field held before a promotion. */
  async revert(tenantId: string, experimentId: string): Promise<boolean> {
    const exp: any = await this.experimentModel.findOne({ _id: experimentId, tenantId });
    if (!exp || exp.status !== 'promoted') return false;
    const key = FIELD_TO_SETTING[exp.field as ExperimentField];
    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { [`callingSettings.assistant.${key}`]: exp.previousText || '' } },
    );
    exp.status = 'stopped';
    await exp.save();
    return true;
  }

  // ─── Managing experiments ─────────────────────────────────────────

  async list(tenantId: string) {
    const rows: any[] = await this.experimentModel.find({ tenantId }).sort({ createdAt: -1 }).limit(50).lean();
    return rows.map((e) => this.present(e));
  }

  async create(tenantId: string, dto: any) {
    const field: ExperimentField = EXPERIMENT_FIELDS.includes(dto?.field) ? dto.field : 'greeting';
    const metric: ExperimentMetric = EXPERIMENT_METRICS.includes(dto?.metric) ? dto.metric : 'meetings';

    const variants = (Array.isArray(dto?.variants) ? dto.variants : [])
      .filter((v: any) => typeof v?.text === 'string' && v.text.trim())
      .slice(0, 3)
      .map((v: any, i: number) => ({
        key: String.fromCharCode(97 + i), // a, b, c
        label: String(v.label || `Variant ${String.fromCharCode(65 + i)}`).slice(0, 60),
        text: String(v.text).trim().slice(0, 2000),
        calls: 0,
        answered: 0,
        meetings: 0,
        interested: 0,
        interestSum: 0,
        qaScoreSum: 0,
        qaScored: 0,
      }));
    if (variants.length < 2) throw new Error('An experiment needs at least two variants');

    // One running test at a time, or the two overlap and neither result means anything
    await this.experimentModel.updateMany({ tenantId, status: 'running' }, { $set: { status: 'stopped' } });

    const created = await this.experimentModel.create({
      tenantId,
      name: String(dto?.name || 'Script test').slice(0, 80),
      field,
      metric,
      variants,
      minAnsweredPerVariant: Math.max(5, Math.min(500, Number(dto?.minAnsweredPerVariant) || 25)),
      autoPromote: dto?.autoPromote !== false,
      status: 'running',
      startedAt: new Date(),
    });
    return this.present(created.toObject());
  }

  async setStatus(tenantId: string, id: string, status: 'running' | 'stopped') {
    if (status === 'running') {
      await this.experimentModel.updateMany({ tenantId, status: 'running' }, { $set: { status: 'stopped' } });
    }
    const updated = await this.experimentModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status, ...(status === 'running' ? { startedAt: new Date() } : {}) } },
      { new: true },
    );
    return updated ? this.present(updated.toObject()) : null;
  }

  async remove(tenantId: string, id: string) {
    await this.experimentModel.deleteOne({ _id: id, tenantId });
  }

  /** The shape the dashboard renders: counters turned into rates. */
  private present(e: any) {
    const metric: ExperimentMetric = e.metric || 'meetings';
    const variants = (e.variants || []).map((v: any) => ({
      key: v.key,
      label: v.label,
      text: v.text,
      calls: v.calls || 0,
      answered: v.answered || 0,
      meetings: v.meetings || 0,
      interested: v.interested || 0,
      meetingRate: v.answered ? Math.round(((v.meetings || 0) / v.answered) * 1000) / 10 : 0,
      interestedRate: v.answered ? Math.round(((v.interested || 0) / v.answered) * 1000) / 10 : 0,
      avgInterest: v.answered ? Math.round((v.interestSum || 0) / v.answered) : 0,
      avgQaScore: v.qaScored ? Math.round((v.qaScoreSum || 0) / v.qaScored) : 0,
      score: Math.round(this.rate(v, metric) * 10) / 10,
      /** How many more answered calls this side still needs. */
      remaining: Math.max(0, (e.minAnsweredPerVariant || 25) - (v.answered || 0)),
    }));
    const leader = [...variants].sort((a, b) => b.score - a.score)[0];
    return {
      id: String(e._id),
      name: e.name,
      field: e.field,
      metric,
      status: e.status,
      autoPromote: e.autoPromote !== false,
      minAnsweredPerVariant: e.minAnsweredPerVariant || 25,
      startedAt: e.startedAt,
      promotedAt: e.promotedAt,
      winnerKey: e.winnerKey || '',
      winnerLiftPoints: e.winnerLiftPoints || 0,
      variants,
      /** Null until every side has its minimum - a leader on 3 calls is noise. */
      leadingKey: variants.every((v: any) => !v.remaining) ? leader?.key || '' : '',
      callsToGo: variants.reduce((n: number, v: any) => n + v.remaining, 0),
    };
  }
}
