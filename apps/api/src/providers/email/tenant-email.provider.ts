import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOptions, EmailResult, IEmailProvider } from '../../common/interfaces';
import { CredentialsService } from '../../modules/credentials/credentials.service';
import { SmtpProvider } from './smtp.provider';
import { ResendProvider } from './resend.provider';

/**
 * Picks who actually sends an e-mail.
 *
 * A workspace that saved its own SMTP server (Settings > Organization >
 * Email sending) sends everything from its own address - lead alerts,
 * appointment confirmations, post-call summaries, verification codes. Every
 * other workspace falls back to the platform's provider.
 *
 * `tenantId` on the options is what makes that possible, so callers that know
 * which workspace an e-mail belongs to must pass it.
 */
@Injectable()
export class TenantEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(TenantEmailProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
    private readonly smtp: SmtpProvider,
    private readonly resend: ResendProvider,
  ) {}

  /** The platform's own provider, as configured by EMAIL_PROVIDER / SMTP_HOST. */
  private platform(): IEmailProvider {
    const configured = (this.configService.get<string>('email.provider') || '').toLowerCase();
    if (configured === 'smtp') return this.smtp;
    if (configured === 'resend') return this.resend;
    return this.configService.get<string>('email.smtp.host') ? this.smtp : this.resend;
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const tenantId = options.tenantId;
    if (tenantId && tenantId !== 'all') {
      try {
        const creds = await this.credentials.resolve(tenantId, 'smtp');
        // Only a host the workspace itself saved counts - `resolve` also returns
        // the platform's env fallback, which the platform provider handles anyway.
        const own = await this.credentials.hasOwnValue(tenantId, 'smtp', 'host');
        if (own && creds.host) return this.smtp.sendEmail(options);
      } catch (err: any) {
        this.logger.warn(`Could not resolve SMTP for tenant ${tenantId}: ${err?.message}`);
      }
    }
    return this.platform().sendEmail(options);
  }
}
