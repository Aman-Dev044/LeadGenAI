import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendProvider } from './resend.provider';
import { SmtpProvider } from './smtp.provider';
import { TenantEmailProvider } from './tenant-email.provider';

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/**
 * Every e-mail goes through TenantEmailProvider:
 *  - the workspace saved its own SMTP server -> sent from their address
 *  - otherwise the platform's provider:
 *      EMAIL_PROVIDER=smtp   -> SmtpProvider (SMTP_HOST/PORT/USER/PASS)
 *      EMAIL_PROVIDER=resend -> ResendProvider (RESEND_API_KEY)
 *      unset: smtp when SMTP_HOST is configured, otherwise resend.
 */
@Global()
@Module({
  providers: [
    ResendProvider,
    SmtpProvider,
    TenantEmailProvider,
    { provide: EMAIL_PROVIDER, useExisting: TenantEmailProvider },
  ],
  exports: [EMAIL_PROVIDER, ResendProvider, SmtpProvider, TenantEmailProvider],
})
export class EmailModule {}
