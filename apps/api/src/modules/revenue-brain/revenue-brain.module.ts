import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallLogSchema } from '../../schemas/call-log.schema';
import { CallReviewSchema } from '../../schemas/call-review.schema';
import { LeadSchema } from '../../schemas/lead.schema';
import { ScriptExperimentSchema } from '../../schemas/script-experiment.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { CallQaService } from './call-qa.service';
import { DigestService } from './digest.service';
import { ExperimentService } from './experiment.service';
import { InsightsService } from './insights.service';
import { RevenueBrainController } from './revenue-brain.controller';

/**
 * Revenue Brain - the loop that makes the calling agent better each week.
 *
 * Global so CallingService can ask ExperimentService which script variant a
 * call should run without the two modules importing each other. Nothing here
 * depends on CallingService, so there is no cycle: this module only reads the
 * call log it finds, and writes its own collections.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CallLog', schema: CallLogSchema },
      { name: 'CallReview', schema: CallReviewSchema },
      { name: 'ScriptExperiment', schema: ScriptExperimentSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
    ]),
    WhatsAppModule,
  ],
  controllers: [RevenueBrainController],
  providers: [CallQaService, ExperimentService, InsightsService, DigestService],
  exports: [CallQaService, ExperimentService, InsightsService, DigestService],
})
export class RevenueBrainModule {}
