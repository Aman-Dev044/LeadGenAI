import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { AssignmentService } from './assignment.service';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { UserSchema } from '../../schemas/user.schema';
import { TenantSchema } from '../../schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Tenant', schema: TenantSchema },
    ]),
  ],
  controllers: [LeadController],
  providers: [LeadService, AssignmentService],
  exports: [LeadService, AssignmentService],
})
export class LeadModule {}
