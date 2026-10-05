import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { TwilioWhatsAppSender } from './twilio-whatsapp.sender';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { CallLogSchema } from '../../schemas/call-log.schema';
import { AppointmentSchema } from '../../schemas/appointment.schema';
import { FollowUpTaskSchema } from '../../schemas/follow-up-task.schema';
import { WhatsAppMediaSchema } from '../../schemas/whatsapp-media.schema';
import { BookingRequestSchema } from '../../schemas/booking-request.schema';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { FollowUpTaskModule } from '../follow-up-task/follow-up-task.module';
import { NotificationModule } from '../notification/notification.module';
import { CallingModule } from '../calling/calling.module';
import { GatewayModule } from '../../gateways/gateway.module';

/**
 * Two-way WhatsApp AI (Twilio): inbound webhook, AI replies with vision,
 * media library, booking forms + payment links, human take-over.
 * Must not import ConversationModule (that one imports this to deliver
 * teammates' replies on WhatsApp).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'CallLog', schema: CallLogSchema },
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'FollowUpTask', schema: FollowUpTaskSchema },
      { name: 'WhatsAppMedia', schema: WhatsAppMediaSchema },
      { name: 'BookingRequest', schema: BookingRequestSchema },
    ]),
    KnowledgeBaseModule,
    AppointmentModule,
    FollowUpTaskModule,
    NotificationModule,
    CallingModule,
    GatewayModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppAiService, TwilioWhatsAppSender],
  exports: [WhatsAppAiService, TwilioWhatsAppSender],
})
export class WhatsAppModule {}
