import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LEAD_STATUSES } from '../common/constants/pipeline';

export type LeadDocument = HydratedDocument<Lead>;

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ trim: true })
  firstName: string;

  @Prop({ trim: true })
  lastName: string;

  @Prop({ lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ trim: true })
  company: string;

  @Prop({
    type: String,
    enum: LEAD_STATUSES,
    default: 'new',
  })
  status: string;

  @Prop({
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'cold',
  })
  temperature: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ type: String })
  source: string;

  @Prop({ type: String })
  assignedTo: string;

  @Prop({ type: Object, default: {} })
  customFields: Record<string, any>;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  conversationIds: string[];

  @Prop({
    type: {
      url: String,
      referrer: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      userAgent: String,
      ip: String,
      country: String,
      city: String,
    },
    default: {},
  })
  metadata: {
    url?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    userAgent?: string;
    ip?: string;
    country?: string;
    city?: string;
  };

  // AI-generated summary of the lead's latest conversation + structured insights
  @Prop({ type: String })
  aiSummary: string;

  @Prop({ type: Object })
  aiInsights: {
    requirement?: string;
    budget?: string;
    timeline?: string;
    intent?: 'high' | 'medium' | 'low';
    nextStep?: string;
    keyPoints?: string[];
    objections?: string[];
  };

  @Prop()
  aiSummaryUpdatedAt: Date;

  // Point 3: Executive Buyer Intelligence & Dossier
  @Prop({
    type: {
      companySummary: String,
      estimatedSize: String,
      industry: String,
      buyerIntent: String,
      painPoints: [String],
      dealClosingPitch: String,
      recommendedAction: String,
      generatedAt: Date,
    },
  })
  dossier: {
    companySummary?: string;
    estimatedSize?: string;
    industry?: string;
    buyerIntent?: string;
    painPoints?: string[];
    dealClosingPitch?: string;
    recommendedAction?: string;
    generatedAt?: Date;
  };

  // Point 4: WhatsApp Voice Note Script & Assistant
  @Prop({
    type: {
      script: String,
      durationEstimate: String,
      angle: String,
      generatedAt: Date,
    },
  })
  voiceNoteScript: {
    script?: string;
    durationEstimate?: string;
    angle?: string;
    generatedAt?: Date;
  };

  // ─── AI calling & follow-up pipeline ───────────────────────────────
  // Where the automatic first call stands for this lead
  @Prop({ type: String, enum: ['none', 'queued', 'calling', 'done', 'failed', 'skipped'], default: 'none' })
  aiCallStatus: string;

  // Outbound dial attempts (AI + human) so retries stop at the tenant's limit
  @Prop({ default: 0 })
  callAttempts: number;

  @Prop()
  lastCallAt: Date;

  // Outcome of the most recent analysed call (interested, no_answer, callback, ...)
  @Prop({ type: String })
  lastCallOutcome: string;

  // First moment a real conversation (call answered / message delivered) happened
  @Prop()
  lastContactedAt: Date;

  // Earliest pending follow-up task - drives the "Follow-up" stage and overdue alerts
  @Prop()
  nextFollowUpAt: Date;

  // How many times the cold-lead re-engagement loop reached out
  @Prop({ default: 0 })
  reengageAttempts: number;

  @Prop()
  lastReengagedAt: Date;

  // Latest structured read of the lead from a call transcript
  @Prop({ type: Object })
  aiCallInsights: {
    interestLevel?: number;
    outcome?: string;
    summary?: string;
    requirement?: string;
    budget?: string;
    timeline?: string;
    objections?: string[];
    nextAction?: string;
    nextActionReason?: string;
    callbackAt?: Date;
    callId?: string;
    analysedAt?: Date;
  };

  @Prop({ type: String })
  lostReason: string;

  @Prop()
  lastActivityAt: Date;

  // Set when the lead is marked Won (kept under its historical name)
  @Prop()
  convertedAt: Date;

  @Prop()
  deletedAt: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ tenantId: 1, email: 1 });
LeadSchema.index({ tenantId: 1, status: 1 });
LeadSchema.index({ tenantId: 1, score: -1 });
LeadSchema.index({ tenantId: 1, assignedTo: 1 });
LeadSchema.index({ tenantId: 1, createdAt: -1 });
LeadSchema.index({ tenantId: 1, nextFollowUpAt: 1 });
LeadSchema.index({ tenantId: 1, status: 1, lastActivityAt: 1 });
