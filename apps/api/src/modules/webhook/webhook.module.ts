import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookSchema } from '../../schemas/webhook.schema';
import { WebhookLogSchema } from '../../schemas/webhook-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Webhook', schema: WebhookSchema },
      { name: 'WebhookLog', schema: WebhookLogSchema },
    ]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookDispatcherService],
  exports: [WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}
