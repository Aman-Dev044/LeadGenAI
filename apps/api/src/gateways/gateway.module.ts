import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat.gateway';
import { NotificationGateway } from './notification.gateway';
import { NotificationSchema } from '../schemas/notification.schema';
import { ConversationSchema } from '../schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Notification', schema: NotificationSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  providers: [ChatGateway, NotificationGateway],
  exports: [ChatGateway, NotificationGateway],
})
export class GatewayModule {}
