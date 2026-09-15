import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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
    enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'],
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

  @Prop()
  lastActivityAt: Date;

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
