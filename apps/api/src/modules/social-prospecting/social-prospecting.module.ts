import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialProspectingController } from './social-prospecting.controller';
import { SocialProspectingService } from './social-prospecting.service';
import { SocialProspectingScheduler } from './social-prospecting.scheduler';
import { SocialQualifierService } from './social-qualifier.service';
import { HackerNewsProvider } from './providers/hackernews.provider';
import { RedditProvider } from './providers/reddit.provider';
import { QuoraSerpProvider, SerpProvider } from './providers/serp.provider';
import { TendersProvider } from './providers/tenders.provider';
import { BlueskyProvider } from './providers/bluesky.provider';
import { StackExchangeProvider } from './providers/stackexchange.provider';
import { GitHubProvider } from './providers/github.provider';
import { SocialSourceRegistry } from './providers/social-source.registry';
import { SocialCampaignSchema } from '../../schemas/social-campaign.schema';
import { SocialPostLeadSchema } from '../../schemas/social-post-lead.schema';
import { SocialRunSchema } from '../../schemas/social-run.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { LeadModule } from '../lead/lead.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SocialCampaign', schema: SocialCampaignSchema },
      { name: 'SocialPostLead', schema: SocialPostLeadSchema },
      { name: 'SocialRun', schema: SocialRunSchema },
      { name: 'Tenant', schema: TenantSchema },
    ]),
    LeadModule,
    NotificationModule,
  ],
  controllers: [SocialProspectingController],
  providers: [
    SocialProspectingService,
    SocialProspectingScheduler,
    SocialQualifierService,
    HackerNewsProvider,
    RedditProvider,
    QuoraSerpProvider,
    SerpProvider,
    TendersProvider,
    BlueskyProvider,
    StackExchangeProvider,
    GitHubProvider,
    SocialSourceRegistry,
  ],
  exports: [SocialProspectingService],
})
export class SocialProspectingModule {}
