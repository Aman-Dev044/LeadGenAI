import * as dns from 'dns';
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
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

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
