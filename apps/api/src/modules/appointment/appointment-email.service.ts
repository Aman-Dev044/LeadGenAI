import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { IEmailProvider } from '../../common/interfaces';

type AppointmentEmailKind = 'confirmation' | 'reschedule' | 'cancellation';

interface EmailContext {
  tenantName: string;
  logo?: string;
  primaryColor: string;
  timezone: string;
  organizerName?: string;
  organizerEmail?: string;
  contactEmail?: string;
}

const isEmail = (v?: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Sends professional appointment emails (confirmation, reschedule, cancellation)
 * to the attendee, with the meeting link, date/time in the tenant's timezone and
 * an .ics calendar invite. The assigned salesperson is CC'd when they have an email.
 */
@Injectable()
export class AppointmentEmailService {
  private readonly logger = new Logger(AppointmentEmailService.name);

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly configService: ConfigService,
  ) {}

  /** Fire-and-forget entry point used by AppointmentService. Never throws. */
  notify(kind: AppointmentEmailKind, tenantId: string, appointment: any, extra: { previousStart?: Date; reason?: string } = {}) {
    this.send(kind, tenantId, appointment, extra).catch((err) =>
      this.logger.warn(`Appointment ${kind} email failed: ${err.message}`),
    );
  }

  async send(kind: AppointmentEmailKind, tenantId: string, appointment: any, extra: { previousStart?: Date; reason?: string } = {}) {
    const appt = typeof appointment?.toObject === 'function' ? appointment.toObject() : appointment;
    const to: string = String(appt?.attendee?.email || "");
    if (!isEmail(to)) {
      this.logger.debug(`Appointment ${appt?._id}: attendee has no valid email - ${kind} email skipped`);
      return false;
    }

    const ctx = await this.buildContext(tenantId, appt.assignedTo);
    const subject = this.subjectFor(kind, appt, ctx);
    const html = this.render(kind, appt, ctx, extra);
    const ics = kind === 'cancellation' ? this.buildIcs(appt, ctx, 'CANCEL') : this.buildIcs(appt, ctx, 'REQUEST');

    const result = await this.email.sendEmail({
      to,
      subject,
      html,
      replyTo: ctx.organizerEmail || ctx.contactEmail,
      attachments: [
        {
          filename: kind === 'cancellation' ? 'cancelled.ics' : 'invite.ics',
          content: ics,
          contentType: 'text/calendar; charset=utf-8; method=' + (kind === 'cancellation' ? 'CANCEL' : 'REQUEST'),
        },
      ],
    });

    // Courtesy copy for the salesperson so their inbox has the same details
    if (result.success && isEmail(ctx.organizerEmail) && ctx.organizerEmail !== to) {
      this.email
        .sendEmail({
          to: ctx.organizerEmail!,
          subject: `[Copy] ${subject}`,
          html,
          attachments: [{ filename: 'invite.ics', content: ics, contentType: 'text/calendar; charset=utf-8' }],
        })
        .catch(() => undefined);
    }

    if (result.success) this.logger.log(`Appointment ${kind} email sent to ${to} (${appt._id})`);
    return result.success;
  }

  // ─── Context ──────────────────────────────────────────────────────

  private async buildContext(tenantId: string, assignedTo?: string): Promise<EmailContext> {
    const tenant: any = await this.tenantModel.findById(tenantId).select('name logo branding settings domain').lean();
    let organizer: any = null;
    if (assignedTo && /^[a-f\d]{24}$/i.test(assignedTo)) {
      organizer = await this.userModel.findOne({ _id: assignedTo, tenantId }).select('firstName lastName email').lean();
    }
    return {
      tenantName: tenant?.name || this.configService.get<string>('email.fromName') || 'Our team',
      logo: tenant?.logo || undefined,
      primaryColor: tenant?.branding?.primaryColor || '#4F46E5',
      timezone: tenant?.settings?.timezone || 'Asia/Kolkata',
      organizerName: organizer ? `${organizer.firstName || ''} ${organizer.lastName || ''}`.trim() : undefined,
      organizerEmail: organizer?.email,
      contactEmail: this.configService.get<string>('email.from'),
    };
  }

  // ─── Content ──────────────────────────────────────────────────────

  private subjectFor(kind: AppointmentEmailKind, appt: any, ctx: EmailContext): string {
    const when = this.formatDate(appt.startTime, ctx.timezone, true);
    switch (kind) {
      case 'confirmation':
        return `Confirmed: ${appt.title || 'Your appointment'} on ${when}`;
      case 'reschedule':
        return `Rescheduled: ${appt.title || 'Your appointment'} is now on ${when}`;
      case 'cancellation':
        return `Cancelled: ${appt.title || 'Your appointment'} on ${when}`;
    }
  }

  private render(kind: AppointmentEmailKind, appt: any, ctx: EmailContext, extra: { previousStart?: Date; reason?: string }): string {
    const name = this.escape(appt.attendee?.name?.split(' ')[0] || 'there');
    const title = this.escape(appt.title || 'Appointment');
    const date = this.escape(this.formatDate(appt.startTime, ctx.timezone));
    const time = this.escape(`${this.formatTime(appt.startTime, ctx.timezone)} - ${this.formatTime(appt.endTime, ctx.timezone)} (${ctx.timezone})`);
    const duration = Math.max(1, Math.round((new Date(appt.endTime).getTime() - new Date(appt.startTime).getTime()) / 60000));
    const link: string | undefined = appt.meetingLink;
    const color = ctx.primaryColor;

    const headline =
      kind === 'confirmation' ? 'Your appointment is confirmed'
      : kind === 'reschedule' ? 'Your appointment has been rescheduled'
      : 'Your appointment has been cancelled';

    const intro =
      kind === 'confirmation'
        ? `Thank you for scheduling time with ${this.escape(ctx.tenantName)}. Here are the details of your appointment.`
        : kind === 'reschedule'
          ? `Your appointment with ${this.escape(ctx.tenantName)} has been moved${extra.previousStart ? ` from ${this.escape(this.formatDate(extra.previousStart, ctx.timezone, true))}` : ''}. The updated details are below.`
          : `We are sorry to let you know that your appointment with ${this.escape(ctx.tenantName)} has been cancelled.${extra.reason ? ` Reason: ${this.escape(extra.reason)}.` : ''} Please reply to this email if you would like to book a new time.`;

    const rows: string[] = [
      this.row('What', title),
      this.row('Date', date),
      this.row('Time', time),
      this.row('Duration', `${duration} minutes`),
    ];
    if (ctx.organizerName) rows.push(this.row('With', this.escape(ctx.organizerName)));
    if (appt.description) rows.push(this.row('Notes', this.escape(appt.description)));
    if (link && kind !== 'cancellation') rows.push(this.row('Meeting link', `<a href="${this.escapeAttr(link)}" style="color:${color};word-break:break-all">${this.escape(link)}</a>`));

    const cta =
      link && kind !== 'cancellation'
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 8px"><tr><td style="border-radius:8px;background:${color}">
             <a href="${this.escapeAttr(link)}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Join Meeting</a>
           </td></tr></table>
           <p style="margin:0 0 24px;text-align:center;font-size:12px;color:#6b7280">A calendar invite (.ics) is attached — open it to add this meeting to your calendar.</p>`
        : kind !== 'cancellation'
          ? `<p style="margin:24px 0;text-align:center;font-size:12px;color:#6b7280">A calendar invite (.ics) is attached — open it to add this meeting to your calendar.</p>`
          : '';

    const reschedule = kind === 'reschedule' && extra.reason ? `<p style="margin:0 0 16px;color:#374151">Reason: ${this.escape(extra.reason)}</p>` : '';
    const logo = ctx.logo
      ? `<img src="${this.escapeAttr(ctx.logo)}" alt="${this.escape(ctx.tenantName)}" style="max-height:40px;max-width:180px;display:block;margin:0 auto 12px">`
      : '';

    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="background:${color};padding:28px 32px;text-align:center;color:#ffffff">
          ${logo}
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">${this.escape(ctx.tenantName)}</div>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:600">${headline}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:16px">Hi ${name},</p>
          <p style="margin:0 0 24px;color:#374151;line-height:1.6">${intro}</p>
          ${reschedule}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
            ${rows.join('')}
          </table>
          ${cta}
          <p style="margin:24px 0 0;color:#374151;line-height:1.6">Need to make changes? Simply reply to this email${ctx.organizerName ? ` and ${this.escape(ctx.organizerName)} will help you out` : ''}.</p>
          <p style="margin:24px 0 0;color:#111827">Best regards,<br><strong>${this.escape(ctx.organizerName || ctx.tenantName)}</strong>${ctx.organizerName ? `<br><span style="color:#6b7280">${this.escape(ctx.tenantName)}</span>` : ''}</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af">
          This email was sent by ${this.escape(ctx.tenantName)} regarding an appointment you booked.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private row(label: string, value: string): string {
    return `<tr>
      <td style="padding:12px 16px;width:130px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${label}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:15px;color:#111827">${value}</td>
    </tr>`;
  }

  // ─── Calendar invite ──────────────────────────────────────────────

  private buildIcs(appt: any, ctx: EmailContext, method: 'REQUEST' | 'CANCEL'): string {
    const fmt = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const uid = `${appt._id}@ai-lead-gen`;
    const organizer = ctx.organizerEmail || ctx.contactEmail || 'noreply@example.com';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Lead Gen//Appointments//EN',
      `METHOD:${method}`,
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SEQUENCE:${appt.rescheduledCount || 0}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(appt.startTime)}`,
      `DTEND:${fmt(appt.endTime)}`,
      `SUMMARY:${this.icsText(appt.title || 'Appointment')}`,
      `DESCRIPTION:${this.icsText([appt.description, appt.meetingLink ? `Join: ${appt.meetingLink}` : ''].filter(Boolean).join('\\n'))}`,
      appt.meetingLink ? `LOCATION:${this.icsText(appt.meetingLink)}` : '',
      appt.meetingLink ? `URL:${appt.meetingLink}` : '',
      `ORGANIZER;CN=${this.icsText(ctx.organizerName || ctx.tenantName)}:mailto:${organizer}`,
      appt.attendee?.email ? `ATTENDEE;CN=${this.icsText(appt.attendee.name || '')};RSVP=TRUE:mailto:${appt.attendee.email}` : '',
      `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);
    return lines.join('\r\n');
  }

  private icsText(v: string): string {
    return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  // ─── Formatting ───────────────────────────────────────────────────

  private formatDate(d: Date | string, timeZone: string, withTime = false): string {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
      }).format(new Date(d));
    } catch {
      return new Date(d).toUTCString();
    }
  }

  private formatTime(d: Date | string, timeZone: string): string {
    try {
      return new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d));
    } catch {
      return new Date(d).toISOString();
    }
  }

  private escape(v: string): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(v: string): string {
    return this.escape(v).replace(/'/g, '&#39;');
  }
}
