import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../common/interfaces';

@Injectable()
export class ResendProvider implements IEmailProvider {
  private readonly client: Resend;
  private readonly logger = new Logger(ResendProvider.name);
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    if (!apiKey) {
      this.logger.warn('Resend API key not configured - emails will not be sent');
    }
    this.client = new Resend(apiKey || 'missing_key');
    this.defaultFrom = this.configService.get<string>('email.from') || 'noreply@example.com';
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const response = await this.client.emails.send({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html || '',
        text: options.text,
        reply_to: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content as any,
          content_type: a.contentType,
        })),
      } as any);

      return {
        messageId: response.data?.id || '',
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return {
        messageId: '',
        success: false,
      };
    }
  }
}
