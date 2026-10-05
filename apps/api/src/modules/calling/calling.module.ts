import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallingController } from './calling.controller';
import { CallingWebhookController } from './calling-webhook.controller';
import { CallingService } from './calling.service';
import { CallingScheduler } from './calling.scheduler';
import { CallAnalysisService } from './call-analysis.service';
import { VapiProvider } from './providers/vapi.provider';
import { TwilioVoiceProvider } from './providers/twilio-voice.provider';
import { CallLogSchema } from '../../schemas/call-log.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { FollowUpTaskSchema } from '../../schemas/follow-up-task.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { LeadModule } from '../lead/lead.module';
import { NotificationModule } from '../notification/notification.module';
import { FollowUpTaskModule } from '../follow-up-task/follow-up-task.module';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CallLog', schema: CallLogSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'FollowUpTask', schema: FollowUpTaskSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
    ]),
    LeadModule,
    NotificationModule,
    FollowUpTaskModule,
    AppointmentModule,
  ],
  controllers: [CallingController, CallingWebhookController],
  providers: [CallingService, CallingScheduler, CallAnalysisService, VapiProvider, TwilioVoiceProvider],
  exports: [CallingService],
})
export class CallingModule {}
