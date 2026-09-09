import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendProvider } from './resend.provider';
import { SmtpProvider } from './smtp.provider';

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/**
 * EMAIL_PROVIDER=smtp   -> SmtpProvider (SMTP_HOST/PORT/USER/PASS)
 * EMAIL_PROVIDER=resend -> ResendProvider (RESEND_API_KEY)
 * Unset: smtp when SMTP_HOST is configured, otherwise resend.
 */
@Global()
@Module({
  providers: [
    ResendProvider,
    SmtpProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, SmtpProvider, ResendProvider],
      useFactory: (config: ConfigService, smtp: SmtpProvider, resend: ResendProvider) => {
        const configured = (config.get<string>('email.provider') || '').toLowerCase();
        if (configured === 'smtp') return smtp;
        if (configured === 'resend') return resend;
        return config.get<string>('email.smtp.host') ? smtp : resend;
      },
    },
  ],
  exports: [EMAIL_PROVIDER, ResendProvider, SmtpProvider],
})
export class EmailModule {}
