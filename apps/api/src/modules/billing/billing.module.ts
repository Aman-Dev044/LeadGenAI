import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { SubscriptionSchema } from '../../schemas/subscription.schema';
import { InvoiceSchema } from '../../schemas/invoice.schema';
import { UsageRecordSchema } from '../../schemas/usage-record.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { MessageSchema } from '../../schemas/message.schema';
import { KnowledgeSourceSchema } from '../../schemas/knowledge-source.schema';
import { NotificationSchema } from '../../schemas/notification.schema';
import { UserSchema } from '../../schemas/user.schema';
import { NotificationModule } from '../notification/notification.module';
import { PlanExpiryReminderService } from './plan-expiry-reminder.service';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import { PlansController } from './plans.controller';
import { CallLogSchema } from '../../schemas/call-log.schema';

// Global so the subscription lock (SubscriptionGuard) and the calling engine
// can read a workspace's entitlement without importing billing everywhere
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Subscription', schema: SubscriptionSchema },
      { name: 'Invoice', schema: InvoiceSchema },
      { name: 'UsageRecord', schema: UsageRecordSchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'KnowledgeSource', schema: KnowledgeSourceSchema },
      { name: 'Notification', schema: NotificationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'CallLog', schema: CallLogSchema },
    ]),
    NotificationModule,
  ],
  controllers: [BillingController, PlansController],
  providers: [BillingService, UsageMeterService, PlanExpiryReminderService, SubscriptionService, RazorpayService],
  exports: [BillingService, UsageMeterService, PlanExpiryReminderService, SubscriptionService, RazorpayService],
})
export class BillingModule {}
