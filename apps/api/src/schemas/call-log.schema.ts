import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CallLogDocument = HydratedDocument<CallLog>;

/** Who placed the call and how. */
export const CALL_TYPES = ['ai_outbound', 'ai_inbound', 'ai_reengage', 'human_outbound', 'manual'] as const;

/** Lifecycle. `queued` and `scheduled` are before dialing; the rest come from the provider. */
export const CALL_STATUSES = [
  'queued',
  'scheduled',
  'dialing',
  'ringing',
  'in_progress',
  'transferring',
  'completed',
  'no_answer',
  'busy',
  'voicemail',
  'failed',
  'cancelled',
] as const;

/** What the AI concluded from the conversation. */
export const CALL_OUTCOMES = [
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
] as const;

/**
 * One phone call - placed by the AI agent, bridged for a salesperson through
 * Twilio, or logged by hand. Holds the recording, the transcript and the
 * structured analysis that drives the next step in the pipeline.
 */
@Schema({ timestamps: true })
export class CallLog {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  leadId: string;

  @Prop({ type: String, enum: CALL_TYPES, required: true })
  type: string;

  /** Who dialled: we called them, or they called us. */
  @Prop({ type: String, enum: ['outbound', 'inbound'], default: 'outbound', index: true })
  direction: string;

  @Prop({ type: String, enum: ['vapi', 'twilio', 'manual'], required: true })
  provider: string;

  @Prop({ type: String, enum: CALL_STATUSES, default: 'queued', index: true })
  status: string;

  /** Vapi call id or Twilio CallSid - what the webhooks key on. */
  @Prop({ type: String, index: true, sparse: true })
  externalId: string;

  /** Twilio: the leg that dialed the lead (child call) carries the recording. */
  @Prop({ type: String, index: true, sparse: true })
  childExternalId: string;

  @Prop({ type: String })
  toNumber: string;

  @Prop({ type: String })
  fromNumber: string;

  /** Salesperson on the line for human calls; whoever pressed the button otherwise. */
  @Prop({ type: String, index: true, sparse: true })
  userId: string;

  /** 1-based dial attempt for this lead (retries after no-answer bump it). */
  @Prop({ default: 1 })
  attempt: number;

  /** Why the call was placed: new_lead, retry, callback, reengage, manual, workflow. */
  @Prop({ type: String })
  reason: string;

  @Prop({ index: true })
  scheduledAt: Date;

  @Prop()
  startedAt: Date;

  @Prop()
  answeredAt: Date;

  @Prop()
  endedAt: Date;

  @Prop({ default: 0 })
  durationSeconds: number;

  /** Provider's own end reason (customer-ended-call, no-answer, voicemail, ...). */
  @Prop({ type: String })
  endedReason: string;

  @Prop({ type: String })
  recordingUrl: string;

  /** Plain-text transcript ("AI: ... / Lead: ..."). */
  @Prop({ type: String })
  transcript: string;

  @Prop({ type: [{ role: String, text: String, at: Number }], default: undefined })
  transcriptSegments: { role: string; text: string; at?: number }[];

  @Prop({ type: String })
  summary: string;

  @Prop({ type: String, enum: CALL_OUTCOMES, index: true })
  outcome: string;

  /** Structured analysis from the transcript - see CallAnalysisService. */
  @Prop({ type: Object })
  analysis: {
    interestLevel?: number;
    sentiment?: string;
    requirement?: string;
    budget?: string;
    timeline?: string;
    objections?: string[];
    keyPoints?: string[];
    callbackAt?: Date;
    nextAction?: { type: string; title: string; dueInHours?: number; dueAt?: Date; reason?: string };
    suggestedStatus?: string;
    temperature?: string;
    meeting?: { at?: Date; durationMinutes?: number; note?: string };
    language?: string;
    source?: 'provider' | 'llm' | 'manual';
    whatsappDetails?: string;
  };

  /** Notes typed by the salesperson (manual calls, or after a bridged call). */
  @Prop({ type: String })
  notes: string;

  /** What the pipeline did with this call (status change, task id, whatsapp sent...). */
  @Prop({ type: Object })
  actions: Record<string, any>;

  @Prop({ type: Number })
  costUsd: number;

  @Prop({ type: String })
  errorMessage: string;

  /** Untouched provider payload for debugging. */
  @Prop({ type: Object })
  raw: Record<string, any>;
}

export const CallLogSchema = SchemaFactory.createForClass(CallLog);

CallLogSchema.index({ tenantId: 1, createdAt: -1 });
CallLogSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
CallLogSchema.index({ tenantId: 1, status: 1, scheduledAt: 1 });
CallLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
