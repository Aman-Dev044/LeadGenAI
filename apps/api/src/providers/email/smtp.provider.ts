import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IEmailProvider, EmailOptions, EmailResult } from '../../common/interfaces';

/**
 * SMTP email provider (Gmail, Outlook, Zoho, Amazon SES SMTP, any relay).
 * Configured via SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS
 * and EMAIL_FROM / EMAIL_FROM_NAME.
 */
@Injectable()
export class SmtpProvider implements IEmailProvider {
  private readonly logger = new Logger(SmtpProvider.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('email.smtp.host');
    const port = this.configService.get<number>('email.smtp.port') || 587;
    const secure = this.configService.get<boolean>('email.smtp.secure') ?? port === 465;
    const user = this.configService.get<string>('email.smtp.user');
    const pass = this.configService.get<string>('email.smtp.pass');

    const fromName = this.configService.get<string>('email.fromName') || 'AI Lead Gen';
    const fromAddress = this.configService.get<string>('email.from') || user || 'noreply@example.com';
    this.defaultFrom = `"${fromName.replace(/"/g, '')}" <${fromAddress}>`;

    if (!host) {
      this.logger.warn('SMTP_HOST not configured - emails will not be sent');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      tls: { rejectUnauthorized: this.configService.get<boolean>('email.smtp.rejectUnauthorized') ?? true },
    });

    this.transporter
      .verify()
      .then(() => this.logger.log(`SMTP ready: ${host}:${port} (${secure ? 'TLS' : 'STARTTLS/plain'})`))
      .catch((err) => this.logger.warn(`SMTP verification failed: ${err.message} - emails may not be delivered`));
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      this.logger.warn(`Email to ${options.to} skipped - SMTP not configured`);
      return { messageId: '', success: false };
    }

    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || (options.html ? options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined),
        replyTo: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      this.logger.log(`Email sent to ${options.to} (${info.messageId})`);
      return { messageId: info.messageId || '', success: true };
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      return { messageId: '', success: false };
    }
  }
}
