import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsService } from '../../credentials/credentials.service';

export type WhatsAppTemplateKey = 'thank_you' | 'appointment' | 'callback' | 'missed_call' | 'reengage';

@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  /**
   * The workspace's own Twilio account when it saved one, the platform's
   * otherwise. `tenantId` is optional so existing callers keep working.
   */
  private async twilioSettings(tenantId?: string) {
    const own = tenantId ? await this.credentials.resolve(tenantId, 'twilio') : {};
    return {
      accountSid: own.accountSid || this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      authToken: own.authToken || this.configService.get<string>('TWILIO_AUTH_TOKEN'),
      phoneNumber: own.phoneNumber || this.configService.get<string>('TWILIO_PHONE_NUMBER'),
      whatsappNumber:
        own.whatsappNumber || this.configService.get<string>('TWILIO_WHATSAPP_NUMBER'),
    };
  }

  /** Approved template SIDs for one workspace (tenant override, else platform env). */
  async templates(tenantId?: string): Promise<Record<WhatsAppTemplateKey, string | undefined>> {
    const own = tenantId ? await this.credentials.resolve(tenantId, 'twilio') : {};
    const env = (k: string) => this.configService.get<string>(k) || undefined;
    return {
      thank_you: own.tplThankYou || env('WHATSAPP_TPL_THANK_YOU'),
      appointment: own.tplAppointment || env('WHATSAPP_TPL_APPOINTMENT'),
      callback: own.tplCallback || env('WHATSAPP_TPL_CALLBACK'),
      missed_call: own.tplMissedCall || env('WHATSAPP_TPL_MISSED_CALL'),
      reengage: own.tplReengage || env('WHATSAPP_TPL_REENGAGE'),
    };
  }

  async send(notification: any, phoneNumber: string): Promise<boolean> {
    if (!phoneNumber) {
      this.logger.warn('No phone number provided for WhatsApp notification');
      return false;
    }

    // Uses Twilio WhatsApp API - the workspace's own account when it saved one
    const { accountSid, authToken, whatsappNumber: fromNumber } = await this.twilioSettings(
      notification?.tenantId,
    );

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('WhatsApp provider not configured');
      return false;
    }

    // Clean and normalize phone numbers
    const cleanFrom = fromNumber.replace(/^whatsapp:/i, '').replace(/[\s\-()]/g, '').trim();
    let cleanTo = phoneNumber.replace(/^whatsapp:/i, '').replace(/[\s\-()]/g, '').trim();
    if (!cleanTo.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }
    const finalFrom = cleanFrom.startsWith('+') ? cleanFrom : `+${cleanFrom}`;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: `whatsapp:${cleanTo}`,
        From: `whatsapp:${finalFrom}`,
      });
      // WhatsApp only accepts free text inside a 24h window after the lead
      // wrote to us. Everything we start ourselves goes as an approved template
      // (`data.template` = { sid, variables }); the body is kept as the record.
      const tpl = notification?.data?.template;
      if (tpl?.sid) {
        body.set('ContentSid', tpl.sid);
        body.set('ContentVariables', JSON.stringify(tpl.variables || {}));
      } else {
        body.set('Body', notification.title ? `*${notification.title}*\n${notification.body || ''}` : notification.body || '');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`WhatsApp send failed (${response.status}): ${errorData}`);
        return false;
      }

      const result = await response.json().catch(() => ({}));
      this.logger.log(`WhatsApp message sent successfully via Twilio (SID: ${result.sid || 'ok'}) to ${cleanTo}`);
      return true;
    } catch (error: any) {
      this.logger.error(`WhatsApp notification failed: ${error.message}`);
      return false;
    }
  }
}
