import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CallingService } from './calling.service';

const DEFAULT_QUEUE_POLL_MS = 5_000;
const DEFAULT_REENGAGE_POLL_MS = 60 * 60_000;

/**
 * Two loops inside the API process:
 *  - every ~5s: dial queued AI calls that are due (respecting calling hours);
 *    new leads and finished calls also kick the queue immediately, so the
 *    poll is only a safety net
 *  - every hour: re-engage leads that went cold
 * With several API replicas set CALLING_SCHEDULER_ENABLED=false on all but one.
 */
@Injectable()
export class CallingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallingScheduler.name);
  private queueTimer: NodeJS.Timeout | null = null;
  private reengageTimer: NodeJS.Timeout | null = null;
  private dialing = false;
  private reengaging = false;

  constructor(private readonly service: CallingService) {}

  onModuleInit() {
    if (process.env.CALLING_SCHEDULER_ENABLED === 'false') {
      this.logger.log('Calling scheduler disabled by environment');
      return;
    }
    const queueMs = parseInt(process.env.CALLING_POLL_INTERVAL_MS || '', 10) || DEFAULT_QUEUE_POLL_MS;
    const reengageMs = parseInt(process.env.CALLING_REENGAGE_INTERVAL_MS || '', 10) || DEFAULT_REENGAGE_POLL_MS;

    this.queueTimer = setInterval(() => void this.dialTick(), queueMs);
    this.queueTimer.unref?.();
    this.reengageTimer = setInterval(() => void this.reengageTick(), reengageMs);
    this.reengageTimer.unref?.();
    setTimeout(() => void this.dialTick(), 10_000).unref?.();
    setTimeout(() => void this.reengageTick(), 2 * 60_000).unref?.();
    this.logger.log(`Calling scheduler: queue every ${Math.round(queueMs / 1000)}s, re-engage every ${Math.round(reengageMs / 60_000)}m`);
  }

  onModuleDestroy() {
    if (this.queueTimer) clearInterval(this.queueTimer);
    if (this.reengageTimer) clearInterval(this.reengageTimer);
    this.queueTimer = null;
    this.reengageTimer = null;
  }

  private async dialTick() {
    if (this.dialing) return;
    this.dialing = true;
    try {
      const n = await this.service.processQueue();
      if (n > 0) this.logger.log(`Placed ${n} AI call(s)`);
    } catch (err: any) {
      this.logger.error(`Call queue tick failed: ${err?.message}`);
    } finally {
      this.dialing = false;
    }
  }

  private async reengageTick() {
    if (this.reengaging) return;
    this.reengaging = true;
    try {
      const n = await this.service.reengageColdLeads();
      if (n > 0) this.logger.log(`Re-engaged ${n} cold lead(s)`);
    } catch (err: any) {
      this.logger.error(`Re-engage tick failed: ${err?.message}`);
    } finally {
      this.reengaging = false;
    }
  }
}
