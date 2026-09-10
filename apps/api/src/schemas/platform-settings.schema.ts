import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

/**
 * Singleton document (key = "global") holding platform-wide switches that only the
 * super admin ("owner") can change: maintenance mode, signup toggle, announcement
 * banner, default plan limits and global feature flags.
 */
@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ default: 'LeadAI' })
  platformName: string;

  @Prop({ default: '' })
  supportEmail: string;

  // Maintenance mode: every non-super-admin request is rejected with 503
  @Prop({ default: false })
  maintenanceMode: boolean;

  @Prop({ default: 'The platform is under scheduled maintenance. Please try again shortly.' })
  maintenanceMessage: string;

  // Public self-service registration
  @Prop({ default: true })
  signupEnabled: boolean;

  @Prop({ type: String, enum: ['free', 'starter', 'professional', 'enterprise'], default: 'free' })
  defaultPlan: string;

  @Prop({ default: 14 })
  trialDays: number;

  // Banner shown to every logged-in user of every tenant
  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' },
      level: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
      link: { type: String, default: '' },
      startsAt: { type: Date },
      endsAt: { type: Date },
    },
    default: {},
  })
  announcement: {
    enabled: boolean;
    message: string;
    level: 'info' | 'warning' | 'critical';
    link?: string;
    startsAt?: Date;
    endsAt?: Date;
  };

  // Global default feature flags (a tenant's own flags override these)
  @Prop({ type: Object, default: {} })
  featureFlags: Record<string, boolean>;

  // Limits applied when a tenant is created / its plan is changed
  @Prop({ type: Object, default: {} })
  planLimits: Record<
    string,
    {
      maxAgents: number;
      maxLeads: number;
      maxConversationsPerMonth: number;
      maxKnowledgeSources: number;
      maxUsers: number;
    }
  >;

  // Slugs nobody can register (owner, admin, api, ...)
  @Prop({ type: [String], default: [] })
  reservedSlugs: string[];

  @Prop({ type: String })
  updatedBy: string;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
