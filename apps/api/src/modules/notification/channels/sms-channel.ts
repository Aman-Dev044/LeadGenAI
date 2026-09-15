import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly configService: ConfigService) {}

  async send(notification: any, phoneNumber: string): Promise<boolean> {
    if (!phoneNumber) {
      this.logger.warn('No phone number provided for SMS notification');
      return false;
    }

    const provider = this.configService.get<string>('SMS_PROVIDER') || 'twilio';
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('SMS provider (Twilio) not configured');
      return false;
    }

    const cleanFrom = fromNumber.replace(/^whatsapp:/i, '').replace(/[\s\-()]/g, '').trim();
    let cleanTo = phoneNumber.replace(/^whatsapp:/i, '').replace(/[\s\-()]/g, '').trim();
    if (!cleanTo.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }
    const finalFrom = cleanFrom.startsWith('+') ? cleanFrom : `+${cleanFrom}`;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: cleanTo,
        From: finalFrom,
        Body: `${notification.title}\n${notification.body || ''}`,
      });

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
        this.logger.error(`SMS send failed (${response.status}): ${errorData}`);
        return false;
      }

      const result = await response.json().catch(() => ({}));
      this.logger.log(`SMS sent successfully via Twilio (SID: ${result.sid || 'ok'}) to ${cleanTo}`);
      return true;
    } catch (error: any) {
      this.logger.error(`SMS notification failed: ${error.message}`);
      return false;
    }
  }
}
