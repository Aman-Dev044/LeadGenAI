import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(private readonly configService: ConfigService) {}

  async send(notification: any, phoneNumber: string): Promise<boolean> {
    if (!phoneNumber) {
      this.logger.warn('No phone number provided for WhatsApp notification');
      return false;
    }

    // Uses Twilio WhatsApp API (or Meta WhatsApp Business API)
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER');

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
        Body: `*${notification.title}*\n${notification.body || ''}`,
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
