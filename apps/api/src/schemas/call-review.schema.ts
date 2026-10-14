import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CallReviewDocument = HydratedDocument<CallReview>;

/**
 * Why a deal did not move. One of these per reviewed call, so a month of calls
 * can be counted and the biggest leak named.
 */
export const LOSS_REASONS = [
  'price', // too expensive, cheaper elsewhere
  'timing', // interested, but not now
  'competitor', // already with someone else
  'trust', // did not believe us / wanted proof
  'not_relevant', // we do not sell what they need
  'no_authority', // the person cannot decide
  'unreachable', // never actually spoke
  'none', // nothing was lost - it went well
  'other',
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

/** The rubric. Each one is a yes/no a sales manager would ask about a call. */
export const QA_CHECKS = [
  'opened_well', // introduced itself and why it is calling, in one breath
  'asked_need', // found out what the lead actually wants
  'asked_budget', // money came up
  'asked_timeline', // when they want it
  'handled_objection', // answered the push-back instead of talking past it
  'asked_for_meeting', // actually asked for the next step
  'confirmed_next_step', // both sides left knowing what happens next
  'let_lead_speak', // did not monologue
  'stayed_in_language', // spoke the language the lead spoke
  'stayed_truthful', // promised nothing outside what we sell
] as const;
export type QaCheck = (typeof QA_CHECKS)[number];

@Schema({ _id: false })
export class QaCheckResult {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  pass: boolean;

  /** One short line: what it did, or what it should have done. */
  @Prop({ type: String, default: '' })
  note: string;
}

/**
 * The marksheet for one call: how the agent performed against a fixed rubric,
 * why the deal did not move, and the one thing to fix. Written by the LLM a
 * minute or two after the call ends, and never edited by hand - a changed
 * script is measured by the next calls, not by rewriting the old grades.
 */
@Schema({ timestamps: true })
export class CallReview {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, unique: true, index: true })
  callId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  /** 0-100. The rubric passes, weighted by how much each one matters. */
  @Prop({ required: true, default: 0, index: true })
  score: number;

  @Prop({ type: [QaCheckResult], default: [] })
  checks: QaCheckResult[];

  /** Share of the words the agent spoke, 0-100. Over ~70 means it monologued. */
  @Prop({ type: Number, default: 0 })
  agentTalkRatio: number;

  @Prop({ type: String, enum: LOSS_REASONS, default: 'other', index: true })
  lossReason: LossReason;

  /** The lead's own words that gave away the reason. Quoted, never paraphrased. */
  @Prop({ type: String, default: '' })
  lossQuote: string;

  /** Competitor names the lead mentioned, as they said them. */
  @Prop({ type: [String], default: [] })
  competitors: string[];

  /** What the lead asked for that we could not answer. Feeds the knowledge base. */
  @Prop({ type: [String], default: [] })
  unansweredQuestions: string[];

  /** The single change that would most improve the next call like this one. */
  @Prop({ type: String, default: '' })
  coaching: string;

  /** The best thing the agent said, so a good line can be promoted into the script. */
  @Prop({ type: String, default: '' })
  bestLine: string;

  /** Which script experiment and variant were live for this call, if any. */
  @Prop({ type: String, default: '', index: true })
  experimentId: string;

  @Prop({ type: String, default: '' })
  variantKey: string;

  /** Copied off the call so the dashboard can group without a join. */
  @Prop({ type: String, default: '' })
  outcome: string;

  @Prop({ type: Number, default: 0 })
  interestLevel: number;

  @Prop({ type: Number, default: 0 })
  durationSeconds: number;

  @Prop({ type: Date, index: true })
  callEndedAt: Date;

  /** Which model graded it, so a grading change is traceable. */
  @Prop({ type: String, default: '' })
  model: string;

  /** 'llm' when graded by the model, 'heuristic' when the model was unavailable. */
  @Prop({ type: String, default: 'llm' })
  source: string;
}

export const CallReviewSchema = SchemaFactory.createForClass(CallReview);
CallReviewSchema.index({ tenantId: 1, callEndedAt: -1 });
CallReviewSchema.index({ tenantId: 1, lossReason: 1, callEndedAt: -1 });
CallReviewSchema.index({ tenantId: 1, experimentId: 1, variantKey: 1 });
