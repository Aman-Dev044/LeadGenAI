import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IEmailProvider } from '../../common/interfaces/email-provider.interface';
import { TwilioWhatsAppSender } from '../whatsapp/twilio-whatsapp.sender';
import { InsightsService } from './insights.service';
import { ExperimentService } from './experiment.service';

const SWEEP_MS = 30 * 60 * 1000;

/**
 * The weekly note to whoever runs sales: what the agent did, what it is worst
 * at, where the deals leaked, and whether a script test produced a winner.
 *
 * One message a week, on a fixed morning, with numbers that move. It is the
 * part of the product a manager actually reads - the dashboard is for the
 * person who already cares.
 */
@Injectable()
export class DigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @Inject('EMAIL_PROVIDER') private readonly email: IEmailProvider,
    private readonly insights: InsightsService,
    private readonly experiments: ExperimentService,
    @Inject(forwardRef(() => TwilioWhatsAppSender)) private readonly whatsapp: TwilioWhatsAppSender,
  ) {}

  onModuleInit() {
    if (process.env.REVENUE_BRAIN_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    this.timer.unref?.();
    this.logger.log('Revenue Brain: weekly digest armed');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Monday morning, once per workspace. The marker on the tenant means a
   * restart, a second replica or a slow week cannot send it twice.
   */
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      if (ist.getDay() !== 1 || ist.getHours() < 9 || ist.getHours() > 11) return 0;

      const weekKey = this.weekKey(ist);
      const tenants: any[] = await this.tenantModel
        .find({ deletedAt: null, status: { $in: ['active', 'trial'] } })
        .select('_id name revenueBrain')
        .lean();

      for (const t of tenants) {
        if (t.revenueBrain?.lastDigestWeek === weekKey) continue;
        try {
          const ok = await this.sendFor(String(t._id));
          await this.tenantModel.updateOne(
            { _id: t._id },
            { $set: { 'revenueBrain.lastDigestWeek': weekKey, 'revenueBrain.lastDigestAt': new Date() } },
          );
          if (ok) sent++;
        } catch (err: any) {
          this.logger.warn(`Digest for ${t.name} failed: ${err?.message}`);
        }
      }
      if (sent) this.logger.log(`Revenue Brain: ${sent} weekly digest(s) sent`);
      return sent;
    } finally {
      this.running = false;
    }
  }

  private weekKey(d: Date): string {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /** Build the digest for one workspace and send it. Returns false if there was nothing to say. */
  async sendFor(tenantId: string): Promise<boolean> {
    const digest = await this.build(tenantId);
    if (!digest.worthSending) return false;

    const admins: any[] = await this.userModel
      .find({ tenantId, role: { $in: ['ADMIN', 'SALES_MANAGER'] }, isActive: true, deletedAt: null })
      .select('email firstName phone')
      .lean();
    if (!admins.length) return false;

    const html = this.renderHtml(digest);
    for (const a of admins) {
      if (!a.email) continue;
      await this.email
        .sendEmail({ to: a.email, subject: digest.subject, html, tenantId })
        .catch((err) => this.logger.warn(`Digest e-mail to ${a.email} failed: ${err?.message}`));
    }

    // WhatsApp is opt-in: it is a push, not a report
    if (digest.whatsappEnabled) {
      for (const a of admins.filter((x) => x.phone)) {
        await this.whatsapp
          .send(tenantId, a.phone, this.renderWhatsApp(digest))
          .catch((err) => this.logger.warn(`Digest WhatsApp failed: ${err?.message}`));
      }
    }
    return true;
  }

  /** Everything the digest says, in one object - also used by the preview endpoint. */
  async build(tenantId: string, days = 7) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('name revenueBrain').lean();
    const o = await this.insights.overview(tenantId, days);
    const experiments = await this.experiments.list(tenantId);
    const running = experiments.find((e: any) => e.status === 'running');
    const justPromoted = experiments.find(
      (e: any) => e.status === 'promoted' && e.promotedAt && Date.now() - new Date(e.promotedAt).getTime() < days * 86_400_000,
    );

    const h = o.headline;
    const arrow = (n: number) => (n > 0 ? `+${n}` : `${n}`);

    return {
      tenantId,
      workspace: tenant?.name || 'your workspace',
      days,
      worthSending: h.reviewed > 0,
      whatsappEnabled: tenant?.revenueBrain?.whatsappDigest === true,
      subject: `${tenant?.name || 'Your workspace'}: ${h.reviewed} calls reviewed, ${h.meetingRate}% booked a meeting`,
      headline: h,
      arrow,
      biggestLeak: o.lossReasons.find((r: any) => r.key !== 'none'),
      weakest: o.rubric.length ? o.rubric[o.rubric.length - 1] : null,
      strongest: o.rubric.length ? o.rubric[0] : null,
      lossReasons: o.lossReasons.filter((r: any) => r.key !== 'none').slice(0, 4),
      unansweredQuestions: o.unansweredQuestions.slice(0, 3),
      competitors: o.competitors.slice(0, 3),
      coaching: o.worstCalls.slice(0, 3).map((c: any) => ({ lead: c.leadName, line: c.coaching })),
      running,
      justPromoted,
    };
  }

  // ─── Rendering ────────────────────────────────────────────────────

  private renderHtml(d: any): string {
    const h = d.headline;
    const card = (label: string, value: string, sub = '') =>
      `<td style="padding:14px 10px;background:#f8fafc;border-radius:10px;text-align:center;vertical-align:top">
        <div style="font-size:22px;font-weight:800;color:#0f172a">${value}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${label}</div>
        ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${sub}</div>` : ''}
      </td>`;

    const list = (items: string[]) =>
      items.length
        ? `<ul style="margin:6px 0 0;padding-left:18px;color:#334155;font-size:13px;line-height:1.7">${items
            .map((i) => `<li>${esc(i)}</li>`)
            .join('')}</ul>`
        : '<p style="color:#94a3b8;font-size:13px;margin:6px 0 0">Nothing this week.</p>';

    const section = (title: string, body: string) =>
      `<h2 style="margin:26px 0 4px;font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.06em">${title}</h2>${body}`;

    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e8f0">
  <p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:700">Revenue Brain · weekly</p>
  <h1 style="margin:6px 0 2px;font-size:21px;color:#0f172a">${esc(d.workspace)}</h1>
  <p style="margin:0;color:#64748b;font-size:13px">What your AI agent did in the last ${d.days} days, and what to change.</p>

  <table style="width:100%;border-spacing:8px;margin-top:18px"><tr>
    ${card('Calls reviewed', String(h.reviewed))}
    ${card('Meetings booked', `${h.meetingRate}%`, `${d.arrow(h.delta.meetingRate)} pts`)}
    ${card('Call quality', `${h.avgScore}/100`, `${d.arrow(h.delta.avgScore)} pts`)}
  </tr></table>

  ${
    d.biggestLeak
      ? section(
          'Biggest leak',
          `<p style="margin:6px 0 0;font-size:15px;color:#0f172a"><strong>${esc(d.biggestLeak.label)}</strong> — ${
            d.biggestLeak.share
          }% of calls</p>${
            d.biggestLeak.quote
              ? `<p style="margin:6px 0 0;padding:10px 12px;background:#f5f3ff;border-left:3px solid #4f46e5;border-radius:0 8px 8px 0;font-size:13px;color:#334155;font-style:italic">&ldquo;${esc(
                  d.biggestLeak.quote,
                )}&rdquo;</p>`
              : ''
          }`,
        )
      : ''
  }

  ${
    d.weakest
      ? section(
          'Weakest skill',
          `<p style="margin:6px 0 0;font-size:14px;color:#0f172a">The agent <strong>${esc(
            d.weakest.label.toLowerCase(),
          )}</strong> on only <strong>${d.weakest.passRate}%</strong> of calls.${
            d.weakest.example ? ` ${esc(d.weakest.example)}` : ''
          }</p>`,
        )
      : ''
  }

  ${section(
    'Why deals did not move',
    list(d.lossReasons.map((r: any) => `${r.label} — ${r.share}% (${r.count} calls)`)),
  )}

  ${
    d.unansweredQuestions.length
      ? section(
          'Questions it could not answer',
          `${list(
            d.unansweredQuestions.map((q: any) => `${q.question} (${q.count}×)`),
          )}<p style="margin:6px 0 0;font-size:12px;color:#64748b">Add these to the knowledge base and the agent answers them next week.</p>`,
        )
      : ''
  }

  ${d.competitors.length ? section('Who they mentioned', list(d.competitors.map((c: any) => `${c.name} — ${c.count}×`))) : ''}

  ${
    d.justPromoted
      ? section(
          'Script test',
          `<p style="margin:6px 0 0;font-size:14px;color:#0f172a">&ldquo;${esc(
            d.justPromoted.name,
          )}&rdquo; finished. Variant <strong>${d.justPromoted.winnerKey?.toUpperCase()}</strong> won by <strong>${
            d.justPromoted.winnerLiftPoints
          } points</strong> and is now live.</p>`,
        )
      : d.running
        ? section(
            'Script test',
            `<p style="margin:6px 0 0;font-size:14px;color:#0f172a">&ldquo;${esc(d.running.name)}&rdquo; is running. ${
              d.running.callsToGo
                ? `${d.running.callsToGo} more answered calls before a winner can be called.`
                : 'Enough calls collected — a winner is being decided.'
            }</p>`,
          )
        : ''
  }

  ${
    d.coaching.length
      ? section('Fix these three first', list(d.coaching.map((c: any) => `${c.lead}: ${c.line}`)))
      : ''
  }

  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    Written automatically from ${h.reviewed} reviewed calls. Open Revenue Brain in your dashboard for the full detail.
  </p>
</div></body></html>`;
  }

  private renderWhatsApp(d: any): string {
    const h = d.headline;
    const lines = [
      `*${d.workspace}* — this week`,
      '',
      `${h.reviewed} calls reviewed · ${h.meetingRate}% booked a meeting (${d.arrow(h.delta.meetingRate)} pts)`,
      `Call quality ${h.avgScore}/100 (${d.arrow(h.delta.avgScore)} pts)`,
    ];
    if (d.biggestLeak) lines.push('', `Biggest leak: ${d.biggestLeak.label} — ${d.biggestLeak.share}% of calls`);
    if (d.weakest) lines.push(`Weakest: ${d.weakest.label.toLowerCase()} on only ${d.weakest.passRate}% of calls`);
    if (d.justPromoted) {
      lines.push('', `Script test won by variant ${d.justPromoted.winnerKey?.toUpperCase()} (+${d.justPromoted.winnerLiftPoints} pts) — now live.`);
    }
    if (d.coaching.length) lines.push('', `Fix first: ${d.coaching[0].line}`);
    return lines.join('\n').slice(0, 1500);
  }
}

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
