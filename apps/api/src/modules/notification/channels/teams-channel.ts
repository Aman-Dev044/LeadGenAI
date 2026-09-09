import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TeamsChannel {
  private readonly logger = new Logger(TeamsChannel.name);

  constructor(private readonly configService: ConfigService) {}

  async send(notification: any, webhookUrl?: string): Promise<boolean> {
    const url = webhookUrl || this.configService.get<string>('TEAMS_WEBHOOK_URL');
    if (!url) {
      this.logger.warn('Microsoft Teams webhook URL not configured');
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: '4F46E5',
          summary: notification.title,
          sections: [
            {
              activityTitle: notification.title,
              activitySubtitle: new Date().toISOString(),
              text: notification.body || '',
              markdown: true,
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Teams notification failed: ${error.message}`);
      return false;
    }
  }
}
