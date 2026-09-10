import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { GatewayModule } from '../../gateways/gateway.module';
import {
  TenantSchema,
  UserSchema,
  RefreshTokenSchema,
  LeadSchema,
  ConversationSchema,
  MessageSchema,
  AgentSchema,
  AppointmentSchema,
  SupportTicketSchema,
  KnowledgeSourceSchema,
  AuditLogSchema,
  NotificationSchema,
} from '../../schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'RefreshToken', schema: RefreshTokenSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Agent', schema: AgentSchema },
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'SupportTicket', schema: SupportTicketSchema },
      { name: 'KnowledgeSource', schema: KnowledgeSourceSchema },
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'Notification', schema: NotificationSchema },
    ]),
    AuthModule,
    NotificationModule,
    GatewayModule,
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
