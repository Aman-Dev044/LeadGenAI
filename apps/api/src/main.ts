import * as dns from 'dns';
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as mongoSanitize from 'express-mongo-sanitize';
import { join } from 'path';
import { AppModule } from './app.module';
import { tenantContext } from './common/plugins/tenant-scope.plugin';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Behind a load balancer / reverse proxy: get real client IPs for rate limiting + lead metadata
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Let OnModuleDestroy hooks (follow-up scheduler, DB) run on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Serve widget.js at root (before global prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/widget.js', (_req: any, res: any) => {
    const widgetPath = join(__dirname, '..', '..', '..', 'widget', 'dist', 'widget.js');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(widgetPath, (err: any) => {
      if (err) res.status(404).send('Widget not found. Build the widget first: cd apps/widget && npm run build');
    });
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security headers
  app.use(helmet());

  // NoSQL injection protection
  const sanitizeFn = (mongoSanitize as any).default || mongoSanitize;
  app.use(sanitizeFn());

  // CORS
  //  - Widget endpoints (/api/v1/widget/*, /widget.js) are embedded on customer sites: any origin, no credentials
  //  - Everything else (dashboard/admin API): only the configured origins, with credentials
  const rawOrigins = configService.get<string[]>('cors.origins') || ['http://localhost:3000'];
  const allowAllDashboard = rawOrigins.includes('*');
  const dashboardOrigins = rawOrigins.map((o) => o.trim()).filter((o) => o && o !== '*');
  const isWidgetRequest = (url: string) =>
    url.startsWith('/api/v1/widget') || url.startsWith('/widget.js') || url.startsWith('/api/v1/health');

  app.enableCors((req: any, callback: (err: Error | null, options?: any) => void) => {
    const origin = req.headers?.origin as string | undefined;
    const url: string = req.originalUrl || req.url || '';

    if (isWidgetRequest(url)) {
      callback(null, {
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
        maxAge: 86400,
      });
      return;
    }

    const allowed = !origin || allowAllDashboard || dashboardOrigins.includes(origin);
    callback(null, {
      origin: allowed ? (origin || true) : false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-API-Key'],
      maxAge: 86400,
    });
  });

  // Global validation pipe
  app.use((req: any, _res: any, next: any) => {
    // Wrap each request in tenant context AsyncLocalStorage
    tenantContext.run({ tenantId: '' }, () => {
      next();
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger documentation (disabled in production)
  if (configService.get<boolean>('swagger.enabled') !== false) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Lead Generation API')
    .setDescription('Multi-tenant AI-powered Lead Generation & Qualification Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & Authorization')
    .addTag('users', 'User Management')
    .addTag('tenant', 'Tenant Management')
    .addTag('agents', 'AI Agent Configuration')
    .addTag('knowledge-base', 'Knowledge Base Management')
    .addTag('conversations', 'Chat Conversations')
    .addTag('widget', 'Embeddable Widget API')
    .addTag('leads', 'Lead Management')
    .addTag('lead-fields', 'Custom Lead Fields')
    .addTag('lead-scoring', 'Lead Scoring Rules')
    .addTag('dashboard', 'Analytics Dashboard')
    .addTag('notifications', 'Notification Engine')
    .addTag('handoffs', 'Human Handoff Management')
    .addTag('support-tickets', 'Support Ticket System')
    .addTag('webhooks', 'Webhook Management')
    .addTag('api-keys', 'API Key Management')
    .addTag('analytics', 'Analytics & Reporting')
    .addTag('appointments', 'Appointment Scheduling')
    .addTag('follow-ups', 'Follow-up Workflows')
    .addTag('visitor-tracking', 'Visitor Tracking')
    .addTag('billing', 'Billing & Subscriptions')
    .addTag('super-admin', 'Owner Console (SUPER_ADMIN only, cross-tenant)')
    .addTag('platform', 'Public platform status')
    .addTag('health', 'Health Check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  }

  // Start server
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap();
