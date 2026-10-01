import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SocialProspectingService } from './social-prospecting.service';

const DEFAULT_POLL_MS = 5 * 60_000;

/**
 * Runs Leads Scrap AI campaigns whose `nextRunAt` has passed. Mirrors the
 * follow-up and AI Automation schedulers: it lives inside the API process, and
 * with several API replicas you set SOCIAL_PROSPECTING_SCHEDULER_ENABLED=false
 * on all but one.
 */
@Injectable()
export class SocialProspectingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialProspectingScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly service: SocialProspectingService) {}

  onModuleInit() {
    if (process.env.SOCIAL_PROSPECTING_SCHEDULER_ENABLED === 'false') {
      this.logger.log('Leads Scrap AI scheduler disabled by environment');
      return;
    }
    const interval =
      parseInt(process.env.SOCIAL_PROSPECTING_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.processDue(), interval);
    this.logger.log(`Leads Scrap AI scheduler polling every ${Math.round(interval / 1000)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async processDue() {
    try {
      const due = await this.service.findDueCampaigns(5);
      for (const campaign of due) {
        // Move the slot forward first: a crash mid-run must not re-fire every poll.
        await this.service.deferCampaign(String(campaign._id), campaign.schedule);
        try {
          await this.service.startRun(campaign.tenantId, String(campaign._id), 'schedule');
        } catch (err: any) {
          this.logger.warn(`Scheduled run skipped for ${campaign.name}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Leads Scrap AI scheduler poll failed: ${err?.message}`);
    }
  }
}
