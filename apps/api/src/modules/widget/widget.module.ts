import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LeadModule } from '../lead/lead.module';
import { VisitorTrackingModule } from '../visitor-tracking/visitor-tracking.module';

@Module({
  imports: [AgentModule, ConversationModule, LeadModule, VisitorTrackingModule],
  controllers: [WidgetController],
})
export class WidgetModule {}
