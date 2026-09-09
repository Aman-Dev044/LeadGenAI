import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';
import { HandoffSchema } from '../../schemas/handoff.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Handoff', schema: HandoffSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  controllers: [HandoffController],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
