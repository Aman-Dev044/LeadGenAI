import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScriptExperimentDocument = HydratedDocument<ScriptExperiment>;

/** Which part of the calling script is under test. */
export const EXPERIMENT_FIELDS = ['greeting', 'pitch', 'goal'] as const;
export type ExperimentField = (typeof EXPERIMENT_FIELDS)[number];

export const EXPERIMENT_STATUSES = ['draft', 'running', 'promoted', 'stopped'] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

/**
 * What the experiment is trying to maximise. Meetings is the honest default -
 * a script that books fewer meetings is worse however warm it sounds.
 */
export const EXPERIMENT_METRICS = ['meetings', 'interested', 'interest_score'] as const;
export type ExperimentMetric = (typeof EXPERIMENT_METRICS)[number];

@Schema({ _id: false })
export class ScriptVariant {
  /** Stable key used on the call log and the review: 'a', 'b', ... */
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  label: string;

  /** The text that replaces the chosen field for calls on this variant. */
  @Prop({ required: true })
  text: string;

  // ─── Counters, written as calls finish ───────────────────────────
  @Prop({ type: Number, default: 0 })
  calls: number;

  @Prop({ type: Number, default: 0 })
  answered: number;

  @Prop({ type: Number, default: 0 })
  meetings: number;

  @Prop({ type: Number, default: 0 })
  interested: number;

  /** Sum of interest levels, so the average needs no second pass. */
  @Prop({ type: Number, default: 0 })
  interestSum: number;

  /** Sum of QA scores on answered calls. */
  @Prop({ type: Number, default: 0 })
  qaScoreSum: number;

  @Prop({ type: Number, default: 0 })
  qaScored: number;
}

/**
 * An A/B test on the calling script. Calls are split between the variants,
 * every finished call updates the counters, and once both sides have enough
 * answered calls the winner is written back into the workspace's settings -
 * automatically, if the workspace allows it.
 *
 * Deliberately simple: two or three variants, one metric, a minimum sample.
 * A sales team does not need a p-value, it needs "this one booked more".
 */
@Schema({ timestamps: true })
export class ScriptExperiment {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: EXPERIMENT_FIELDS, default: 'greeting' })
  field: ExperimentField;

  @Prop({ type: String, enum: EXPERIMENT_METRICS, default: 'meetings' })
  metric: ExperimentMetric;

  @Prop({ type: String, enum: EXPERIMENT_STATUSES, default: 'draft', index: true })
  status: ExperimentStatus;

  @Prop({ type: [ScriptVariant], default: [] })
  variants: ScriptVariant[];

  /**
   * Answered calls each variant needs before a winner may be declared. Below
   * about 20 a side, the "winner" is usually noise.
   */
  @Prop({ type: Number, default: 25 })
  minAnsweredPerVariant: number;

  /** Write the winner into Settings without asking. Off = suggest it instead. */
  @Prop({ type: Boolean, default: true })
  autoPromote: boolean;

  @Prop({ type: Date })
  startedAt: Date;

  @Prop({ type: String, default: '' })
  winnerKey: string;

  @Prop({ type: Date })
  promotedAt: Date;

  /** How much better the winner was, in percentage points of the metric. */
  @Prop({ type: Number, default: 0 })
  winnerLiftPoints: number;

  /** What the field held before the winner was written in, so it can be undone. */
  @Prop({ type: String, default: '' })
  previousText: string;
}

export const ScriptExperimentSchema = SchemaFactory.createForClass(ScriptExperiment);
ScriptExperimentSchema.index({ tenantId: 1, status: 1 });
