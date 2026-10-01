import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LeadAutomationService } from './lead-automation.service';

const DEFAULT_POLL_MS = 5 * 60_000;

/**
 * Runs campaigns whose `nextRunAt` has passed. Mirrors the follow-up scheduler:
 * it lives inside the API process, and with several API replicas you set
 * LEAD_AUTOMATION_SCHEDULER_ENABLED=false on all but one.
 */
@Injectable()
export class LeadAutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadAutomationScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly service: LeadAutomationService) {}

  onModuleInit() {
    if (process.env.LEAD_AUTOMATION_SCHEDULER_ENABLED === 'false') {
      this.logger.log('Campaign scheduler disabled by environment');
      return;
    }
    const interval =
      parseInt(process.env.LEAD_AUTOMATION_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.processDue(), interval);
    this.logger.log(`Campaign scheduler polling every ${Math.round(interval / 1000)}s`);
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
      this.logger.error(`Campaign scheduler poll failed: ${err?.message}`);
    }
  }
}
