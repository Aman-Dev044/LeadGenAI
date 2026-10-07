import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CURRENCY,
  CustomPlanChoice,
  PlanId,
  PlanQuota,
  Quote,
  TRIAL_DAYS,
  featuresFor,
  normalisePlanId,
  quotaFor,
  quoteCustomPlan,
  quotePlan,
  PLAN_CATALOGUE,
} from './plan-catalogue';

export interface SubscriptionState {
  plan: PlanId;
  planName: string;
  status: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
  /** True when the workspace is locked out until somebody pays. */
  requiresPayment: boolean;
  trial: boolean;
  expiresAt: Date | null;
  daysLeft: number;
  billingInterval: string;
  quota: PlanQuota;
  features: Record<string, boolean>;
}

/**
 * Who may use the product right now, and how much of it.
 *
 * Every workspace starts on a 14-day trial with everything unlocked. When the
 * trial (or a paid period) ends the workspace is not deleted - it goes
 * read-only: people can still sign in, but only to pay. SubscriptionGuard
 * enforces that, this service decides it.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('Subscription') private readonly subscriptionModel: Model<any>,
    @InjectModel('CallLog') private readonly callModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  private daysBetween(from: number, to: number): number {
    return Math.max(0, Math.ceil((to - from) / 86_400_000));
  }

  /** Reads the workspace's entitlement. Never throws - callers decide what to do. */
  async stateFor(tenantId: string): Promise<SubscriptionState | null> {
    if (!tenantId || tenantId === 'all') return null;
    const tenant: any = await this.tenantModel
      .findById(tenantId)
      .select('plan status trialEndsAt planExpiresAt billingInterval customPlan')
      .lean();
    if (!tenant) return null;
    return this.stateFromTenant(tenant);
  }

  stateFromTenant(tenant: any): SubscriptionState {
    const plan = normalisePlanId(tenant.plan);
    const onTrial = tenant.status === 'trial' || plan === 'trial';
    const expiresAt: Date | null = onTrial
      ? tenant.trialEndsAt
        ? new Date(tenant.trialEndsAt)
        : null
      : tenant.planExpiresAt
        ? new Date(tenant.planExpiresAt)
        : null;

    const now = Date.now();
    const lapsed = !!expiresAt && expiresAt.getTime() < now;
    let status: SubscriptionState['status'];
    if (tenant.status === 'suspended') status = 'suspended';
    else if (tenant.status === 'cancelled') status = 'cancelled';
    else if (tenant.status === 'expired' || lapsed) status = 'expired';
    else if (onTrial) status = 'trial';
    else status = 'active';

    return {
      plan,
      planName: plan === 'custom' ? 'Custom' : PLAN_CATALOGUE[plan as Exclude<PlanId, 'custom'>].name,
      status,
      requiresPayment: status === 'expired',
      trial: status === 'trial',
      expiresAt,
      daysLeft: expiresAt ? this.daysBetween(now, expiresAt.getTime()) : 0,
      billingInterval: tenant.billingInterval || 'monthly',
      quota: quotaFor(tenant.plan, tenant.customPlan?.quota),
      features: featuresFor(tenant.plan, tenant.customPlan?.features) as unknown as Record<string, boolean>,
    };
  }

  /** Marks a lapsed workspace as expired so the owner console and reports agree. */
  async markExpiredIfLapsed(tenantId: string): Promise<boolean> {
    const state = await this.stateFor(tenantId);
    if (!state || !state.requiresPayment) return false;
    const res = await this.tenantModel.updateOne(
      { _id: tenantId, status: { $in: ['trial', 'active'] } },
      { $set: { status: 'expired' } },
    );
    if (res.modifiedCount) this.logger.log(`Workspace ${tenantId} moved to expired - ${state.trial ? 'trial' : 'subscription'} ended`);
    return true;
  }

  /** One sweep: every workspace whose trial or paid period has run out. */
  async expireLapsedWorkspaces(): Promise<number> {
    const now = new Date();
    const trials = await this.tenantModel.updateMany(
      { status: 'trial', trialEndsAt: { $lt: now }, deletedAt: null },
      { $set: { status: 'expired' } },
    );
    const paid = await this.tenantModel.updateMany(
      { status: 'active', planExpiresAt: { $lt: now }, deletedAt: null },
      { $set: { status: 'expired' } },
    );
    const n = (trials.modifiedCount || 0) + (paid.modifiedCount || 0);
    if (n) this.logger.log(`${n} workspace(s) moved to expired`);
    return n;
  }

  // ─── Pricing ──────────────────────────────────────────────────────

  quote(planId: string, interval: 'monthly' | 'yearly', custom?: Partial<CustomPlanChoice>): Quote {
    const id = normalisePlanId(planId);
    if (id === 'custom') return quoteCustomPlan({ ...(custom || {}), billingInterval: interval });
    if (id === 'trial') throw new BadRequestException('The free trial cannot be purchased');
    return quotePlan(id, interval);
  }

  // ─── Activation ───────────────────────────────────────────────────

  /**
   * Turns a paid quote into an active subscription: the workspace gets the
   * quota, the features and a new expiry date, and is unlocked.
   */
  async activate(
    tenantId: string,
    planId: string,
    quote: Quote,
    payment: { provider?: string; reference?: string; paidAt?: Date } = {},
  ) {
    const id = normalisePlanId(planId);
    const start = new Date();
    const end = new Date(start.getTime());
    end.setMonth(end.getMonth() + (quote.billingInterval === 'yearly' ? 12 : 1));

    const customPlan =
      id === 'custom'
        ? { quota: quote.quota as unknown as Record<string, number>, features: quote.features as unknown as Record<string, boolean>, priceMonthly: Math.round(quote.subtotal / quote.months) }
        : undefined;

    await this.tenantModel.updateOne(
      { _id: tenantId },
      {
        $set: {
          plan: id,
          status: 'active',
          planExpiresAt: end,
          billingInterval: quote.billingInterval,
          ...(customPlan ? { customPlan } : { customPlan: undefined }),
          // Keep the old agent/lead counters in step with the new plan
          limits: {
            maxAgents: quote.quota.agents < 0 ? 1000 : quote.quota.agents,
            maxLeads: quote.quota.leads < 0 ? 10_000_000 : quote.quota.leads,
            maxConversationsPerMonth: quote.quota.whatsappMessages < 0 ? 1_000_000 : Math.max(500, quote.quota.whatsappMessages),
            maxKnowledgeSources: quote.quota.knowledgeSources,
            maxUsers: quote.quota.users < 0 ? 500 : quote.quota.users,
          },
          renewalReminder: undefined,
        },
      },
    );

    await this.subscriptionModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          plan: id,
          status: 'active',
          priceMonthly: Math.round(quote.subtotal / quote.months),
          billingInterval: quote.billingInterval,
          currency: CURRENCY,
          amountPaid: quote.total,
          gstAmount: quote.gst,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelledAt: undefined,
          cancelReason: undefined,
          ...(customPlan ? { customPlan } : {}),
          ...(payment.provider ? { paymentProvider: payment.provider } : {}),
          ...(payment.reference ? { externalSubscriptionId: payment.reference } : {}),
        },
      },
      { upsert: true, new: true },
    );

    this.logger.log(`Workspace ${tenantId} activated on ${id} until ${end.toISOString().slice(0, 10)}`);
    return this.stateFor(tenantId);
  }

  /** Puts a brand-new workspace on the trial. */
  async startTrial(tenantId: string, days = TRIAL_DAYS) {
    const ends = new Date(Date.now() + days * 86_400_000);
    await this.tenantModel.updateOne({ _id: tenantId }, { $set: { plan: 'trial', status: 'trial', trialEndsAt: ends } });
    return ends;
  }

  // ─── Usage against the quota ──────────────────────────────────────

  private monthStart(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  /** What the workspace has used this calendar month. */
  async usageFor(tenantId: string) {
    const since = this.monthStart();
    const [aiCalls, leads, users, whatsappMessages] = await Promise.all([
      this.callModel.countDocuments({
        tenantId,
        type: { $in: ['ai_outbound', 'ai_inbound', 'ai_reengage'] },
        externalId: { $exists: true, $ne: null },
        createdAt: { $gte: since },
      }),
      this.leadModel.countDocuments({ tenantId, deletedAt: null }),
      this.userModel.countDocuments({ tenantId, isActive: true }),
      this.notificationModel.countDocuments({ tenantId, channel: 'whatsapp', createdAt: { $gte: since } }),
    ]);
    return { aiCalls, leads, users, whatsappMessages, periodStart: since };
  }

  /** Quota + usage together - what the billing page and the limit checks read. */
  async entitlement(tenantId: string) {
    const [state, usage] = await Promise.all([this.stateFor(tenantId), this.usageFor(tenantId)]);
    if (!state) return null;
    const left = (quota: number, used: number) => (quota < 0 ? -1 : Math.max(0, quota - used));
    return {
      ...state,
      usage,
      remaining: {
        aiCalls: left(state.quota.aiCalls, usage.aiCalls),
        leads: left(state.quota.leads, usage.leads),
        users: left(state.quota.users, usage.users),
        whatsappMessages: left(state.quota.whatsappMessages, usage.whatsappMessages),
      },
    };
  }

  /**
   * May this workspace place another AI call? Returns a reason when it may not,
   * so the caller can log it against the call instead of failing silently.
   */
  async canPlaceAiCall(tenantId: string): Promise<{ ok: boolean; reason?: string; used?: number; quota?: number }> {
    const state = await this.stateFor(tenantId);
    if (!state) return { ok: true };
    if (state.requiresPayment) {
      return { ok: false, reason: state.trial ? 'The free trial has ended - choose a plan to keep calling.' : 'The subscription has ended - renew the plan to keep calling.' };
    }
    if (state.quota.aiCalls < 0) return { ok: true };
    const usage = await this.usageFor(tenantId);
    if (usage.aiCalls >= state.quota.aiCalls) {
      return {
        ok: false,
        reason: `This month's AI call limit is used up (${usage.aiCalls} of ${state.quota.aiCalls} on the ${state.planName} plan). Upgrade to keep calling.`,
        used: usage.aiCalls,
        quota: state.quota.aiCalls,
      };
    }
    return { ok: true, used: usage.aiCalls, quota: state.quota.aiCalls };
  }

  /** Whether a paid feature is switched on for this workspace. */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const state = await this.stateFor(tenantId);
    return !!state?.features?.[feature];
  }
}
