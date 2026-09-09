import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadScoreController } from './lead-score.controller';
import { LeadScoreService } from './lead-score.service';
import { ScoringRuleSchema } from '../../schemas/scoring-rule.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { MessageSchema } from '../../schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ScoringRule', schema: ScoringRuleSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
    ]),
  ],
  controllers: [LeadScoreController],
  providers: [LeadScoreService],
  exports: [LeadScoreService],
})
export class LeadScoreModule {}
