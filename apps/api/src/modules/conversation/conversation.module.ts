import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { AgentSchema } from '../../schemas/agent.schema';
import { HandoffSchema } from '../../schemas/handoff.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { AppointmentSchema } from '../../schemas/appointment.schema';
import { UserSchema } from '../../schemas/user.schema';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { SupportTicketModule } from '../support-ticket/support-ticket.module';
import { NotificationModule } from '../notification/notification.module';
import { LeadModule } from '../lead/lead.module';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Agent', schema: AgentSchema },
      { name: 'Handoff', schema: HandoffSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'User', schema: UserSchema },
    ]),
    KnowledgeBaseModule,
    AppointmentModule,
    SupportTicketModule,
    forwardRef(() => NotificationModule),
    LeadModule,
    GatewayModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
