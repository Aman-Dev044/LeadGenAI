import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LeadSchema } from '../../schemas/lead.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { AgentSchema } from '../../schemas/agent.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { UserSchema } from '../../schemas/user.schema';
import { AppointmentSchema } from '../../schemas/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Lead', schema: LeadSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Agent', schema: AgentSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Appointment', schema: AppointmentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
