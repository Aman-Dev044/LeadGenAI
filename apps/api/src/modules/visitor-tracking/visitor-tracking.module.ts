import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitorTrackingController } from './visitor-tracking.controller';
import { VisitorTrackingService } from './visitor-tracking.service';
import { PageViewSchema } from '../../schemas/page-view.schema';
import { AgentSchema } from '../../schemas/agent.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PageView', schema: PageViewSchema },
      { name: 'Agent', schema: AgentSchema },
    ]),
  ],
  controllers: [VisitorTrackingController],
  providers: [VisitorTrackingService],
  exports: [VisitorTrackingService],
})
export class VisitorTrackingModule {}
