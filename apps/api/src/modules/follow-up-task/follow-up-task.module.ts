import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FollowUpTaskController } from './follow-up-task.controller';
import { FollowUpTaskService } from './follow-up-task.service';
import { FollowUpTaskScheduler } from './follow-up-task.scheduler';
import { FollowUpTaskSchema } from '../../schemas/follow-up-task.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'FollowUpTask', schema: FollowUpTaskSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
    ]),
    NotificationModule,
  ],
  controllers: [FollowUpTaskController],
  providers: [FollowUpTaskService, FollowUpTaskScheduler],
  exports: [FollowUpTaskService],
})
export class FollowUpTaskModule {}
