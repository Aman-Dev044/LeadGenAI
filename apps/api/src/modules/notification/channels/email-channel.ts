import { Injectable, Inject } from '@nestjs/common';
import { IEmailProvider } from '../../../common/interfaces';
import { EMAIL_PROVIDER } from '../../../providers/email/email.module';

@Injectable()
export class EmailChannel {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  async send(notification: any, recipientEmail: string): Promise<boolean> {
    const result = await this.emailProvider.sendEmail({
      to: recipientEmail,
      subject: notification.title,
      html: this.buildHtml(notification),
    });
    return result.success;
  }

  private buildHtml(notification: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${notification.title}</h2>
        ${notification.body ? `<p style="color: #666;">${notification.body}</p>` : ''}
        <hr style="border: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from your AI Lead Generation platform.
        </p>
      </div>
    `;
  }
}
