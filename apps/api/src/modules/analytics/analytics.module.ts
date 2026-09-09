import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { LeadSchema } from '../../schemas/lead.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { AgentSchema } from '../../schemas/agent.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { PageViewSchema } from '../../schemas/page-view.schema';
import { HandoffSchema } from '../../schemas/handoff.schema';
import { AppointmentSchema } from '../../schemas/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Lead', schema: LeadSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Agent', schema: AgentSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'PageView', schema: PageViewSchema },
      { name: 'Handoff', schema: HandoffSchema },
      { name: 'Appointment', schema: AppointmentSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
