import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IEmailProvider } from '../../common/interfaces';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { NotificationService } from '../notification/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_POLL_MS = 60 * 60 * 1000; // hourly
const DEFAULT_DAYS_BEFORE = 7;

export type RenewalKind = 'trial' | 'subscription';

export interface RenewalCandidate {
  tenant: any;
  kind: RenewalKind;
  plan: string;
  expiresAt: Date;
}

/**
 * Warns tenant admins N days (default 7) before their trial or paid plan expires,
 * by email and in-app notification. Runs inside the API process on a timer.
 *
 * Each expiry date is reminded about exactly once: the tenant document records
 * `renewalReminder.expiresAt`, and the claim is an atomic conditional update so
 * several API replicas never double-send.
 */
@Injectable()
export class PlanExpiryReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanExpiryReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('Subscription') private readonly subscriptionModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = (process.env.PLAN_REMINDER_ENABLED || 'true') !== 'false';
    if (!enabled) {
      this.logger.warn('Plan expiry reminders disabled via PLAN_REMINDER_ENABLED=false');
      return;
    }
    const interval = parseInt(process.env.PLAN_REMINDER_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.runOnce(), interval);
    this.timer.unref?.();
    setTimeout(() => void this.runOnce(), 15_000).unref?.();
    this.logger.log(`Plan expiry reminders started (every ${Math.round(interval / 60000)} min, ${this.daysBefore()} days before expiry)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  daysBefore(): number {
    const n = parseInt(process.env.PLAN_REMINDER_DAYS_BEFORE || '', 10);
    return n > 0 ? n : DEFAULT_DAYS_BEFORE;
  }

  /** One sweep. Safe to call manually (owner console / tests). Returns how many reminders went out. */
  async runOnce(): Promise<{ sent: number; skipped: number }> {
    if (this.running) return { sent: 0, skipped: 0 };
    this.running = true;
    let sent = 0;
    let skipped = 0;
    try {
      const candidates = await this.findCandidates(new Date());
      for (const c of candidates) {
        try {
          const claimed = await this.claim(c);
          if (!claimed) {
            skipped++;
            continue;
          }
          await this.send(c);
          sent++;
        } catch (err: any) {
          this.logger.error(`Renewal reminder failed for tenant ${c.tenant?._id}: ${err.message}`);
        }
      }
      if (sent) this.logger.log(`Sent ${sent} plan renewal reminder(s)`);
    } catch (err: any) {
      this.logger.error(`Renewal reminder sweep failed: ${err.message}`);
    } finally {
      this.running = false;
    }
    return { sent, skipped };
  }

  /** Trials and paid subscriptions that end within the reminder window. */
  async findCandidates(now: Date): Promise<RenewalCandidate[]> {
    const windowEnd = new Date(now.getTime() + this.daysBefore() * DAY_MS);
    const out: RenewalCandidate[] = [];

    const trials = await this.tenantModel
      .find({
        status: 'trial',
        deletedAt: null,
        isPlatformOwner: { $ne: true },
        trialEndsAt: { $gt: now, $lte: windowEnd },
      })
      .lean();
    for (const tenant of trials) {
      out.push({ tenant, kind: 'trial', plan: tenant.plan || 'trial', expiresAt: new Date(tenant.trialEndsAt) });
    }

    const subs = await this.subscriptionModel
      .find({
        status: 'active',
        priceMonthly: { $gt: 0 },
        currentPeriodEnd: { $gt: now, $lte: windowEnd },
      })
      .lean();
    if (subs.length) {
      const tenantIds = [...new Set(subs.map((s: any) => String(s.tenantId)))];
      const tenants = await this.tenantModel
        .find({ _id: { $in: tenantIds }, deletedAt: null, isPlatformOwner: { $ne: true }, status: { $nin: ['suspended', 'cancelled'] } })
        .lean();
      const byId = new Map(tenants.map((t: any) => [String(t._id), t]));
      for (const sub of subs) {
        const tenant = byId.get(String(sub.tenantId));
        if (!tenant) continue;
        if (out.some((c) => String(c.tenant._id) === String(tenant._id))) continue;
        out.push({ tenant, kind: 'subscription', plan: sub.plan, expiresAt: new Date(sub.currentPeriodEnd) });
      }
    }

    return out;
  }

  /** Atomically mark this expiry as reminded; false when another replica (or an earlier sweep) already did. */
  private async claim(c: RenewalCandidate): Promise<boolean> {
    const res = await this.tenantModel.updateOne(
      {
        _id: c.tenant._id,
        $or: [
          { renewalReminder: { $exists: false } },
          { renewalReminder: null },
          { 'renewalReminder.expiresAt': { $ne: c.expiresAt } },
        ],
      },
      { $set: { renewalReminder: { kind: c.kind, plan: c.plan, expiresAt: c.expiresAt, sentAt: new Date() } } },
    );
    return (res?.modifiedCount ?? 0) > 0;
  }

  private async send(c: RenewalCandidate) {
    const tenantId = String(c.tenant._id);
    const admins = await this.userModel
      .find({ tenantId, role: 'ADMIN', isActive: true, deletedAt: null })
      .select('email firstName lastName')
      .lean();

    const daysLeft = Math.max(1, Math.ceil((c.expiresAt.getTime() - Date.now()) / DAY_MS));
    const appUrl = this.configService.get<string>('app.url') || 'http://localhost:3001';
    const billingUrl = `${appUrl}/dashboard/billing`;
    const when = c.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const planLabel = c.plan.charAt(0).toUpperCase() + c.plan.slice(1);
    const what = c.kind === 'trial' ? 'free trial' : `${planLabel} plan`;

    const title = c.kind === 'trial' ? `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : `Your ${planLabel} plan renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    const body =
      c.kind === 'trial'
        ? `Your ${what} for ${c.tenant.name} ends on ${when}. Choose a plan to keep your AI agents, leads and conversations running.`
        : `Your ${what} for ${c.tenant.name} expires on ${when}. Renew now to avoid any interruption.`;

    for (const admin of admins) {
      // In-app (shows in the header bell, pushed live over the notifications socket)
      await this.notificationService.create(tenantId, {
        userId: String(admin._id),
        title,
        body,
        type: 'billing',
        channel: 'in_app',
        data: { kind: c.kind, plan: c.plan, expiresAt: c.expiresAt.toISOString(), daysLeft, url: '/dashboard/billing' },
      });

      if (!admin.email) continue;
      try {
        await this.emailProvider.sendEmail({
          to: admin.email,
          subject: `${title} - action needed for ${c.tenant.name}`,
          text: `Hi ${admin.firstName || ''},\n\n${body}\n\nRenew here: ${billingUrl}\n\nAI Lead Generation Platform`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${title}</h2>
              <p>Hi ${admin.firstName || ''},</p>
              <p>${body}</p>
              <table style="border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                <tr><td style="padding: 6px 12px; color: #666;">Workspace</td><td style="padding: 6px 12px;"><strong>${c.tenant.name}</strong> (${c.tenant.slug})</td></tr>
                <tr><td style="padding: 6px 12px; color: #666;">Current</td><td style="padding: 6px 12px;">${c.kind === 'trial' ? 'Free trial' : `${planLabel} plan`}</td></tr>
                <tr><td style="padding: 6px 12px; color: #666;">${c.kind === 'trial' ? 'Ends on' : 'Expires on'}</td><td style="padding: 6px 12px;"><strong>${when}</strong> (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)</td></tr>
              </table>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${billingUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  ${c.kind === 'trial' ? 'Choose a plan' : 'Renew now'}
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">After the ${c.kind === 'trial' ? 'trial ends' : 'plan expires'}, your workspace drops to the free tier limits until you renew.</p>
              <hr style="border: 1px solid #eee;" />
              <p style="color: #999; font-size: 12px;">AI Lead Generation Platform</p>
            </div>
          `,
        });
      } catch (err: any) {
        this.logger.warn(`Renewal email to ${admin.email} failed: ${err.message}`);
      }
    }

    this.logger.log(`Renewal reminder (${c.kind}, ${daysLeft}d left) sent to ${admins.length} admin(s) of tenant ${c.tenant.slug}`);
  }
}
