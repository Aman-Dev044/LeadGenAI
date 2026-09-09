import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    @InjectModel('Webhook') private readonly webhookModel: Model<any>,
    @InjectModel('WebhookLog') private readonly webhookLogModel: Model<any>,
  ) {}

  async dispatch(tenantId: string, event: string, data: any) {
    const webhooks = await this.webhookModel.find({
      tenantId,
      isActive: true,
      events: event,
    });

    for (const webhook of webhooks) {
      this.deliverWebhook(webhook, event, data).catch((err) => {
        this.logger.error(`Webhook delivery failed: ${err.message}`);
      });
    }
  }

  private async deliverWebhook(webhook: any, event: string, data: any) {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = this.generateSignature(payload, webhook.secret);
    const deliveryId = crypto.randomUUID();
    const maxRetries = webhook.config?.retryCount || 3;
    const timeoutMs = webhook.config?.timeoutMs || 10000;

    let lastError: string | undefined;
    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': webhook.config?.contentType || 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': event,
            'X-Webhook-Delivery': deliveryId,
          },
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = response.status;
        responseBody = await response.text();

        if (response.ok) {
          success = true;

          await this.webhookLogModel.create({
            tenantId: webhook.tenantId,
            webhookId: webhook._id.toString(),
            event,
            payload: data,
            statusCode,
            responseBody: responseBody.substring(0, 1000),
            status: 'success',
            attemptNumber: attempt,
            duration: Date.now() - startTime,
          });

          // Update webhook stats
          webhook.lastTriggeredAt = new Date();
          webhook.failureCount = 0;
          await webhook.save();

          break;
        }

        lastError = `HTTP ${statusCode}: ${responseBody.substring(0, 200)}`;
      } catch (error: any) {
        lastError = error.name === 'AbortError' ? 'Request timeout' : error.message;
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.pow(10, attempt) * 1000; // 10s, 100s
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 60000)));
      }
    }

    if (!success) {
      await this.webhookLogModel.create({
        tenantId: webhook.tenantId,
        webhookId: webhook._id.toString(),
        event,
        payload: data,
        statusCode,
        responseBody: responseBody?.substring(0, 1000),
        status: 'failed',
        attemptNumber: maxRetries,
        errorMessage: lastError,
        duration: 0,
      });

      webhook.failureCount = (webhook.failureCount || 0) + 1;
      webhook.lastTriggeredAt = new Date();

      // Auto-disable after 10 consecutive failures
      if (webhook.failureCount >= 10) {
        webhook.isActive = false;
        this.logger.warn(`Webhook ${webhook._id} disabled after ${webhook.failureCount} failures`);
      }

      await webhook.save();
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}
