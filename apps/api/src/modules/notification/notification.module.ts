import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { EmailChannel } from './channels/email-channel';
import { InAppChannel } from './channels/in-app-channel';
import { SlackChannel } from './channels/slack-channel';
import { SmsChannel } from './channels/sms-channel';
import { WhatsAppChannel } from './channels/whatsapp-channel';
import { TeamsChannel } from './channels/teams-channel';
import { PushChannel } from './channels/push-channel';
import { NotificationSchema } from '../../schemas/notification.schema';
import { UserSchema } from '../../schemas/user.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Notification', schema: NotificationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Tenant', schema: TenantSchema },
    ]),
    GatewayModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailChannel,
    InAppChannel,
    SlackChannel,
    SmsChannel,
    WhatsAppChannel,
    TeamsChannel,
    PushChannel,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
