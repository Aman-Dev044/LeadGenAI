import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';
import { CacheService } from '../../providers/redis/cache.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../../gateways/notification.gateway';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { KNOWN_FEATURE_FLAGS, PLANS } from '../platform/plan-limits.constants';
import {
  AdminResetPasswordDto,
  BroadcastDto,
  CreateSuperAdminDto,
  CreateTenantAdminDto,
  DeleteTenantDto,
  ListAuditQueryDto,
  ListTenantsQueryDto,
  ListUsersQueryDto,
  UpdatePlatformSettingsDto,
  UpdateTenantAdminDto,
  UpdateUserAdminDto,
} from './dto';

export interface ActorContext {
  userId: string;
  email: string;
  tenantId: string;
  ip?: string;
  userAgent?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every tenant-scoped collection removed when a tenant is purged. AuditLog is deliberately
 * NOT in the list so the owner keeps a trail of what happened to the tenant.
 */
const TENANT_COLLECTIONS = [
  'User', 'RefreshToken', 'Agent', 'KnowledgeSource', 'KnowledgeChunk', 'Conversation', 'Message', 'Lead',
  'LeadField', 'LeadActivity', 'ScoringRule', 'Notification', 'Webhook', 'WebhookLog', 'ApiKey', 'Handoff',
  'PageView', 'SupportTicket', 'Appointment', 'FollowUpWorkflow', 'FollowUpLog', 'Subscription',
  'Invoice', 'UsageRecord',
] as const;

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);
  private readonly bootTime = Date.now();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('RefreshToken') private readonly refreshTokenModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('Agent') private readonly agentModel: Model<any>,
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    @InjectModel('SupportTicket') private readonly ticketModel: Model<any>,
    @InjectModel('KnowledgeSource') private readonly kbSourceModel: Model<any>,
    @InjectModel('AuditLog') private readonly auditLogModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationGateway,
    private readonly platformSettings: PlatformSettingsService,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {}

  // =========================================================================
  // Overview / activity / search
  // =========================================================================

  async getOverview() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const d7 = new Date(now.getTime() - 7 * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const live = { deletedAt: null };

    const [
      tenantsTotal, tenantsByStatus, tenantsByPlan, tenantsByPlanAndStatusRaw, tenants30, tenants7,
      usersTotal, usersActive,
      leadsTotal, leads30, leadsByTemp, leadsByStatus,
      convTotal, conv30, convActive, convHandedOff,
      msgTotal, msgMonth, tokenAgg,
      agentsActive, appointments, ticketsOpen, kbSources,
      dailyLeads, dailyConversations, dailySignups,
      topTenantsRaw, recentTenants,
    ] = await Promise.all([
      this.tenantModel.countDocuments(live),
      this.groupCount(this.tenantModel, live, '$status'),
      this.groupCount(this.tenantModel, live, '$plan'),
      this.tenantModel.aggregate([
        { $match: live },
        { $group: { _id: { plan: '$plan', status: '$status' }, count: { $sum: 1 } } },
      ]),
      this.tenantModel.countDocuments({ ...live, createdAt: { $gte: d30 } }),
      this.tenantModel.countDocuments({ ...live, createdAt: { $gte: d7 } }),
      this.userModel.countDocuments(live),
      this.userModel.countDocuments({ ...live, isActive: true }),
      this.leadModel.countDocuments(live),
      this.leadModel.countDocuments({ ...live, createdAt: { $gte: d30 } }),
      this.groupCount(this.leadModel, live, '$temperature'),
      this.groupCount(this.leadModel, live, '$status'),
      this.conversationModel.countDocuments({}),
      this.conversationModel.countDocuments({ createdAt: { $gte: d30 } }),
      this.conversationModel.countDocuments({ status: 'active' }),
      this.conversationModel.countDocuments({ status: 'handed_off' }),
      this.messageModel.estimatedDocumentCount(),
      this.messageModel.countDocuments({ createdAt: { $gte: monthStart } }),
      this.messageModel.aggregate([
        { $match: { 'tokenUsage.totalTokens': { $gt: 0 } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$tokenUsage.totalTokens' },
            month: { $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, '$tokenUsage.totalTokens', 0] } },
          },
        },
      ]),
      this.agentModel.countDocuments({ ...live, status: 'active' }),
      this.appointmentModel.countDocuments({ status: { $in: ['scheduled', 'confirmed'] } }),
      this.ticketModel.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting'] } }),
      this.kbSourceModel.countDocuments({}),
      this.dailySeries(this.leadModel, d30, live),
      this.dailySeries(this.conversationModel, d30),
      this.dailySeries(this.tenantModel, d30, live),
      this.leadModel.aggregate([
        { $match: { deletedAt: null, createdAt: { $gte: d30 } } },
        { $group: { _id: '$tenantId', leads: { $sum: 1 } } },
        { $sort: { leads: -1 } },
        { $limit: 8 },
      ]),
      this.tenantModel.find(live).sort({ createdAt: -1 }).limit(6).select('name slug plan status createdAt').lean(),
    ]);

    const byPlanAndStatus: Record<string, Record<string, number>> = {};
    (tenantsByPlanAndStatusRaw || []).forEach((r: any) => {
      const plan = r._id?.plan || 'unknown';
      const status = r._id?.status || 'unknown';
      if (!byPlanAndStatus[plan]) byPlanAndStatus[plan] = {};
      byPlanAndStatus[plan][status] = r.count;
    });

    const topTenants = await this.attachTenantNames(topTenantsRaw, '_id');
    const tokens = tokenAgg[0] || { total: 0, month: 0 };

    return {
      generatedAt: now,
      tenants: { total: tenantsTotal, byStatus: tenantsByStatus, byPlan: tenantsByPlan, byPlanAndStatus, last30d: tenants30, last7d: tenants7 },
      users: { total: usersTotal, active: usersActive },
      leads: { total: leadsTotal, last30d: leads30, byTemperature: leadsByTemp, byStatus: leadsByStatus },
      conversations: { total: convTotal, last30d: conv30, active: convActive, handedOff: convHandedOff },
      messages: { total: msgTotal, thisMonth: msgMonth },
      ai: { tokensTotal: tokens.total, tokensThisMonth: tokens.month },
      agentsActive,
      appointmentsUpcoming: appointments,
      ticketsOpen,
      knowledgeSources: kbSources,
      series: { leads: dailyLeads, conversations: dailyConversations, signups: dailySignups },
      topTenants: topTenants.map((t: any) => ({ tenantId: t._id, name: t.tenantName, slug: t.tenantSlug, leads: t.leads })),
      recentTenants,
      platform: {
        maintenanceMode: this.platformSettings.isMaintenance(),
        signupEnabled: this.platformSettings.isSignupEnabled(),
        announcement: this.platformSettings.activeAnnouncement(),
      },
    };
  }

  async getActivityFeed(limit = 40) {
    const [tenants, users, leads, conversations, audits] = await Promise.all([
      this.tenantModel.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(10).select('name slug plan createdAt').lean(),
      this.userModel.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(10).select('firstName lastName email role tenantId createdAt').lean(),
      this.leadModel.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(15).select('firstName lastName email temperature source tenantId createdAt').lean(),
      this.conversationModel.find({}).sort({ createdAt: -1 }).limit(15).select('status mode messageCount tenantId createdAt').lean(),
      this.auditLogModel.find({ action: { $in: ['IMPERSONATE', 'TENANT_SUSPENDED', 'TENANT_ACTIVATED', 'TENANT_DELETED', 'BROADCAST', 'TENANT_CREATED'] } })
        .sort({ createdAt: -1 }).limit(10).select('action details tenantId userId createdAt').lean(),
    ]);

    const tenantIds = new Set<string>();
    [...users, ...leads, ...conversations, ...audits].forEach((d: any) => d.tenantId && tenantIds.add(String(d.tenantId)));
    const names = await this.tenantNameMap([...tenantIds]);

    const items: any[] = [];
    tenants.forEach((t: any) => items.push({ type: 'tenant_signup', title: `New workspace "${t.name}" (${t.plan})`, tenantName: t.name, tenantId: String(t._id), createdAt: t.createdAt }));
    users.forEach((u: any) => items.push({ type: 'user_created', title: `${u.firstName} ${u.lastName} joined as ${u.role}`, subtitle: u.email, tenantName: names[u.tenantId]?.name, tenantId: u.tenantId, createdAt: u.createdAt }));
    leads.forEach((l: any) => items.push({ type: 'lead', title: `${l.temperature || 'cold'} lead ${[l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'captured'}`, subtitle: l.source, tenantName: names[l.tenantId]?.name, tenantId: l.tenantId, createdAt: l.createdAt }));
    conversations.forEach((c: any) => items.push({ type: 'conversation', title: `Conversation started (${c.mode}, ${c.messageCount || 0} msgs)`, tenantName: names[c.tenantId]?.name, tenantId: c.tenantId, createdAt: c.createdAt }));
    audits.forEach((a: any) => items.push({ type: 'owner_action', title: a.action.replace(/_/g, ' ').toLowerCase(), subtitle: a.details?.summary, tenantName: names[a.tenantId]?.name, tenantId: a.tenantId, createdAt: a.createdAt }));

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }

  async search(q: string) {
    const rx = { $regex: escapeRegex(q.trim()), $options: 'i' };
    const [tenants, users, leads] = await Promise.all([
      this.tenantModel.find({ deletedAt: null, $or: [{ name: rx }, { slug: rx }, { domain: rx }] }).limit(10).select('name slug plan status createdAt').lean(),
      this.userModel.find({ deletedAt: null, $or: [{ email: rx }, { firstName: rx }, { lastName: rx }] }).limit(10).select('firstName lastName email role isActive tenantId').lean(),
      this.leadModel.find({ deletedAt: null, $or: [{ email: rx }, { firstName: rx }, { lastName: rx }, { phone: rx }, { company: rx }] }).limit(10).select('firstName lastName email phone company temperature status tenantId').lean(),
    ]);
    const names = await this.tenantNameMap([...users, ...leads].map((d: any) => String(d.tenantId)));
    return {
      tenants,
      users: users.map((u: any) => ({ ...u, tenantName: names[u.tenantId]?.name, tenantSlug: names[u.tenantId]?.slug })),
      leads: leads.map((l: any) => ({ ...l, tenantName: names[l.tenantId]?.name, tenantSlug: names[l.tenantId]?.slug })),
    };
  }

  // =========================================================================
  // Tenants
  // =========================================================================

  async listTenants(query: ListTenantsQueryDto) {
    const filter: any = query.includeDeleted ? {} : { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.plan) filter.plan = query.plan;
    if (query.search) {
      const rx = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ name: rx }, { slug: rx }, { domain: rx }];
    }

    const result = await paginate(this.tenantModel, filter, query);
    const ids = result.data.map((t: any) => String(t._id));
    const [users, leads, conversations, agents, lastActivity] = await Promise.all([
      this.countBy(this.userModel, ids, { deletedAt: null }),
      this.countBy(this.leadModel, ids, { deletedAt: null }),
      this.countBy(this.conversationModel, ids),
      this.countBy(this.agentModel, ids, { deletedAt: null }),
      this.conversationModel.aggregate([
        { $match: { tenantId: { $in: ids } } },
        { $group: { _id: '$tenantId', last: { $max: '$createdAt' } } },
      ]),
    ]);
    const lastMap = Object.fromEntries(lastActivity.map((r: any) => [r._id, r.last]));

    return {
      ...result,
      data: result.data.map((t: any) => ({
        ...t,
        stats: {
          users: users[t._id] || 0,
          leads: leads[t._id] || 0,
          conversations: conversations[t._id] || 0,
          agents: agents[t._id] || 0,
          lastConversationAt: lastMap[String(t._id)] || null,
        },
      })),
    };
  }

  async createTenant(dto: CreateTenantAdminDto, actor: ActorContext) {
    const slug = (dto.slug || this.slugify(dto.name)).toLowerCase();
    if (!slug) throw new BadRequestException('Could not derive a slug from the name');
    if (this.platformSettings.isSlugReserved(slug)) throw new ConflictException(`Slug "${slug}" is reserved`);
    if (await this.tenantModel.exists({ slug })) throw new ConflictException(`Slug "${slug}" is already taken`);
    if (await this.tenantModel.exists({ name: dto.name })) throw new ConflictException('A tenant with this name already exists');

    const plan = dto.plan || this.platformSettings.defaultPlan();
    const status = dto.status || (plan === 'free' ? 'trial' : 'active');
    const trialDays = dto.trialDays ?? this.platformSettings.trialDays();

    const tenant = await this.tenantModel.create({
      name: dto.name,
      slug,
      domain: dto.domain,
      plan,
      status,
      limits: this.platformSettings.limitsForPlan(plan),
      internalNotes: dto.internalNotes || '',
      trialEndsAt: status === 'trial' ? new Date(Date.now() + trialDays * DAY_MS) : undefined,
      createdBy: actor.userId,
    });

    const hashed = await bcrypt.hash(dto.admin.password, 12);
    const admin = await this.userModel.create({
      tenantId: String(tenant._id),
      firstName: dto.admin.firstName,
      lastName: dto.admin.lastName,
      email: dto.admin.email.toLowerCase().trim(),
      password: hashed,
      role: 'ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    });

    await this.audit(actor, 'TENANT_CREATED', 'Tenant', String(tenant._id), { summary: `Created tenant ${tenant.name} (${slug})`, adminEmail: admin.email, plan }, String(tenant._id));

    return { tenant, admin: this.stripUser(admin) };
  }

  async getTenant(id: string) {
    const tenant = await this.findTenantOrFail(id);
    const tid = String(tenant._id);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      users, agents, counts, monthConversations, monthLeads, monthMessages, tokenAgg,
      recentLeads, recentConversations, recentAudit,
    ] = await Promise.all([
      this.userModel.find({ tenantId: tid, deletedAt: null }).select('-password').sort({ createdAt: 1 }).lean(),
      this.agentModel.find({ tenantId: tid, deletedAt: null }).select('name status aiConfig createdAt').lean(),
      this.tenantCounts(tid),
      this.conversationModel.countDocuments({ tenantId: tid, createdAt: { $gte: monthStart } }),
      this.leadModel.countDocuments({ tenantId: tid, deletedAt: null, createdAt: { $gte: monthStart } }),
      this.messageModel.countDocuments({ tenantId: tid, createdAt: { $gte: monthStart } }),
      this.messageModel.aggregate([
        { $match: { tenantId: tid, 'tokenUsage.totalTokens': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$tokenUsage.totalTokens' }, month: { $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, '$tokenUsage.totalTokens', 0] } } } },
      ]),
      this.leadModel.find({ tenantId: tid, deletedAt: null }).sort({ createdAt: -1 }).limit(8).select('firstName lastName email temperature status score source createdAt').lean(),
      this.conversationModel.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(8).select('status mode messageCount createdAt').lean(),
      this.auditLogModel.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(10).select('action userId status ip createdAt details').lean(),
    ]);

    const tokens = tokenAgg[0] || { total: 0, month: 0 };
    const limits = tenant.limits || {};

    return {
      tenant,
      effectiveFeatureFlags: this.platformSettings.effectiveFlags(tenant.featureFlags),
      knownFeatureFlags: KNOWN_FEATURE_FLAGS,
      counts,
      usage: {
        period: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        conversations: monthConversations,
        leads: monthLeads,
        messages: monthMessages,
        aiTokensThisMonth: tokens.month,
        aiTokensTotal: tokens.total,
        limits,
        percent: {
          conversations: this.pct(monthConversations, limits.maxConversationsPerMonth),
          leads: this.pct(counts.leads, limits.maxLeads),
          users: this.pct(counts.users, limits.maxUsers),
          agents: this.pct(counts.agents, limits.maxAgents),
          knowledgeSources: this.pct(counts.knowledgeSources, limits.maxKnowledgeSources),
        },
      },
      users,
      agents,
      recentLeads,
      recentConversations,
      recentAudit,
    };
  }

  async updateTenant(id: string, dto: UpdateTenantAdminDto, actor: ActorContext) {
    const tenant = await this.findTenantOrFail(id);
    const $set: Record<string, any> = {};
    const $unset: Record<string, any> = {};

    if (dto.slug && dto.slug !== tenant.slug) {
      if (this.platformSettings.isSlugReserved(dto.slug)) throw new ConflictException(`Slug "${dto.slug}" is reserved`);
      if (await this.tenantModel.exists({ slug: dto.slug, _id: { $ne: tenant._id } })) throw new ConflictException('Slug already taken');
      $set.slug = dto.slug;
    }
    if (dto.name && dto.name !== tenant.name) {
      if (await this.tenantModel.exists({ name: dto.name, _id: { $ne: tenant._id } })) throw new ConflictException('Name already taken');
      $set.name = dto.name;
    }
    if (dto.domain !== undefined) $set.domain = dto.domain;
    if (dto.allowedOrigins) $set.allowedOrigins = dto.allowedOrigins;
    if (dto.internalNotes !== undefined) $set.internalNotes = dto.internalNotes;
    if (dto.trialEndsAt) $set.trialEndsAt = new Date(dto.trialEndsAt);
    if (dto.settings) for (const [k, v] of Object.entries(dto.settings)) $set[`settings.${k}`] = v;
    // The console always sends the full override map, so replace (a removed key = inherit again)
    if (dto.featureFlags) $set.featureFlags = dto.featureFlags;

    if (dto.plan && dto.plan !== tenant.plan) {
      if (!PLANS.includes(dto.plan as any)) throw new BadRequestException('Unknown plan');
      $set.plan = dto.plan;
      if (dto.applyPlanLimits !== false && !dto.limits) $set.limits = this.platformSettings.limitsForPlan(dto.plan);
    }
    if (dto.limits) $set.limits = { ...(tenant.limits || {}), ...dto.limits };

    if (dto.status && dto.status !== tenant.status) {
      if (tenant.isPlatformOwner && dto.status !== 'active') throw new ForbiddenException('The owner workspace must stay active');
      $set.status = dto.status;
      if (dto.status === 'suspended') {
        $set.suspendedAt = new Date();
      } else {
        $unset.suspendedAt = 1;
        $unset.suspendedReason = 1;
      }
    }

    const update: any = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;
    const updated = await this.tenantModel.findByIdAndUpdate(tenant._id, update, { new: true });

    if ($set.status === 'suspended' || $set.status === 'cancelled') await this.revokeTenantSessions(String(tenant._id));
    await this.cache.invalidatePattern('agent:public:*').catch(() => undefined);
    await this.audit(actor, 'TENANT_UPDATED', 'Tenant', String(tenant._id), { summary: `Updated tenant ${tenant.name}`, changes: Object.keys($set) }, String(tenant._id));
    return updated;
  }

  async suspendTenant(id: string, reason: string | undefined, actor: ActorContext) {
    const tenant = await this.findTenantOrFail(id);
    if (tenant.isPlatformOwner) throw new ForbiddenException('The owner workspace cannot be suspended');
    const updated = await this.tenantModel.findByIdAndUpdate(
      tenant._id,
      { $set: { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason || '' } },
      { new: true },
    );
    await this.revokeTenantSessions(String(tenant._id));
    await this.audit(actor, 'TENANT_SUSPENDED', 'Tenant', String(tenant._id), { summary: `Suspended ${tenant.name}${reason ? `: ${reason}` : ''}`, reason }, String(tenant._id));
    return updated;
  }

  async activateTenant(id: string, actor: ActorContext) {
    const tenant = await this.findTenantOrFail(id);
    const updated = await this.tenantModel.findByIdAndUpdate(
      tenant._id,
      { $set: { status: 'active' }, $unset: { suspendedAt: 1, suspendedReason: 1, deletedAt: 1 } },
      { new: true },
    );
    await this.audit(actor, 'TENANT_ACTIVATED', 'Tenant', String(tenant._id), { summary: `Activated ${tenant.name}` }, String(tenant._id));
    return updated;
  }

  async deleteTenant(id: string, dto: DeleteTenantDto, actor: ActorContext) {
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.isPlatformOwner) throw new ForbiddenException('The owner workspace cannot be deleted');
    if (dto.confirmSlug !== tenant.slug) throw new BadRequestException('confirmSlug does not match the tenant slug');

    const tid = String(tenant._id);
    await this.revokeTenantSessions(tid);

    if (dto.purge) {
      const removed: Record<string, number> = {};
      for (const name of TENANT_COLLECTIONS) {
        try {
          const model = this.connection.models[name];
          if (!model) continue;
          const res = await model.deleteMany({ tenantId: tid });
          removed[name] = res.deletedCount || 0;
        } catch (err) {
          this.logger.warn(`Purge ${name} for ${tid} failed: ${err.message}`);
        }
      }
      await this.tenantModel.deleteOne({ _id: tenant._id });
      await this.audit(actor, 'TENANT_DELETED', 'Tenant', tid, { summary: `Purged ${tenant.name} (${tenant.slug})`, purge: true, removed });
      return { deleted: true, purged: true, removed };
    }

    await this.tenantModel.updateOne({ _id: tenant._id }, { $set: { deletedAt: new Date(), status: 'cancelled' } });
    await this.userModel.updateMany({ tenantId: tid }, { $set: { isActive: false } });
    await this.agentModel.updateMany({ tenantId: tid }, { $set: { status: 'inactive' } });
    await this.cache.invalidatePattern('agent:public:*').catch(() => undefined);
    await this.audit(actor, 'TENANT_DELETED', 'Tenant', tid, { summary: `Soft-deleted ${tenant.name} (${tenant.slug})`, purge: false }, tid);
    return { deleted: true, purged: false };
  }

  async impersonate(tenantId: string, userId: string | undefined, actor: ActorContext) {
    const tenant = await this.findTenantOrFail(tenantId);
    const tid = String(tenant._id);

    let target: any = null;
    if (userId) {
      target = await this.userModel.findOne({ _id: userId, tenantId: tid, deletedAt: null });
    } else {
      target =
        (await this.userModel.findOne({ tenantId: tid, isActive: true, deletedAt: null, role: 'ADMIN' }).sort({ createdAt: 1 })) ||
        (await this.userModel.findOne({ tenantId: tid, isActive: true, deletedAt: null, role: { $ne: 'SUPER_ADMIN' } }).sort({ createdAt: 1 }));
    }
    if (!target) throw new NotFoundException('No user available to impersonate in this tenant');
    if (target.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot impersonate another platform owner');

    const session = await this.authService.issueTokensForUser(target, tid, {
      impersonatedBy: actor.userId,
      userAgent: actor.userAgent,
      ip: actor.ip,
    });

    await this.audit(actor, 'IMPERSONATE', 'User', String(target._id), {
      summary: `${actor.email} impersonated ${target.email} in ${tenant.name}`,
      targetEmail: target.email,
      targetRole: target.role,
    }, tid);

    return session;
  }

  // =========================================================================
  // Users
  // =========================================================================

  async listUsers(query: ListUsersQueryDto) {
    const filter: any = { deletedAt: null };
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.role) filter.role = query.role;
    if (query.isActive) filter.isActive = query.isActive === 'true';
    if (query.search) {
      const rx = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
    }
    const result = await paginate(this.userModel, filter, query);
    const names = await this.tenantNameMap(result.data.map((u: any) => String(u.tenantId)));
    return {
      ...result,
      data: result.data.map((u: any) => ({ ...u, tenantName: names[u.tenantId]?.name, tenantSlug: names[u.tenantId]?.slug, tenantStatus: names[u.tenantId]?.status })),
    };
  }

  async updateUser(id: string, dto: UpdateUserAdminDto, actor: ActorContext) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('User not found');
    const isSelf = String(user._id) === actor.userId;

    if (dto.role && dto.role !== user.role) {
      if (dto.role === 'SUPER_ADMIN') {
        const owner = await this.tenantModel.findOne({ isPlatformOwner: true }).select('_id');
        if (!owner || String(owner._id) !== String(user.tenantId)) {
          throw new ForbiddenException('Only users of the owner workspace can become platform owners');
        }
      }
      if (user.role === 'SUPER_ADMIN') await this.assertNotLastSuperAdmin(String(user._id));
    }
    if (dto.isActive === false) {
      if (isSelf) throw new ForbiddenException('You cannot deactivate yourself');
      if (user.role === 'SUPER_ADMIN') await this.assertNotLastSuperAdmin(String(user._id));
    }

    const $set: Record<string, any> = {};
    for (const k of ['firstName', 'lastName', 'role', 'isActive', 'phone'] as const) {
      if (dto[k] !== undefined) $set[k] = dto[k];
    }
    const updated = await this.userModel.findByIdAndUpdate(user._id, { $set }, { new: true }).select('-password');
    if (dto.isActive === false || (dto.role && dto.role !== user.role)) {
      await this.refreshTokenModel.updateMany({ userId: String(user._id), isRevoked: false }, { $set: { isRevoked: true, revokedAt: new Date() } });
    }
    await this.audit(actor, 'USER_UPDATED', 'User', String(user._id), { summary: `Updated ${user.email}`, changes: Object.keys($set) }, String(user.tenantId));
    return updated;
  }

  async resetUserPassword(id: string, dto: AdminResetPasswordDto, actor: ActorContext) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null }).select('+password');
    if (!user) throw new NotFoundException('User not found');
    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await this.refreshTokenModel.updateMany({ userId: String(user._id), isRevoked: false }, { $set: { isRevoked: true, revokedAt: new Date() } });
    await this.audit(actor, 'USER_PASSWORD_RESET', 'User', String(user._id), { summary: `Reset password for ${user.email}` }, String(user.tenantId));
    return { message: 'Password updated and all sessions revoked' };
  }

  async forceLogout(id: string, actor: ActorContext) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null }).select('email tenantId');
    if (!user) throw new NotFoundException('User not found');
    const res = await this.refreshTokenModel.updateMany({ userId: String(user._id), isRevoked: false }, { $set: { isRevoked: true, revokedAt: new Date() } });
    await this.audit(actor, 'USER_FORCE_LOGOUT', 'User', String(user._id), { summary: `Force-logged-out ${user.email}`, sessions: res.modifiedCount }, String(user.tenantId));
    return { revokedSessions: res.modifiedCount };
  }

  async listSuperAdmins() {
    return this.userModel.find({ role: 'SUPER_ADMIN', deletedAt: null }).select('-password').sort({ createdAt: 1 }).lean();
  }

  async createSuperAdmin(dto: CreateSuperAdminDto, actor: ActorContext) {
    const owner = await this.tenantModel.findOne({ isPlatformOwner: true });
    if (!owner) throw new BadRequestException('Owner workspace not found - run the seed first');
    const email = dto.email.toLowerCase().trim();
    if (await this.userModel.exists({ tenantId: String(owner._id), email })) throw new ConflictException('A user with this email already exists in the owner workspace');
    const user = await this.userModel.create({
      tenantId: String(owner._id),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      password: await bcrypt.hash(dto.password, 12),
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    await this.audit(actor, 'SUPER_ADMIN_CREATED', 'User', String(user._id), { summary: `Added platform owner ${email}` }, String(owner._id));
    return this.stripUser(user);
  }

  // =========================================================================
  // Audit logs
  // =========================================================================

  async listAuditLogs(query: ListAuditQueryDto) {
    const filter: any = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.userId) filter.userId = query.userId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
    if (query.search) {
      const rx = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ action: rx }, { resource: rx }, { 'details.summary': rx }, { ip: rx }];
    }
    const result = await paginate(this.auditLogModel, filter, query);
    const tenantIds = result.data.map((a: any) => a.tenantId).filter(Boolean);
    const userIds = result.data.map((a: any) => a.userId).filter((id: any) => id && Types.ObjectId.isValid(id));
    const [names, users] = await Promise.all([
      this.tenantNameMap(tenantIds),
      this.userModel.find({ _id: { $in: userIds } }).select('email firstName lastName role').lean(),
    ]);
    const userMap = Object.fromEntries(users.map((u: any) => [String(u._id), u]));
    return {
      ...result,
      data: result.data.map((a: any) => ({
        ...a,
        tenantName: names[a.tenantId]?.name,
        user: userMap[a.userId] ? { email: userMap[a.userId].email, name: `${userMap[a.userId].firstName} ${userMap[a.userId].lastName}`, role: userMap[a.userId].role } : undefined,
      })),
    };
  }

  // =========================================================================
  // Usage
  // =========================================================================

  async getUsage(period?: string) {
    const now = new Date();
    const [y, m] = (period || now.toISOString().slice(0, 7)).split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const range = { $gte: start, $lt: end };

    const tenants = await this.tenantModel.find({ deletedAt: null }).select('name slug plan status limits createdAt').sort({ name: 1 }).lean();
    const ids = tenants.map((t: any) => String(t._id));

    const [conv, leadsMonth, leadsTotal, msgs, tokens, users, agents, kb] = await Promise.all([
      this.countBy(this.conversationModel, ids, { createdAt: range }),
      this.countBy(this.leadModel, ids, { deletedAt: null, createdAt: range }),
      this.countBy(this.leadModel, ids, { deletedAt: null }),
      this.countBy(this.messageModel, ids, { createdAt: range }),
      this.messageModel.aggregate([
        { $match: { tenantId: { $in: ids }, createdAt: range, 'tokenUsage.totalTokens': { $gt: 0 } } },
        { $group: { _id: '$tenantId', tokens: { $sum: '$tokenUsage.totalTokens' } } },
      ]).then((rows) => Object.fromEntries(rows.map((r: any) => [r._id, r.tokens]))),
      this.countBy(this.userModel, ids, { deletedAt: null }),
      this.countBy(this.agentModel, ids, { deletedAt: null }),
      this.countBy(this.kbSourceModel, ids),
    ]);

    const rows = tenants.map((t: any) => {
      const id = String(t._id);
      const limits = t.limits || {};
      const usage = {
        conversations: conv[id] || 0,
        leadsThisMonth: leadsMonth[id] || 0,
        leadsTotal: leadsTotal[id] || 0,
        messages: msgs[id] || 0,
        aiTokens: tokens[id] || 0,
        users: users[id] || 0,
        agents: agents[id] || 0,
        knowledgeSources: kb[id] || 0,
      };
      const percent = {
        conversations: this.pct(usage.conversations, limits.maxConversationsPerMonth),
        leads: this.pct(usage.leadsTotal, limits.maxLeads),
        users: this.pct(usage.users, limits.maxUsers),
        agents: this.pct(usage.agents, limits.maxAgents),
        knowledgeSources: this.pct(usage.knowledgeSources, limits.maxKnowledgeSources),
      };
      const maxPct = Math.max(...Object.values(percent));
      return { tenantId: id, name: t.name, slug: t.slug, plan: t.plan, status: t.status, limits, usage, percent, health: maxPct >= 100 ? 'over' : maxPct >= 80 ? 'warning' : 'ok' };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.conversations += r.usage.conversations;
        acc.leads += r.usage.leadsThisMonth;
        acc.messages += r.usage.messages;
        acc.aiTokens += r.usage.aiTokens;
        return acc;
      },
      { conversations: 0, leads: 0, messages: 0, aiTokens: 0 },
    );

    return { period: `${y}-${String(m).padStart(2, '0')}`, totals, tenants: rows.sort((a, b) => b.usage.conversations - a.usage.conversations) };
  }

  // =========================================================================
  // System
  // =========================================================================

  async getSystemInfo() {
    const db = this.connection.db;
    let dbStats: any = null;
    try {
      if (!db) throw new Error('No database connection');
      const s: any = await db.stats();
      dbStats = { db: s.db, collections: s.collections, objects: s.objects, dataSizeMB: +(s.dataSize / 1048576).toFixed(2), storageSizeMB: +(s.storageSize / 1048576).toFixed(2), indexes: s.indexes, indexSizeMB: +(s.indexSize / 1048576).toFixed(2) };
    } catch (err) {
      dbStats = { error: err.message };
    }

    const collections: Record<string, number> = {};
    await Promise.all(
      ['Tenant', 'User', 'Agent', 'Lead', 'Conversation', 'Message', 'KnowledgeSource', 'KnowledgeChunk', 'Appointment', 'SupportTicket', 'Notification', 'AuditLog', 'Webhook', 'WebhookLog', 'FollowUpLog', 'PageView'].map(async (name) => {
        const model = this.connection.models[name];
        if (!model) return;
        try { collections[name] = await model.estimatedDocumentCount(); } catch { collections[name] = -1; }
      }),
    );

    let redis = 'disabled';
    if (this.cache.isEnabled()) {
      try {
        await this.cache.set('health:ping', 'pong', 10);
        redis = (await this.cache.get('health:ping')) === 'pong' ? 'connected' : 'error';
      } catch { redis = 'error'; }
    }

    const cfg = (k: string) => this.configService.get<any>(k);
    const mem = process.memoryUsage();
    let version = '1.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      version = pkg.version || version;
    } catch { /* ignore */ }

    return {
      app: { name: cfg('app.name'), version, env: cfg('app.env'), node: process.version, platform: `${process.platform}/${process.arch}`, pid: process.pid, uptimeSec: Math.round(process.uptime()), startedAt: new Date(this.bootTime) },
      memory: { rssMB: +(mem.rss / 1048576).toFixed(1), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1), heapTotalMB: +(mem.heapTotal / 1048576).toFixed(1) },
      database: { state: ['disconnected', 'connected', 'connecting', 'disconnecting'][this.connection.readyState] || 'unknown', name: this.connection.name, stats: dbStats, collections },
      redis: { status: redis, enabled: this.cache.isEnabled() },
      integrations: {
        ai: { provider: cfg('ai.provider'), openaiConfigured: !!cfg('ai.openai.apiKey'), openaiModel: cfg('ai.openai.model'), anthropicConfigured: !!cfg('ai.anthropic.apiKey'), anthropicModel: cfg('ai.anthropic.model'), embeddingModel: cfg('ai.openai.embeddingModel') },
        email: { provider: cfg('email.provider'), configured: cfg('email.provider') === 'resend' ? !!cfg('email.resendApiKey') : !!cfg('email.smtp.host') && !!cfg('email.smtp.user'), from: cfg('email.from') },
        sms: { configured: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN, phone: process.env.TWILIO_PHONE_NUMBER ? 'set' : 'missing', whatsapp: process.env.TWILIO_WHATSAPP_NUMBER ? 'set' : 'missing' },
        storage: { provider: cfg('storage.provider'), bucket: cfg('storage.s3.bucket'), endpoint: cfg('storage.s3.endpoint') || 'aws', configured: !!cfg('storage.s3.accessKeyId') },
        teamChat: { slackFallback: !!process.env.SLACK_WEBHOOK_URL, teamsFallback: !!process.env.TEAMS_WEBHOOK_URL },
      },
      runtime: {
        followUpScheduler: process.env.FOLLOW_UP_SCHEDULER_ENABLED !== 'false',
        followUpPollMs: Number(process.env.FOLLOW_UP_POLL_INTERVAL_MS || 60000),
        swagger: cfg('swagger.enabled') !== false,
        corsOrigins: cfg('cors.origins'),
        rateLimit: { ttl: cfg('rateLimit.ttl'), max: cfg('rateLimit.max') },
        maintenanceMode: this.platformSettings.isMaintenance(),
      },
      sockets: { onlineUsers: this.gateway.getOnlineUsers().length },
    };
  }

  // =========================================================================
  // Platform settings + broadcast
  // =========================================================================

  getSettings() {
    return { ...this.platformSettings.get(), knownFeatureFlags: KNOWN_FEATURE_FLAGS, plans: PLANS };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto, actor: ActorContext) {
    const patch: Record<string, any> = {};
    const current = this.platformSettings.get();
    for (const k of ['platformName', 'supportEmail', 'maintenanceMode', 'maintenanceMessage', 'signupEnabled', 'defaultPlan', 'trialDays', 'reservedSlugs'] as const) {
      if (dto[k] !== undefined) patch[k] = dto[k];
    }
    if (dto.announcement) {
      const a: any = { ...(current.announcement || {}), ...dto.announcement };
      if (dto.announcement.startsAt) a.startsAt = new Date(dto.announcement.startsAt);
      if (dto.announcement.endsAt) a.endsAt = new Date(dto.announcement.endsAt);
      patch.announcement = a;
    }
    if (dto.featureFlags) patch.featureFlags = { ...(current.featureFlags || {}), ...dto.featureFlags };
    if (dto.planLimits) {
      const merged: Record<string, any> = { ...(current.planLimits || {}) };
      for (const [plan, limits] of Object.entries(dto.planLimits)) merged[plan] = { ...(merged[plan] || {}), ...limits };
      patch.planLimits = merged;
    }
    if (patch.reservedSlugs) patch.reservedSlugs = patch.reservedSlugs.map((s: string) => s.toLowerCase().trim()).filter(Boolean);

    const updated = await this.platformSettings.update(patch, actor.userId);
    if (patch.maintenanceMode !== undefined) {
      await this.audit(actor, patch.maintenanceMode ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', 'PlatformSettings', 'global', { summary: `Maintenance mode ${patch.maintenanceMode ? 'enabled' : 'disabled'}` });
    } else {
      await this.audit(actor, 'PLATFORM_SETTINGS_UPDATED', 'PlatformSettings', 'global', { summary: 'Platform settings updated', changes: Object.keys(patch) });
    }
    return { ...updated, knownFeatureFlags: KNOWN_FEATURE_FLAGS, plans: PLANS };
  }

  async broadcast(dto: BroadcastDto, actor: ActorContext) {
    const tenantFilter: any = { deletedAt: null, status: { $in: ['active', 'trial'] } };
    if (dto.tenantIds?.length) tenantFilter._id = { $in: dto.tenantIds.filter((id) => Types.ObjectId.isValid(id)) };
    if (dto.plans?.length) tenantFilter.plan = { $in: dto.plans };
    const tenants = await this.tenantModel.find(tenantFilter).select('_id').lean();
    const tenantIds = tenants.map((t: any) => String(t._id));

    const userFilter: any = { tenantId: { $in: tenantIds }, isActive: true, deletedAt: null };
    if (dto.roles?.length) userFilter.role = { $in: dto.roles };
    const users = await this.userModel.find(userFilter).select('_id tenantId email').lean();

    const now = new Date();
    const data = { level: dto.level || 'info', link: dto.link, broadcast: true, from: 'platform', sentBy: actor.email };
    const docs = users.map((u: any) => ({
      tenantId: u.tenantId,
      userId: String(u._id),
      title: dto.title,
      body: dto.body,
      type: 'system_alert',
      channel: 'in_app',
      status: 'sent',
      sentAt: now,
      data,
    }));

    let inserted = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const chunk = docs.slice(i, i + 500);
      const created = await this.notificationModel.insertMany(chunk, { ordered: false });
      inserted += created.length;
      for (const n of created) this.gateway.sendToUser(String(n.userId), 'notification:new', n);
    }

    let emails = 0;
    if (dto.sendEmail) {
      for (const u of users) {
        if (!u.email) continue;
        this.notificationService
          .create(u.tenantId, { title: dto.title, body: dto.body, type: 'system_alert', channel: 'email', userId: String(u._id), data } as any)
          .catch((err) => this.logger.warn(`Broadcast email to ${u.email} failed: ${err.message}`));
        emails++;
      }
    }

    await this.audit(actor, 'BROADCAST', 'Notification', undefined, {
      summary: `Broadcast "${dto.title}" to ${inserted} users in ${tenantIds.length} tenants`,
      title: dto.title,
      body: dto.body,
      level: dto.level || 'info',
      roles: dto.roles,
      plans: dto.plans,
      tenantCount: tenantIds.length,
      recipients: inserted,
      emails,
    });

    return { tenants: tenantIds.length, recipients: inserted, emails };
  }

  async listBroadcasts(limit = 20) {
    return this.auditLogModel.find({ action: 'BROADCAST' }).sort({ createdAt: -1 }).limit(limit).select('details userId createdAt').lean();
  }

  // =========================================================================
  // Export
  // =========================================================================

  async exportTenantsCsv(): Promise<string> {
    const list = await this.listTenants({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'asc' } as any);
    const all: any[] = [...list.data];
    for (let p = 2; p <= list.totalPages; p++) {
      const next = await this.listTenants({ page: p, limit: 100, sortBy: 'createdAt', sortOrder: 'asc' } as any);
      all.push(...next.data);
    }
    const header = ['id', 'name', 'slug', 'domain', 'plan', 'status', 'users', 'agents', 'leads', 'conversations', 'maxLeads', 'maxConversationsPerMonth', 'maxUsers', 'trialEndsAt', 'createdAt'];
    const esc = (v: any) => {
      const s = v === undefined || v === null ? '' : String(v instanceof Date ? v.toISOString() : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = all.map((t) =>
      [t._id, t.name, t.slug, t.domain, t.plan, t.status, t.stats.users, t.stats.agents, t.stats.leads, t.stats.conversations, t.limits?.maxLeads, t.limits?.maxConversationsPerMonth, t.limits?.maxUsers, t.trialEndsAt, t.createdAt].map(esc).join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  // =========================================================================
  // helpers
  // =========================================================================

  private async findTenantOrFail(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Tenant not found');
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async tenantCounts(tid: string) {
    const [users, agents, leads, conversations, messages, knowledgeSources, appointments, tickets] = await Promise.all([
      this.userModel.countDocuments({ tenantId: tid, deletedAt: null }),
      this.agentModel.countDocuments({ tenantId: tid, deletedAt: null }),
      this.leadModel.countDocuments({ tenantId: tid, deletedAt: null }),
      this.conversationModel.countDocuments({ tenantId: tid }),
      this.messageModel.countDocuments({ tenantId: tid }),
      this.kbSourceModel.countDocuments({ tenantId: tid }),
      this.appointmentModel.countDocuments({ tenantId: tid }),
      this.ticketModel.countDocuments({ tenantId: tid }),
    ]);
    return { users, agents, leads, conversations, messages, knowledgeSources, appointments, tickets };
  }

  private async revokeTenantSessions(tenantId: string) {
    await this.refreshTokenModel.updateMany({ tenantId, isRevoked: false }, { $set: { isRevoked: true, revokedAt: new Date() } });
  }

  private async assertNotLastSuperAdmin(userId: string) {
    const others = await this.userModel.countDocuments({ role: 'SUPER_ADMIN', isActive: true, deletedAt: null, _id: { $ne: userId } });
    if (others === 0) throw new ForbiddenException('At least one active platform owner must remain');
  }

  private async countBy(model: Model<any>, tenantIds: string[], extra: Record<string, any> = {}): Promise<Record<string, number>> {
    if (!tenantIds.length) return {};
    const rows = await model.aggregate([
      { $match: { tenantId: { $in: tenantIds }, ...extra } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r: any) => [r._id, r.count]));
  }

  private async groupCount(model: Model<any>, match: Record<string, any>, field: string): Promise<Record<string, number>> {
    const rows = await model.aggregate([{ $match: match }, { $group: { _id: field, count: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r: any) => [r._id ?? 'unknown', r.count]));
  }

  private async dailySeries(model: Model<any>, since: Date, extra: Record<string, any> = {}) {
    const rows = await model.aggregate([
      { $match: { createdAt: { $gte: since }, ...extra } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    // Fill missing days with zero so charts stay continuous
    const map = Object.fromEntries(rows.map((r: any) => [r._id, r.count]));
    const out: { _id: string; count: number }[] = [];
    for (let d = new Date(since); d <= new Date(); d = new Date(d.getTime() + DAY_MS)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ _id: key, count: map[key] || 0 });
    }
    return out;
  }

  private async tenantNameMap(ids: string[]): Promise<Record<string, { name: string; slug: string; status: string }>> {
    const valid = [...new Set(ids.filter((id) => id && Types.ObjectId.isValid(id)))];
    if (!valid.length) return {};
    const tenants = await this.tenantModel.find({ _id: { $in: valid } }).select('name slug status').lean();
    return Object.fromEntries(tenants.map((t: any) => [String(t._id), { name: t.name, slug: t.slug, status: t.status }]));
  }

  private async attachTenantNames(rows: any[], idField: string) {
    const names = await this.tenantNameMap(rows.map((r) => String(r[idField])));
    return rows.map((r) => ({ ...r, tenantName: names[String(r[idField])]?.name || 'Unknown', tenantSlug: names[String(r[idField])]?.slug }));
  }

  private pct(used: number, limit?: number) {
    if (!limit || limit <= 0) return 0;
    return Math.min(999, Math.round((used / limit) * 100));
  }

  private slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private stripUser(user: any) {
    const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete obj.password;
    return obj;
  }

  private async audit(actor: ActorContext, action: string, resource: string, resourceId: string | undefined, details: Record<string, any>, tenantId?: string) {
    try {
      await this.auditLogModel.create({
        tenantId: tenantId || actor.tenantId,
        userId: actor.userId,
        action,
        resource,
        resourceId,
        details: { ...details, actorEmail: actor.email, byOwner: true },
        ip: actor.ip,
        userAgent: actor.userAgent,
        status: 'success',
      });
    } catch (err) {
      this.logger.warn(`Audit write failed (${action}): ${err.message}`);
    }
  }
}
