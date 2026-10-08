import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebsiteService } from './website.service';
import { CurrentTenant, Roles } from '../../common/decorators';

/**
 * The workspace's own website: check it, read it, and keep what it says where
 * the AI agents can use it.
 */
@Controller('website')
export class WebsiteController {
  constructor(private readonly service: WebsiteService) {}

  @Get()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  status(@CurrentTenant() tenantId: string) {
    return this.service.status(tenantId);
  }

  /** Is the site live, and is it the one they meant? */
  @Post('verify')
  @HttpCode(200)
  @Roles('ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  verify(@CurrentTenant() tenantId: string, @Body('url') url: string) {
    return this.service.verify(tenantId, url);
  }

  /** Read the whole site and build the briefing. Runs in the background. */
  @Post('crawl')
  @HttpCode(200)
  @Roles('ADMIN')
  @Throttle({ default: { ttl: 300_000, limit: 6 } })
  crawl(@CurrentTenant() tenantId: string, @Body('applyToAgents') applyToAgents?: boolean) {
    return this.service.startCrawl(tenantId, { applyToAgents: applyToAgents !== false });
  }

  /** Copy what the website says into the calling and WhatsApp agents. */
  @Post('apply')
  @HttpCode(200)
  @Roles('ADMIN')
  async apply(@CurrentTenant() tenantId: string) {
    const status = await this.service.status(tenantId);
    if (!status.profile) return { applied: [], message: 'Read your website first.' };
    return this.service.applyProfileToAgents(tenantId, status.profile, status.domain);
  }

  @Delete()
  @Roles('ADMIN')
  clear(@CurrentTenant() tenantId: string) {
    return this.service.clear(tenantId);
  }
}
