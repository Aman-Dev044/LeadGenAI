import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSubscriptionDto, UpdatePlanDto } from './dto';
import { UsageMeterService } from './usage-meter.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';

const PLAN_CONFIG = {
  free: {
    price: 0,
    limits: { maxAgents: 1, maxLeads: 100, maxConversationsPerMonth: 500, maxKnowledgeSources: 5, maxUsers: 2 },
  },
  starter: {
    price: 1999,
    limits: { maxAgents: 3, maxLeads: 1000, maxConversationsPerMonth: 2000, maxKnowledgeSources: 20, maxUsers: 5 },
  },
  professional: {
    price: 4999,
    limits: { maxAgents: 10, maxLeads: 10000, maxConversationsPerMonth: 10000, maxKnowledgeSources: 50, maxUsers: 20 },
  },
  enterprise: {
    price: 14999,
    limits: { maxAgents: 50, maxLeads: 100000, maxConversationsPerMonth: 50000, maxKnowledgeSources: 200, maxUsers: 100 },
  },
};

@Injectable()
export class BillingService {
  constructor(
    @InjectModel('Subscription') private readonly subscriptionModel: Model<any>,
    @InjectModel('Invoice') private readonly invoiceModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly usageMeter: UsageMeterService,
  ) {}

  getPlans() {
    return Object.entries(PLAN_CONFIG).map(([key, value]) => ({
      name: key,
      priceMonthly: value.price,
      currency: 'INR',
      limits: value.limits,
    }));
  }

  async getCurrentSubscription(tenantId: string) {
    const subscription = await this.subscriptionModel.findOne({
      tenantId,
      status: { $in: ['active', 'trialing'] },
    });
    if (!subscription) {
      return { plan: 'free', status: 'active', limits: PLAN_CONFIG.free.limits };
    }
    return subscription;
  }

  async subscribe(tenantId: string, dto: CreateSubscriptionDto) {
    const planConfig = PLAN_CONFIG[dto.plan as keyof typeof PLAN_CONFIG];
    if (!planConfig) throw new BadRequestException('Invalid plan');

    // Check for existing active subscription
    const existing = await this.subscriptionModel.findOne({
      tenantId,
      status: { $in: ['active', 'trialing'] },
    });
    if (existing) {
      throw new BadRequestException('Active subscription already exists. Use upgrade/downgrade.');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await this.subscriptionModel.create({
      tenantId,
      plan: dto.plan,
      status: dto.plan === 'free' ? 'active' : 'active',
      priceMonthly: planConfig.price,
      currency: 'INR',
      paymentProvider: dto.paymentProvider,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    // Update tenant limits
    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { plan: dto.plan, limits: planConfig.limits } },
    );

    // Generate invoice for paid plans
    if (planConfig.price > 0) {
      await this.generateInvoice(tenantId, subscription);
    }

    return subscription;
  }

  async upgrade(tenantId: string, dto: UpdatePlanDto) {
    const current = await this.getCurrentSubscription(tenantId);
    const planOrder = ['free', 'starter', 'professional', 'enterprise'];
    const currentIndex = planOrder.indexOf(current.plan);
    const newIndex = planOrder.indexOf(dto.plan);

    if (newIndex <= currentIndex) {
      throw new BadRequestException('New plan must be higher than current plan');
    }

    return this.changePlan(tenantId, dto.plan);
  }

  async downgrade(tenantId: string, dto: UpdatePlanDto) {
    const current = await this.getCurrentSubscription(tenantId);
    const planOrder = ['free', 'starter', 'professional', 'enterprise'];
    const currentIndex = planOrder.indexOf(current.plan);
    const newIndex = planOrder.indexOf(dto.plan);

    if (newIndex >= currentIndex) {
      throw new BadRequestException('New plan must be lower than current plan');
    }

    return this.changePlan(tenantId, dto.plan);
  }

  async cancelSubscription(tenantId: string, reason?: string) {
    const subscription = await this.subscriptionModel.findOneAndUpdate(
      { tenantId, status: { $in: ['active', 'trialing'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      },
      { new: true },
    );

    if (!subscription) throw new NotFoundException('Active subscription not found');

    // Revert to free plan
    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { plan: 'free', limits: PLAN_CONFIG.free.limits } },
    );

    return subscription;
  }

  async getUsage(tenantId: string) {
    const usage = await this.usageMeter.getCurrentUsage(tenantId);
    const subscription = await this.getCurrentSubscription(tenantId);
    const planConfig = PLAN_CONFIG[subscription.plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;

    return {
      usage: usage?.usage,
      limits: planConfig.limits,
      plan: subscription.plan,
    };
  }

  async getInvoices(tenantId: string, paginationDto: PaginationDto) {
    return paginate(this.invoiceModel, { tenantId }, paginationDto);
  }

  async getInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await this.invoiceModel.findOne({ _id: invoiceId, tenantId });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async changePlan(tenantId: string, newPlan: string) {
    const planConfig = PLAN_CONFIG[newPlan as keyof typeof PLAN_CONFIG];
    if (!planConfig) throw new BadRequestException('Invalid plan');

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Cancel existing
    await this.subscriptionModel.updateMany(
      { tenantId, status: { $in: ['active', 'trialing'] } },
      { $set: { status: 'cancelled', cancelledAt: now } },
    );

    // Create new
    const subscription = await this.subscriptionModel.create({
      tenantId,
      plan: newPlan,
      status: 'active',
      priceMonthly: planConfig.price,
      currency: 'INR',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    // Update tenant
    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { plan: newPlan, limits: planConfig.limits } },
    );

    if (planConfig.price > 0) {
      await this.generateInvoice(tenantId, subscription);
    }

    return subscription;
  }

  private async generateInvoice(tenantId: string, subscription: any) {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return this.invoiceModel.create({
      tenantId,
      subscriptionId: subscription._id.toString(),
      invoiceNumber,
      amount: subscription.priceMonthly,
      currency: subscription.currency || 'INR',
      plan: subscription.plan,
      status: 'pending',
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      lineItems: [
        {
          description: `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan - Monthly`,
          quantity: 1,
          unitPrice: subscription.priceMonthly,
          total: subscription.priceMonthly,
        },
      ],
    });
  }
}
