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
import { TenantGuard } from './common/guards/tenant.guard';

// Filters & Interceptors
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

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
import { FollowUpModule } from './modules/follow-up/follow-up.module';
import { VisitorTrackingModule } from './modules/visitor-tracking/visitor-tracking.module';
import { BillingModule } from './modules/billing/billing.module';

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
    FollowUpModule,
    VisitorTrackingModule,
    BillingModule,

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
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global Filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global Interceptor
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
