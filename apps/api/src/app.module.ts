import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import configuration from './config/configuration';
import { validate } from './config/env.validation';

// Guards
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { TenantGuard } from './common/guards/tenant.guard';

// Filters & Interceptors
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { MaskContactInterceptor } from './common/interceptors/mask-contact.interceptor';

// Providers
import { AIModule } from './providers/ai/ai.module';
import { EmailModule } from './providers/email/email.module';
import { StorageModule } from './providers/storage/storage.module';
import { RedisModule } from './providers/redis/redis.module';

// Modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { AgentModule } from './modules/agent/agent.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { WidgetModule } from './modules/widget/widget.module';
import { LeadModule } from './modules/lead/lead.module';
import { LeadFieldModule } from './modules/lead-field/lead-field.module';
import { LeadScoreModule } from './modules/lead-score/lead-score.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { SupportTicketModule } from './modules/support-ticket/support-ticket.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { WebsiteModule } from './modules/website/website.module';
import { FollowUpModule } from './modules/follow-up/follow-up.module';
import { VisitorTrackingModule } from './modules/visitor-tracking/visitor-tracking.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';
import { LeadAutomationModule } from './modules/lead-automation/lead-automation.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { SocialProspectingModule } from './modules/social-prospecting/social-prospecting.module';
import { FollowUpTaskModule } from './modules/follow-up-task/follow-up-task.module';
import { CallingModule } from './modules/calling/calling.module';

// Gateways (WebSocket)
import { GatewayModule } from './gateways/gateway.module';

// Platform events (in-process bus + listeners for webhooks/notifications/sockets/scoring)
import { EventBusModule } from './common/events/event-bus.module';
import { EventsModule } from './modules/events/events.module';

// Schemas for audit log interceptor
import { MongooseModule as MongooseFeatureModule } from '@nestjs/mongoose';
import { AuditLogSchema } from './schemas/audit-log.schema';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        dbName: configService.get<string>('mongodb.dbName'),
        minPoolSize: configService.get<number>('mongodb.minPoolSize') || 5,
        maxPoolSize: configService.get<number>('mongodb.maxPoolSize') || 20,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      }),
      inject: [ConfigService],
    }),

    // JWT (global for guards)
    JwtModule.register({ global: true }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: (configService.get<number>('rateLimit.ttl') || 60) * 1000,
          limit: configService.get<number>('rateLimit.max') || 100,
        },
      ],
      inject: [ConfigService],
    }),

    // Audit Log schema for interceptor
    MongooseFeatureModule.forFeature([
      { name: 'AuditLog', schema: AuditLogSchema },
    ]),

    // Event bus (global) - must be registered before feature modules that emit on it
    EventBusModule,

    // Per-tenant API credentials (global): every provider resolves keys through this
    CredentialsModule,

    // Platform-wide settings (global): maintenance mode, signup toggle, announcement, plan limits
    PlatformModule,

    // Providers
    AIModule,
    EmailModule,
    StorageModule,
    RedisModule,

    // Feature Modules
    HealthModule,
    AuthModule,
    UserModule,
    TenantModule,
    AgentModule,
    KnowledgeBaseModule,
    ConversationModule,
    WidgetModule,
    LeadModule,
    LeadFieldModule,
    LeadScoreModule,
    DashboardModule,
    NotificationModule,
    HandoffModule,
    SupportTicketModule,
    WebhookModule,
    ApiKeyModule,
    AnalyticsModule,
    AppointmentModule,
    CalendarModule,
    WhatsAppModule,
    WebsiteModule,
    FollowUpModule,
    VisitorTrackingModule,
    BillingModule,
    IntegrationsModule,
    AccountDeletionModule,

    // Google Maps prospecting (ADMIN + owner)
    LeadAutomationModule,

    // Leads Scrap AI - Reddit/HN/Quora/web buying-intent prospecting (ADMIN + owner)
    SocialProspectingModule,

    // Follow-up tasks (due nudges, overdue escalation) + AI calling engine
    FollowUpTaskModule,
    CallingModule,

    // Owner console (SUPER_ADMIN only, cross-tenant)
    SuperAdminModule,

    // WebSocket Gateways
    GatewayModule,

    // Event listeners (webhooks, notifications, realtime, scoring)
    EventsModule,
  ],
  providers: [
    // Global Guards (order matters: Auth → Tenant → Roles)
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Trial over / subscription lapsed: the workspace goes read-only until it pays
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global Filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global Interceptor
    // Registered first so it runs LAST on the response: the finished payload,
    // whatever endpoint produced it, leaves without contact details for VIEWER
    { provide: APP_INTERCEPTOR, useClass: MaskContactInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
