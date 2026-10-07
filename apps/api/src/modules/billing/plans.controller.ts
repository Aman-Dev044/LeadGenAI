import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import {
  CURRENCY,
  CustomPlanChoice,
  FEATURE_LABELS,
  GST_RATE,
  PLAN_CATALOGUE,
  TRIAL_DAYS,
  UNIT_PRICES,
  YEARLY_MONTHS,
  normalisePlanId,
  publicPlans,
} from './plan-catalogue';
import { CurrentTenant, CurrentUser, Public, Roles } from '../../common/decorators';

type Actor = { userId: string; role: string };

/**
 * Plans, prices and payment.
 *
 * Deliberately separate from the older BillingController: this is the customer
 * facing side - what a plan costs, what a custom plan would cost, and how to
 * pay for it. A workspace whose trial has run out can still reach every one of
 * these (see SubscriptionGuard), because paying is the one thing it must be
 * able to do.
 */
@Controller('billing')
export class PlansController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly razorpay: RazorpayService,
    @InjectModel('Invoice') private readonly invoiceModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
  ) {}

  /** The pricing page - also used by the public website. */
  @Get('catalogue')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  catalogue() {
    return {
      currency: CURRENCY,
      gstRate: GST_RATE,
      trialDays: TRIAL_DAYS,
      yearlyMonths: YEARLY_MONTHS,
      plans: publicPlans(),
      trial: PLAN_CATALOGUE.trial,
      unitPrices: UNIT_PRICES,
      featureLabels: FEATURE_LABELS,
    };
  }

  /** What this workspace is on today, with usage against the quota. */
  @Get('subscription')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async subscription(@CurrentTenant() tenantId: string) {
    const entitlement = await this.subscriptions.entitlement(tenantId);
    if (!entitlement) throw new BadRequestException('No workspace selected');
    return entitlement;
  }

  /** Price a plan - including one the customer built themselves. GST included. */
  @Post('quote')
  @HttpCode(200)
  @Roles('ADMIN')
  quote(
    @Body('planId') planId: string,
    @Body('billingInterval') interval: 'monthly' | 'yearly',
    @Body('custom') custom?: Partial<CustomPlanChoice>,
  ) {
    const id = normalisePlanId(planId);
    return { planId: id, ...this.subscriptions.quote(id, interval === 'yearly' ? 'yearly' : 'monthly', custom) };
  }

  /**
   * Start a payment. Returns a Razorpay order when the gateway is configured,
   * otherwise the invoice to settle by bank transfer / UPI.
   */
  @Post('checkout')
  @HttpCode(200)
  @Roles('ADMIN')
  async checkout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Actor,
    @Body('planId') planId: string,
    @Body('billingInterval') interval: 'monthly' | 'yearly',
    @Body('custom') custom?: Partial<CustomPlanChoice>,
  ) {
    const id = normalisePlanId(planId);
    const quote = this.subscriptions.quote(id, interval === 'yearly' ? 'yearly' : 'monthly', custom);
    const tenant: any = await this.tenantModel.findById(tenantId).select('name').lean();

    const invoice = await this.invoiceModel.create({
      tenantId,
      invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
      amount: quote.total,
      currency: CURRENCY,
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 86_400_000),
      lineItems: [
        ...quote.lines.map((l) => ({ description: `${l.label} - ${l.detail}`, quantity: 1, unitPrice: l.amount, total: l.amount })),
        { description: `GST @ ${Math.round(GST_RATE * 100)}%`, quantity: 1, unitPrice: quote.gst, total: quote.gst },
      ],
      metadata: { planId: id, billingInterval: quote.billingInterval, custom: custom || undefined, createdBy: user?.userId },
    });

    if (!this.razorpay.isConfigured()) {
      return {
        gateway: null,
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        quote,
        message: 'Online payment is not switched on yet. Pay by UPI or bank transfer and our team will activate the plan.',
      };
    }

    const order = await this.razorpay.createOrder(quote.total, invoice.invoiceNumber, {
      tenantId,
      tenantName: tenant?.name || '',
      planId: id,
      interval: quote.billingInterval,
    });
    await this.invoiceModel.updateOne({ _id: invoice._id }, { $set: { 'metadata.orderId': order.id } });

    return {
      gateway: 'razorpay',
      keyId: order.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      quote,
      workspace: tenant?.name || '',
    };
  }

  /** Razorpay says the payment went through - verify it, then unlock the workspace. */
  @Post('confirm')
  @HttpCode(200)
  @Roles('ADMIN')
  async confirm(
    @CurrentTenant() tenantId: string,
    @Body('invoiceId') invoiceId: string,
    @Body('razorpayOrderId') orderId: string,
    @Body('razorpayPaymentId') paymentId: string,
    @Body('razorpaySignature') signature: string,
  ) {
    const invoice: any = await this.invoiceModel.findOne({ _id: invoiceId, tenantId });
    if (!invoice) throw new BadRequestException('Invoice not found');
    if (invoice.status === 'paid') {
      return { ok: true, alreadyPaid: true, subscription: await this.subscriptions.stateFor(tenantId) };
    }
    if (!this.razorpay.verifyPayment(orderId, paymentId, signature)) {
      throw new BadRequestException('This payment could not be verified. Nothing has been charged twice - please try again.');
    }

    const planId = invoice.metadata?.planId || 'basic';
    const quote = this.subscriptions.quote(planId, invoice.metadata?.billingInterval === 'yearly' ? 'yearly' : 'monthly', invoice.metadata?.custom);
    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      { $set: { status: 'paid', paidAt: new Date(), 'metadata.paymentId': paymentId } },
    );
    const subscription = await this.subscriptions.activate(tenantId, planId, quote, {
      provider: 'razorpay',
      reference: paymentId,
      paidAt: new Date(),
    });
    return { ok: true, subscription };
  }
}
