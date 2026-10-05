import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationService } from '../notification/notification.service';
import { AppointmentEmailService } from './appointment-email.service';
import { AppointmentService } from './appointment.service';
import { AppointmentReminderSettings, resolveCallingSettings } from '../calling/calling-settings';

const DEFAULT_POLL_MS = 60_000;
const MAX_PER_TICK = 200;
const MIN = 60_000;
const HOUR = 60 * MIN;

type TenantCtx = {
  tenantId: string;
  settings: AppointmentReminderSettings;
  timezone: string;
  company: string;
  agentName: string;
};

/**
 * Keeps booked meetings from being forgotten:
 *  - ~24h before: WhatsApp (+ e-mail when known) to the lead with the details
 *  - N minutes before: a short WhatsApp to the lead, and a nudge to the salesperson
 *  - after the start time with nobody marking it done: ask the salesperson
 *    "did it happen?", and (optionally) treat it as a no-show automatically -
 *    which triggers the rescue (missed-meeting WhatsApp + AI reschedule call)
 *    in CallingService.
 *
 * One sweep a minute inside the API process. With several replicas set
 * APPOINTMENT_REMINDERS_ENABLED=false on all but one.
 */
@Injectable()
export class AppointmentReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    private readonly notifications: NotificationService,
    private readonly emails: AppointmentEmailService,
    private readonly appointments: AppointmentService,
  ) {}

  onModuleInit() {
    if (process.env.APPOINTMENT_REMINDERS_ENABLED === 'false') {
      this.logger.log('Appointment reminders disabled by environment');
      return;
    }
    const ms = parseInt(process.env.APPOINTMENT_REMINDER_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.tick(), ms);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 20_000).unref?.();
    this.logger.log(`Appointment reminders: sweep every ${Math.round(ms / 1000)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One sweep. Returns how many actions went out. Safe to call by hand. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const now = Date.now();
      const appts: any[] = await this.appointmentModel
        .find({
          status: { $in: ['scheduled', 'confirmed'] },
          startTime: { $gte: new Date(now - 25 * HOUR), $lte: new Date(now + 25 * HOUR) },
        })
        .sort({ startTime: 1 })
        .limit(MAX_PER_TICK)
        .lean();
      if (!appts.length) return 0;

      const ctxCache = new Map<string, TenantCtx | null>();
      for (const appt of appts) {
        try {
          let ctx = ctxCache.get(appt.tenantId);
          if (ctx === undefined) {
            ctx = await this.tenantCtx(appt.tenantId);
            ctxCache.set(appt.tenantId, ctx);
          }
          if (!ctx || !ctx.settings.enabled) continue;
          sent += await this.processOne(appt, ctx, now);
        } catch (err: any) {
          this.logger.warn(`Reminder sweep failed for appointment ${appt._id}: ${err?.message}`);
        }
      }
      if (sent) this.logger.log(`Appointment sweep: ${sent} action(s)`);
      return sent;
    } catch (err: any) {
      this.logger.error(`Appointment reminder sweep failed: ${err?.message}`);
      return sent;
    } finally {
      this.running = false;
    }
  }

  private async tenantCtx(tenantId: string): Promise<TenantCtx | null> {
    const tenant: any = await this.tenantModel.findById(tenantId).select('name callingSettings settings status deletedAt').lean();
    if (!tenant || tenant.deletedAt) return null;
    const s = resolveCallingSettings(tenant.callingSettings);
    return {
      tenantId,
      settings: s.appointmentReminders,
      timezone: tenant.settings?.timezone || 'Asia/Kolkata',
      company: s.assistant.companyName || tenant.name || 'our team',
      agentName: s.assistant.agentName,
    };
  }

  /**
   * When this slot was agreed - the original booking, or the last time it was
   * moved. A meeting booked (or rescheduled) minutes ago must not get a
   * "reminder about your meeting tomorrow" straight after the confirmation.
   */
  private bookedAt(appt: any): number {
    const times = [new Date(appt.createdAt || 0).getTime()];
    for (const h of appt.rescheduleHistory || []) {
      const t = new Date(h?.at || 0).getTime();
      if (Number.isFinite(t)) times.push(t);
    }
    return Math.max(...times.filter(Number.isFinite), 0);
  }

  private async processOne(appt: any, ctx: TenantCtx, now: number): Promise<number> {
    const s = ctx.settings;
    const start = new Date(appt.startTime).getTime();
    const until = start - now;
    const age = now - this.bookedAt(appt);
    const r = appt.reminders || {};
    let n = 0;

    // Day-before reminder: inside 24h, but not when the short reminder is about
    // to fire anyway, and not for a meeting that was only just booked (they
    // received the confirmation minutes ago).
    if (s.dayBefore && !r.dayBeforeAt && until <= 24 * HOUR && until > (s.minutesBefore + 30) * MIN && age > 2 * HOUR) {
      if (await this.remindLead(appt, ctx, 'day_before')) n++;
      await this.appointmentModel.updateOne({ _id: appt._id }, { $set: { 'reminders.dayBeforeAt': new Date(), reminderSentAt: new Date() } });
    }

    // Short reminder before the meeting
    if (s.hourBefore && !r.hourBeforeAt && until > 0 && until <= s.minutesBefore * MIN && age > 20 * MIN) {
      if (await this.remindLead(appt, ctx, 'hour_before')) n++;
      await this.appointmentModel.updateOne({ _id: appt._id }, { $set: { 'reminders.hourBeforeAt': new Date(), reminderSentAt: new Date() } });
    }

    // Salesperson nudge (in-app + push)
    if (s.remindSalesperson && !r.salespersonAt && until > 0 && until <= Math.min(s.minutesBefore, 30) * MIN && appt.assignedTo) {
      await this.nudgeSalesperson(appt, ctx, 'upcoming', until);
      await this.appointmentModel.updateOne({ _id: appt._id }, { $set: { 'reminders.salespersonAt': new Date() } });
      n++;
    }

    // Meeting time passed and nobody said what happened
    const ns = s.noShowRescue;
    if (ns.enabled && until <= 0) {
      const late = -until;
      if (!appt.outcomeAskedAt && late >= ns.askAfterMinutes * MIN && appt.assignedTo) {
        await this.nudgeSalesperson(appt, ctx, 'outcome', until);
        await this.appointmentModel.updateOne({ _id: appt._id }, { $set: { outcomeAskedAt: new Date() } });
        n++;
      }
      if (ns.autoMarkAfterMinutes > 0 && late >= ns.autoMarkAfterMinutes * MIN) {
        await this.appointments.markNoShow(ctx.tenantId, String(appt._id), 'auto');
        n++;
      }
    }
    return n;
  }

  // ─── Lead reminders ───────────────────────────────────────────────

  private async remindLead(appt: any, ctx: TenantCtx, kind: 'day_before' | 'hour_before'): Promise<boolean> {
    const lead: any = appt.leadId && /^[a-f\d]{24}$/i.test(appt.leadId)
      ? await this.leadModel.findOne({ _id: appt.leadId, tenantId: ctx.tenantId }).select('firstName lastName phone email').lean()
      : null;
    const phone = appt.attendee?.phone || lead?.phone;
    const firstName = (appt.attendee?.name || `${lead?.firstName || ''}`).trim().split(/\s+/)[0] || 'there';

    const tz = ctx.timezone;
    const at = new Date(appt.startTime);
    const dateOf = at.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeOf = at.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    const when = kind === 'day_before' ? (this.isTomorrow(at, tz) ? 'tomorrow' : `on ${dateOf.split(',')[0]}`) : this.inPhrase(at.getTime() - Date.now());

    let salesperson = ctx.company;
    let contact = '';
    if (appt.assignedTo && /^[a-f\d]{24}$/i.test(appt.assignedTo)) {
      const u: any = await this.userModel.findById(appt.assignedTo).select('firstName lastName phone').lean();
      if (u) {
        salesperson = `${u.firstName || ''} ${u.lastName || ''}`.trim() || salesperson;
        contact = u.phone || '';
      }
    }
    const link = appt.meetingLink || appt.conferenceLink || '';
    const contactLine = contact || link || ctx.company;

    let delivered = false;

    // E-mail (day-before only - the short one is a WhatsApp ping)
    if (kind === 'day_before' && appt.attendee?.email) {
      this.emails.notify('reminder', ctx.tenantId, appt);
      delivered = true;
    }

    if (phone) {
      const body =
        `Hi ${firstName}, a quick reminder about your meeting ${when}:\n\n` +
        `📅 ${dateOf}\n⏰ ${timeOf}\n👤 With: ${salesperson}\n📞 ${contactLine}\n🏢 ${ctx.company}\n\n` +
        (link ? `Join: ${link}\n\n` : '') +
        'Reply here if you need to reschedule. See you soon!';
      const tpls = await this.notifications.whatsappTemplates(ctx.tenantId);
      let template: { sid: string; variables: Record<string, string> } | undefined;
      if (tpls.reminder) {
        template = { sid: tpls.reminder, variables: { 1: firstName, 2: when, 3: dateOf, 4: timeOf, 5: salesperson, 6: contactLine, 7: ctx.company } };
      } else if (tpls.appointment) {
        template = { sid: tpls.appointment, variables: { 1: firstName, 2: dateOf, 3: timeOf, 4: salesperson, 5: contactLine, 6: ctx.company } };
      }
      const sent = await this.notifications.sendToLead(
        ctx.tenantId,
        'whatsapp',
        { _id: appt.leadId || appt._id, phone },
        {
          title: 'WhatsApp',
          body,
          type: 'appointment',
          data: { appointmentId: String(appt._id), reminder: kind, ...(template ? { template } : {}) },
        },
      );
      if (sent) {
        delivered = true;
        if (lead) {
          await this.activityModel.create({
            tenantId: ctx.tenantId,
            leadId: String(lead._id),
            type: 'whatsapp_sent',
            description: `Meeting reminder sent on WhatsApp (${kind === 'day_before' ? 'day before' : when}): ${dateOf} ${timeOf}`,
            newValue: { appointmentId: String(appt._id), kind },
          });
        }
      }
    }
    return delivered;
  }

  private isTomorrow(at: Date, tz: string): boolean {
    const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
    return day(at) === day(new Date(Date.now() + 24 * HOUR));
  }

  private inPhrase(ms: number): string {
    const mins = Math.max(1, Math.round(ms / MIN));
    if (mins >= 55 && mins <= 75) return 'in about an hour';
    if (mins > 75) return `in about ${Math.round(mins / 60)} hours`;
    if (mins >= 25 && mins <= 35) return 'in about 30 minutes';
    return `in about ${mins} minutes`;
  }

  // ─── Salesperson nudges ───────────────────────────────────────────

  private async nudgeSalesperson(appt: any, ctx: TenantCtx, kind: 'upcoming' | 'outcome', until: number) {
    const who = appt.attendee?.name || appt.title || 'the lead';
    const at = new Date(appt.startTime);
    const timeOf = at.toLocaleTimeString('en-IN', { timeZone: ctx.timezone, hour: 'numeric', minute: '2-digit' });
    const phone = appt.attendee?.phone ? ` · ${appt.attendee.phone}` : '';
    const title =
      kind === 'upcoming'
        ? `Meeting ${this.inPhrase(until)}: ${who}`
        : `Did the meeting with ${who} happen?`;
    const body =
      kind === 'upcoming'
        ? `${timeOf}${phone}${appt.meetingLink || appt.conferenceLink ? ' · link in Appointments' : ''}`
        : `Scheduled ${timeOf}${phone}. Mark it done or no-show in Appointments - a no-show gets a WhatsApp and an AI reschedule call automatically.`;
    for (const channel of ['in_app', 'push'] as const) {
      await this.notifications
        .create(ctx.tenantId, {
          userId: appt.assignedTo,
          title,
          body,
          type: 'appointment',
          channel,
          data: { appointmentId: String(appt._id), leadId: appt.leadId, nudge: kind },
        })
        .catch(() => undefined);
    }
  }
}
