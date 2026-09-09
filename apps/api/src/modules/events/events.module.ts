import { Module } from '@nestjs/common';
import { EventsListenerService } from './events-listener.service';
import { WebhookModule } from '../webhook/webhook.module';
import { NotificationModule } from '../notification/notification.module';
import { LeadScoreModule } from '../lead-score/lead-score.module';
import { GatewayModule } from '../../gateways/gateway.module';

/**
 * Subscribes to platform events and fans them out to webhooks, notifications,
 * realtime sockets and lead scoring. Domain modules never import this module;
 * they only emit on the global EventBus, so there are no circular imports.
 */
@Module({
  imports: [WebhookModule, NotificationModule, LeadScoreModule, GatewayModule],
  providers: [EventsListenerService],
})
export class EventsModule {}
