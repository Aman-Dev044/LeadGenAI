import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);

  const tenantModel = app.get<Model<any>>(getModelToken('Tenant'));
  const userModel = app.get<Model<any>>(getModelToken('User'));

  // Check if seed data already exists
  const existingTenant = await tenantModel.findOne({ slug: 'demo' });
  if (existingTenant) {
    logger.log('Seed data already exists. Skipping.');
    await app.close();
    return;
  }

  logger.log('Seeding database...');

  // Create demo tenant
  const tenant = await tenantModel.create({
    name: 'Demo Organization',
    slug: 'demo',
    status: 'active',
    plan: 'professional',
    allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    limits: {
      maxAgents: 10,
      maxLeads: 10000,
      maxConversationsPerMonth: 5000,
      maxKnowledgeSources: 50,
      maxUsers: 20,
    },
    settings: {
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      timezone: 'Asia/Kolkata',
      language: 'en',
    },
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  logger.log(`Created tenant: ${tenant.name} (${tenant.slug})`);

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await userModel.create({
    tenantId: tenant._id.toString(),
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@demo.com',
    password: hashedPassword,
    role: 'ADMIN',
    isActive: true,
    emailVerifiedAt: new Date(),
  });

  logger.log(`Created admin user: ${admin.email}`);

  // Create sales manager
  const salesManagerPassword = await bcrypt.hash('Manager@123', 12);
  const salesManager = await userModel.create({
    tenantId: tenant._id.toString(),
    firstName: 'Sales',
    lastName: 'Manager',
    email: 'manager@demo.com',
    password: salesManagerPassword,
    role: 'SALES_MANAGER',
    isActive: true,
    emailVerifiedAt: new Date(),
  });

  logger.log(`Created sales manager: ${salesManager.email}`);

  // Create salesperson
  const salespersonPassword = await bcrypt.hash('Sales@123', 12);
  const salesperson = await userModel.create({
    tenantId: tenant._id.toString(),
    firstName: 'John',
    lastName: 'Sales',
    email: 'john@demo.com',
    password: salespersonPassword,
    role: 'SALESPERSON',
    isActive: true,
    emailVerifiedAt: new Date(),
  });

  logger.log(`Created salesperson: ${salesperson.email}`);

  // Create viewer
  const viewerPassword = await bcrypt.hash('Viewer@123', 12);
  const viewer = await userModel.create({
    tenantId: tenant._id.toString(),
    firstName: 'Read',
    lastName: 'Only',
    email: 'viewer@demo.com',
    password: viewerPassword,
    role: 'VIEWER',
    isActive: true,
    emailVerifiedAt: new Date(),
  });

  logger.log(`Created viewer: ${viewer.email}`);

  // Create sample agent
  const agentModel = app.get<Model<any>>(getModelToken('Agent'));
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
  const scoringModel = app.get<Model<any>>(getModelToken('ScoringRule'));
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

  logger.log('Seeding complete!');
  logger.log('');
  logger.log('Demo credentials:');
  logger.log('  Tenant slug: demo');
  logger.log('  Admin: admin@demo.com / Admin@123');
  logger.log('  Manager: manager@demo.com / Manager@123');
  logger.log('  Sales: john@demo.com / Sales@123');
  logger.log('  Viewer: viewer@demo.com / Viewer@123');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
