import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SlackChannel {
  private readonly logger = new Logger(SlackChannel.name);

  constructor(private readonly configService: ConfigService) {}

  async send(notification: any, webhookUrl?: string): Promise<boolean> {
    const url = webhookUrl || this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (!url) {
      this.logger.warn('Slack webhook URL not configured');
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${notification.title}*\n${notification.body || ''}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${notification.title}*\n${notification.body || ''}`,
              },
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Slack notification failed: ${error.message}`);
      return false;
    }
  }
}
