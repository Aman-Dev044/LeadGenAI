import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ trim: true })
  domain: string;

  @Prop({ type: [String], default: [] })
  allowedOrigins: string[];

  @Prop({ trim: true })
  logo: string;

  @Prop({
    type: {
      primaryColor: String,
      secondaryColor: String,
      fontFamily: String,
    },
    default: {},
  })
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };

  @Prop({
    type: String,
    enum: ['active', 'suspended', 'trial', 'cancelled'],
    default: 'trial',
  })
  status: string;

  @Prop({
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free',
  })
  plan: string;

  @Prop({
    type: {
      maxAgents: { type: Number, default: 1 },
      maxLeads: { type: Number, default: 100 },
      maxConversationsPerMonth: { type: Number, default: 500 },
      maxKnowledgeSources: { type: Number, default: 5 },
      maxUsers: { type: Number, default: 2 },
    },
    default: {},
  })
  limits: {
    maxAgents: number;
    maxLeads: number;
    maxConversationsPerMonth: number;
    maxKnowledgeSources: number;
    maxUsers: number;
  };

  @Prop({
    type: {
      aiProvider: { type: String, default: 'openai' },
      aiModel: { type: String, default: 'gpt-4o-mini' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      language: { type: String, default: 'en' },
    },
    default: {},
  })
  settings: {
    aiProvider: string;
    aiModel: string;
    timezone: string;
    language: string;
  };

  @Prop({
    type: {
      emailOnNewLead: { type: Boolean, default: true },
      emailOnHotLead: { type: Boolean, default: true },
      emailOnHandoff: { type: Boolean, default: true },
      slackWebhookUrl: { type: String, default: '' },
      teamsWebhookUrl: { type: String, default: '' },
      notifyRoles: { type: [String], default: ['ADMIN', 'SALES_MANAGER'] },
    },
    default: {},
  })
  notificationSettings: {
    emailOnNewLead: boolean;
    emailOnHotLead: boolean;
    emailOnHandoff: boolean;
    slackWebhookUrl?: string;
    teamsWebhookUrl?: string;
    notifyRoles: string[];
  };

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      strategy: { type: String, enum: ['round_robin', 'least_loaded'], default: 'round_robin' },
      roles: { type: [String], default: ['SALESPERSON', 'SALES_MANAGER'] },
      rules: {
        type: [{ field: String, operator: String, value: Object, assignTo: String }],
        default: [],
      },
      fallbackUserId: { type: String, default: '' },
      assignHandoffs: { type: Boolean, default: true },
    },
    default: {},
  })
  assignmentSettings: {
    enabled: boolean;
    strategy: 'round_robin' | 'least_loaded';
    roles: string[];
    rules: { field: string; operator: string; value?: any; assignTo: string }[];
    fallbackUserId?: string;
    assignHandoffs: boolean;
  };

  @Prop({ type: { lastAssignedUserId: String, lastAssignedAt: Date }, default: {} })
  assignmentState: { lastAssignedUserId?: string; lastAssignedAt?: Date };

  @Prop()
  trialEndsAt: Date;

  // Last "your plan/trial is about to expire" reminder; one per expiry date (see PlanExpiryReminderService)
  @Prop({ type: { kind: String, plan: String, expiresAt: Date, sentAt: Date }, default: undefined })
  renewalReminder: { kind: 'trial' | 'subscription'; plan: string; expiresAt: Date; sentAt: Date };

  // ---- Super admin (owner) managed fields ----

  // Per-tenant feature flags; override the platform-wide defaults
  @Prop({ type: Object, default: {} })
  featureFlags: Record<string, boolean>;

  // Private notes only visible in the owner console
  @Prop({ type: String, default: '' })
  internalNotes: string;

  @Prop({ type: String })
  suspendedReason: string;

  @Prop()
  suspendedAt: Date;

  // Marks the platform owner's own workspace (cannot be suspended/deleted)
  @Prop({ default: false })
  isPlatformOwner: boolean;

  @Prop({ type: String })
  createdBy: string;

  @Prop()
  deletedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.index({ slug: 1 });
TenantSchema.index({ status: 1 });
