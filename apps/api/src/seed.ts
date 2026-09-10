import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import { DEFAULT_PLAN_LIMITS } from './modules/platform/plan-limits.constants';

/**
 * Seed is idempotent and split in two parts:
 *  1. ensureSuperAdmin()  - always runs: creates/repairs the "owner" workspace and the
 *                           SUPER_ADMIN account (credentials from SUPER_ADMIN_* env vars).
 *  2. seedDemo()          - only when the "demo" tenant does not exist yet.
 */
async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

  const config = app.get(ConfigService);
  const tenantModel = app.get<Model<any>>(getModelToken('Tenant'));
  const userModel = app.get<Model<any>>(getModelToken('User'));

  await ensureSuperAdmin(logger, config, tenantModel, userModel);
  await seedDemo(logger, app, tenantModel, userModel);

  await app.close();
}

async function ensureSuperAdmin(logger: Logger, config: ConfigService, tenantModel: Model<any>, userModel: Model<any>) {
  const sa = config.get<any>('superAdmin');

  // Owner workspace
  let owner = await tenantModel.findOne({ $or: [{ slug: sa.tenantSlug }, { isPlatformOwner: true }] });
  if (!owner) {
    owner = await tenantModel.create({
      name: sa.tenantName,
      slug: sa.tenantSlug,
      status: 'active',
      plan: 'enterprise',
      isPlatformOwner: true,
      allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      limits: DEFAULT_PLAN_LIMITS.enterprise,
      settings: { aiProvider: 'openai', aiModel: 'gpt-4o-mini', timezone: 'Asia/Kolkata', language: 'en' },
      internalNotes: 'Platform owner workspace. Do not suspend or delete.',
    });
    logger.log(`Created owner workspace: ${owner.name} (slug: ${owner.slug})`);
  } else {
    // Repair: make sure it is flagged, active and on the enterprise plan
    await tenantModel.updateOne(
      { _id: owner._id },
      { $set: { isPlatformOwner: true, status: 'active', plan: 'enterprise', slug: sa.tenantSlug, limits: DEFAULT_PLAN_LIMITS.enterprise }, $unset: { deletedAt: 1, suspendedAt: 1, suspendedReason: 1 } },
    );
    logger.log(`Owner workspace already exists: ${owner.name} (slug: ${sa.tenantSlug})`);
  }

  // Super admin user - password is always re-applied so the configured credentials work
  const hashed = await bcrypt.hash(sa.password, 12);
  const existing = await userModel.findOne({ tenantId: String(owner._id), email: sa.email }).select('+password');
  if (!existing) {
    await userModel.create({
      tenantId: String(owner._id),
      firstName: sa.firstName,
      lastName: sa.lastName,
      email: sa.email,
      password: hashed,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    logger.log(`Created SUPER_ADMIN: ${sa.email}`);
  } else {
    await userModel.updateOne(
      { _id: existing._id },
      { $set: { password: hashed, role: 'SUPER_ADMIN', isActive: true, emailVerifiedAt: existing.emailVerifiedAt || new Date() }, $unset: { deletedAt: 1 } },
    );
    logger.log(`SUPER_ADMIN already exists, credentials refreshed: ${sa.email}`);
  }

  logger.log('');
  logger.log('Owner console login:');
  logger.log(`  Tenant slug: ${sa.tenantSlug}`);
  logger.log(`  Email:       ${sa.email}`);
  logger.log(`  Password:    ${sa.password}`);
  logger.log('');
}

async function seedDemo(logger: Logger, app: any, tenantModel: Model<any>, userModel: Model<any>) {
  const existingTenant = await tenantModel.findOne({ slug: 'demo' });
  if (existingTenant) {
    logger.log('Demo data already exists. Skipping demo seed.');
    return;
  }

  logger.log('Seeding demo tenant...');

  const tenant = await tenantModel.create({
    name: 'Demo Organization',
    slug: 'demo',
    status: 'active',
    plan: 'professional',
    allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    limits: DEFAULT_PLAN_LIMITS.professional,
    settings: {
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      timezone: 'Asia/Kolkata',
      language: 'en',
    },
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  logger.log(`Created tenant: ${tenant.name} (${tenant.slug})`);

  const demoUsers = [
    { firstName: 'Admin', lastName: 'User', email: 'admin@demo.com', password: 'Admin@123', role: 'ADMIN' },
    { firstName: 'Sales', lastName: 'Manager', email: 'manager@demo.com', password: 'Manager@123', role: 'SALES_MANAGER' },
    { firstName: 'John', lastName: 'Sales', email: 'john@demo.com', password: 'Sales@123', role: 'SALESPERSON' },
    { firstName: 'Read', lastName: 'Only', email: 'viewer@demo.com', password: 'Viewer@123', role: 'VIEWER' },
  ];

  for (const u of demoUsers) {
    await userModel.create({
      tenantId: tenant._id.toString(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: await bcrypt.hash(u.password, 12),
      role: u.role,
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    logger.log(`Created ${u.role}: ${u.email}`);
  }

  // Create sample agent
  const agentModel = app.get(getModelToken('Agent')) as Model<any>;
  const agent = await agentModel.create({
    tenantId: tenant._id.toString(),
    name: 'Lead Capture Bot',
    description: 'Default AI agent for lead qualification',
    systemPrompt: `You are a helpful AI assistant for a business. Your goal is to:
1. Greet visitors warmly
2. Understand their needs and requirements
3. Collect their contact information (name, email, phone)
4. Qualify them based on their budget, timeline, and decision-making authority
5. Answer questions about the company using the knowledge base
6. Hand off to a human agent when needed

Be professional, friendly, and concise. Ask one question at a time.`,
    welcomeMessage: 'Hi there! Welcome. How can I help you today?',
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1024,
    },
    widgetConfig: {
      primaryColor: '#4F46E5',
      headerText: 'Chat with us',
      placeholder: 'Type your message...',
      position: 'bottom-right',
    },
    leadCaptureFields: [
      { field: 'firstName', label: 'First Name', type: 'text', required: true, order: 1 },
      { field: 'email', label: 'Email', type: 'email', required: true, order: 2 },
      { field: 'phone', label: 'Phone', type: 'phone', required: false, order: 3 },
      { field: 'company', label: 'Company', type: 'text', required: false, order: 4 },
    ],
    enabledTools: [
      'lead_capture',
      'appointment_booking',
      'ticket_creation',
      'lead_status_update',
      'notify_salesperson',
      'handoff_to_human',
      'knowledge_search',
    ],
    handoffConfig: {
      enabled: true,
      triggerKeywords: ['speak to human', 'talk to agent', 'real person'],
      notifyChannels: ['in_app'],
    },
    status: 'active',
  });

  logger.log(`Created agent: ${agent.name}`);

  // Create sample scoring rules
  const scoringModel = app.get(getModelToken('ScoringRule')) as Model<any>;
  const rules = [
    { name: 'Has Email', condition: 'has_email', points: 10, order: 1 },
    { name: 'Has Phone', condition: 'has_phone', points: 15, order: 2 },
    { name: 'Multiple Conversations', condition: 'conversation_count', conditionConfig: { min: 2 }, points: 20, order: 3 },
    { name: 'Active Engagement', condition: 'message_count', conditionConfig: { min: 10 }, points: 25, order: 4 },
  ];

  for (const rule of rules) {
    await scoringModel.create({
      tenantId: tenant._id.toString(),
      ...rule,
      isActive: true,
    });
  }

  logger.log(`Created ${rules.length} scoring rules`);
  logger.log('Demo seeding complete!');
  logger.log('');
  logger.log('Demo credentials:');
  logger.log('  Tenant slug: demo');
  logger.log('  Admin: admin@demo.com / Admin@123');
  logger.log('  Manager: manager@demo.com / Manager@123');
  logger.log('  Sales: john@demo.com / Sales@123');
  logger.log('  Viewer: viewer@demo.com / Viewer@123');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
