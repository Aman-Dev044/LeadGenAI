import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FollowUpTaskService } from './follow-up-task.service';

const DEFAULT_POLL_MS = 5 * 60_000;

/**
 * Nudges assignees when a follow-up comes due and escalates slipped ones to
 * admins. In-process like the other schedulers: with several API replicas set
 * FOLLOW_UP_TASK_SCHEDULER_ENABLED=false on all but one.
 */
@Injectable()
export class FollowUpTaskScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpTaskScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(private readonly service: FollowUpTaskService) {}

  onModuleInit() {
    if (process.env.FOLLOW_UP_TASK_SCHEDULER_ENABLED === 'false') {
      this.logger.log('Follow-up task scheduler disabled by environment');
      return;
    }
    const interval = parseInt(process.env.FOLLOW_UP_TASK_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 20_000).unref?.();
    this.logger.log(`Follow-up task scheduler polling every ${Math.round(interval / 1000)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const sent = await this.service.processDue();
      if (sent > 0) this.logger.log(`Sent ${sent} follow-up nudge(s)/alert(s)`);
    } catch (err: any) {
      this.logger.error(`Follow-up task tick failed: ${err?.message}`);
    } finally {
      this.ticking = false;
    }
  }
}
