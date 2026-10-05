import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { CredentialsService } from '../credentials/credentials.service';

export interface TwilioWhatsAppCreds {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
}

export interface SendResult {
  ok: boolean;
  sid?: string;
  error?: string;
  code?: number;
}

/**
 * Thin Twilio WhatsApp client for the conversation engine: free-form text
 * and media inside the 24h customer window (the customer just wrote to us,
 * so no template is needed), media download for incoming pictures, webhook
 * signature checks and the sender's webhook configuration.
 */
@Injectable()
export class TwilioWhatsAppSender {
  private readonly logger = new Logger(TwilioWhatsAppSender.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  async creds(tenantId: string): Promise<TwilioWhatsAppCreds> {
    const own = await this.credentials.resolve(tenantId, 'twilio').catch(() => ({} as Record<string, string>));
    return {
      accountSid: own.accountSid || this.configService.get<string>('TWILIO_ACCOUNT_SID') || '',
      authToken: own.authToken || this.configService.get<string>('TWILIO_AUTH_TOKEN') || '',
      whatsappNumber: (own.whatsappNumber || this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || '').replace(/^whatsapp:/i, ''),
    };
  }

  static normalise(phone: string): string {
    const digits = String(phone || '').replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
    if (!digits) return '';
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  /** One WhatsApp message: text, or one media file with the text as caption. */
  async send(tenantId: string, to: string, body: string, mediaUrl?: string): Promise<SendResult> {
    const c = await this.creds(tenantId);
    if (!c.accountSid || !c.authToken || !c.whatsappNumber) return { ok: false, error: 'Twilio WhatsApp is not configured' };
    const toNum = TwilioWhatsAppSender.normalise(to);
    if (!toNum) return { ok: false, error: 'Invalid destination number' };

    const params = new URLSearchParams({
      To: `whatsapp:${toNum}`,
      From: `whatsapp:${TwilioWhatsAppSender.normalise(c.whatsappNumber)}`,
    });
    if (body) params.set('Body', body.slice(0, 1600));
    if (mediaUrl) params.set('MediaUrl', mediaUrl);
    const statusUrl = this.statusCallbackUrl(tenantId);
    if (statusUrl) params.set('StatusCallback', statusUrl);

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.warn(`WhatsApp send failed (${res.status}): ${json.message || json.error_message || 'unknown'}`);
        return { ok: false, error: json.message || `HTTP ${res.status}`, code: json.code };
      }
      return { ok: true, sid: json.sid };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }

  /** Download a picture / file the customer sent (Twilio media URLs need basic auth). */
  async downloadMedia(tenantId: string, url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const c = await this.creds(tenantId);
    try {
      // Twilio's media store needs the account's basic auth; other hosts (tests, forwarded links) must not see it
      const isTwilio = /(^|\.)twilio\.com$/i.test(new URL(url).hostname);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'LeadBells/1.0 (+https://leadbells.com)',
          ...(isTwilio ? { Authorization: `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}` } : {}),
        },
        redirect: 'follow',
      });
      if (!res.ok) {
        this.logger.warn(`Twilio media download failed (${res.status}) for ${url}`);
        return null;
      }
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 16 * 1024 * 1024) return null;
      return { buffer, contentType };
    } catch (err: any) {
      this.logger.warn(`Twilio media download error: ${err?.message}`);
      return null;
    }
  }

  // ─── Webhook URLs + signature ─────────────────────────────────────

  private publicBase(): string {
    const base = (this.configService.get<string>('app.publicApiUrl') || 'http://localhost:4000').replace(/\/+$/, '');
    const prefix = (this.configService.get<string>('app.prefix') || '/api/v1').replace(/\/+$/, '');
    return `${base}${prefix}`;
  }

  inboundUrl(tenantId: string): string {
    return `${this.publicBase()}/whatsapp/twilio/inbound/${tenantId}`;
  }

  statusCallbackUrl(tenantId: string): string {
    return `${this.publicBase()}/whatsapp/twilio/status/${tenantId}`;
  }

  /**
   * Twilio signs every webhook: base64(HMAC-SHA1(authToken, url + sorted form
   * params)). The URL must be exactly what Twilio called, so both the
   * configured public URL and the one reconstructed from the request are tried.
   */
  async verifySignature(tenantId: string, signature: string | undefined, candidateUrls: string[], params: Record<string, any>): Promise<boolean> {
    if (process.env.WHATSAPP_VERIFY_SIGNATURE === 'false') return true;
    if (!signature) return false;
    const c = await this.creds(tenantId);
    if (!c.authToken) return false;
    const sorted = Object.keys(params || {})
      .sort()
      .map((k) => `${k}${Array.isArray(params[k]) ? params[k].join('') : params[k] ?? ''}`)
      .join('');
    for (const url of candidateUrls.filter(Boolean)) {
      const expected = createHmac('sha1', c.authToken).update(url + sorted).digest('base64');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
  }

  /** Point the WhatsApp sender's "message comes in" webhook at this API (Twilio Senders API v2). */
  async configureSenderWebhook(tenantId: string): Promise<{ ok: boolean; message: string; sid?: string }> {
    const c = await this.creds(tenantId);
    if (!c.accountSid || !c.authToken || !c.whatsappNumber) return { ok: false, message: 'Twilio WhatsApp is not configured' };
    const auth = `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`;
    const want = `whatsapp:${TwilioWhatsAppSender.normalise(c.whatsappNumber)}`;
    try {
      const list: any = await fetch('https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp', { headers: { Authorization: auth } }).then((r) => r.json());
      const sender = (list.senders || []).find((s: any) => s.sender_id === want);
      if (!sender) return { ok: false, message: `No WhatsApp sender ${want} found in this Twilio account` };
      const res = await fetch(`https://messaging.twilio.com/v2/Channels/Senders/${sender.sid}`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook: {
            callback_url: this.inboundUrl(tenantId),
            callback_method: 'POST',
            status_callback_url: this.statusCallbackUrl(tenantId),
            status_callback_method: 'POST',
          },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: json.message || `HTTP ${res.status}`, sid: sender.sid };
      return { ok: true, message: `Webhook set on ${want}`, sid: sender.sid };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Twilio request failed' };
    }
  }

  async senderStatus(tenantId: string): Promise<{ configured: boolean; number: string; online?: boolean; webhookUrl?: string; webhookMatches?: boolean }> {
    const c = await this.creds(tenantId);
    const out = { configured: !!(c.accountSid && c.authToken && c.whatsappNumber), number: c.whatsappNumber };
    if (!out.configured) return out;
    try {
      const auth = `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`;
      const list: any = await fetch('https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp', { headers: { Authorization: auth } }).then((r) => r.json());
      const want = `whatsapp:${TwilioWhatsAppSender.normalise(c.whatsappNumber)}`;
      const sender = (list.senders || []).find((s: any) => s.sender_id === want);
      if (!sender) return out;
      return {
        ...out,
        online: sender.status === 'ONLINE',
        webhookUrl: sender.webhook?.callback_url || '',
        webhookMatches: (sender.webhook?.callback_url || '') === this.inboundUrl(tenantId),
      };
    } catch {
      return out;
    }
  }
}
