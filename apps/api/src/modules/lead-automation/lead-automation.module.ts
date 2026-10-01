import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadAutomationController } from './lead-automation.controller';
import { LeadAutomationService } from './lead-automation.service';
import { LeadAutomationScheduler } from './lead-automation.scheduler';
import { AiQualifierService } from './ai-qualifier.service';
import { GooglePlacesProvider } from './providers/google-places.provider';
import { LeadSourceRegistry } from './providers/lead-source.registry';
import { ScrapingCampaignSchema } from '../../schemas/scraping-campaign.schema';
import { ScrapedLeadSchema } from '../../schemas/scraped-lead.schema';
import { ScrapingRunSchema } from '../../schemas/scraping-run.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { LeadModule } from '../lead/lead.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ScrapingCampaign', schema: ScrapingCampaignSchema },
      { name: 'ScrapedLead', schema: ScrapedLeadSchema },
      { name: 'ScrapingRun', schema: ScrapingRunSchema },
      { name: 'Tenant', schema: TenantSchema },
    ]),
    LeadModule,
    NotificationModule,
  ],
  controllers: [LeadAutomationController],
  providers: [
    LeadAutomationService,
    LeadAutomationScheduler,
    AiQualifierService,
    GooglePlacesProvider,
    LeadSourceRegistry,
  ],
  exports: [LeadAutomationService],
})
export class LeadAutomationModule {}
