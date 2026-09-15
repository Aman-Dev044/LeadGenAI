import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  agentId: string;

  @Prop({ index: true })
  leadId: string;

  @Prop({ required: true })
  visitorId: string;

  @Prop({
    type: String,
    enum: ['active', 'ended', 'handed_off', 'archived'],
    default: 'active',
  })
  status: string;

  @Prop({
    type: String,
    enum: ['bot', 'human', 'hybrid'],
    default: 'bot',
  })
  mode: string;

  @Prop({ type: String })
  assignedUserId: string;

  @Prop({
    type: {
      url: String,
      referrer: String,
      userAgent: String,
      ip: String,
      country: String,
      countryCode: String,
      region: String,
      city: String,
      timezone: String,
      device: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      utmTerm: String,
      utmContent: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      company: String,
      notes: String,
    },
    default: {},
  })
  visitorInfo: {
    url?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    timezone?: string;
    device?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    notes?: string;
  };

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ type: String })
  summary: string;

  @Prop()
  summaryUpdatedAt: Date;

  @Prop({ type: Number })
  sentiment: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  endedAt: Date;

  @Prop()
  deletedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ tenantId: 1, status: 1 });
ConversationSchema.index({ tenantId: 1, agentId: 1 });
ConversationSchema.index({ tenantId: 1, leadId: 1 });
ConversationSchema.index({ tenantId: 1, createdAt: -1 });
