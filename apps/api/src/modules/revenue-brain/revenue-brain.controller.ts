import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentTenant, Roles } from '../../common/decorators';
import { CallQaService } from './call-qa.service';
import { DigestService } from './digest.service';
import { ExperimentService } from './experiment.service';
import { InsightsService } from './insights.service';

const days = (v: any, d = 30) => Math.min(365, Math.max(1, parseInt(String(v ?? ''), 10) || d));

/**
 * Revenue Brain: what the agent is doing well, where the deals leak, and which
 * script wins. Reading is open to the whole team; changing an experiment -
 * which rewrites the live calling script - is not.
 */
@Controller('revenue-brain')
export class RevenueBrainController {
  constructor(
    private readonly insights: InsightsService,
    private readonly experiments: ExperimentService,
    private readonly qa: CallQaService,
    private readonly digest: DigestService,
  ) {}

  @Get('overview')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async overview(@CurrentTenant() tenantId: string, @Query('days') d?: string) {
    return this.insights.overview(tenantId, days(d));
  }

  @Get('reviews')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async reviews(
    @CurrentTenant() tenantId: string,
    @Query('days') d?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('lossReason') lossReason?: string,
  ) {
    return this.insights.list(tenantId, {
      days: days(d),
      limit: parseInt(limit || '', 10) || 25,
      skip: parseInt(skip || '', 10) || 0,
      lossReason,
    });
  }

  @Get('reviews/:callId')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async review(@CurrentTenant() tenantId: string, @Param('callId') callId: string) {
    return this.insights.forCall(tenantId, callId);
  }

  // ─── Script experiments ───────────────────────────────────────────

  @Get('experiments')
  @Roles('ADMIN', 'SALES_MANAGER')
  async listExperiments(@CurrentTenant() tenantId: string) {
    return this.experiments.list(tenantId);
  }

  @Post('experiments')
  @Roles('ADMIN')
  async createExperiment(@CurrentTenant() tenantId: string, @Body() dto: any) {
    try {
      return await this.experiments.create(tenantId, dto);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Could not create the experiment');
    }
  }

  @Patch('experiments/:id')
  @Roles('ADMIN')
  async setStatus(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() body: { status: string }) {
    if (body?.status !== 'running' && body?.status !== 'stopped') {
      throw new BadRequestException('status must be running or stopped');
    }
    const updated = await this.experiments.setStatus(tenantId, id, body.status);
    if (!updated) throw new BadRequestException('Experiment not found');
    return updated;
  }

  /** Put the script back to what it was before this experiment promoted a winner. */
  @Post('experiments/:id/revert')
  @Roles('ADMIN')
  async revert(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const ok = await this.experiments.revert(tenantId, id);
    if (!ok) throw new BadRequestException('Nothing to revert on this experiment');
    return { reverted: true };
  }

  @Delete('experiments/:id')
  @Roles('ADMIN')
  async removeExperiment(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    await this.experiments.remove(tenantId, id);
    return { deleted: true };
  }

  // ─── The weekly digest ────────────────────────────────────────────

  /** What this week's digest would say, without sending it. */
  @Get('digest/preview')
  @Roles('ADMIN', 'SALES_MANAGER')
  async preview(@CurrentTenant() tenantId: string, @Query('days') d?: string) {
    return this.digest.build(tenantId, days(d, 7));
  }

  @Post('digest/send')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 3, ttl: 3600_000 } })
  async send(@CurrentTenant() tenantId: string) {
    const sent = await this.digest.sendFor(tenantId);
    return { sent, message: sent ? 'Digest sent to admins and sales managers' : 'No reviewed calls yet - nothing to send' };
  }

  /** Grade whatever is still ungraded now, instead of waiting for the sweep. */
  @Post('grade-now')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 6, ttl: 3600_000 } })
  async gradeNow() {
    const graded = await this.qa.tick();
    return { graded };
  }
}
