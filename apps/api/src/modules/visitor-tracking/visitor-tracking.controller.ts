import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { VisitorTrackingService } from './visitor-tracking.service';
import { CurrentTenant, Public, Roles } from '../../common/decorators';

@Controller('visitor-tracking')
export class VisitorTrackingController {
  constructor(private readonly trackingService: VisitorTrackingService) {}

  @Get('top-pages')
  @Roles('ADMIN', 'SALES_MANAGER')
  async getTopPages(
    @CurrentTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.trackingService.getTopPages(tenantId, days ? parseInt(days, 10) : 30);
  }

  @Get('visitor-count')
  @Roles('ADMIN', 'SALES_MANAGER')
  async getVisitorCount(
    @CurrentTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.trackingService.getVisitorCount(tenantId, days ? parseInt(days, 10) : 30);
  }

  @Get('visitor/:visitorId')
  @Roles('ADMIN', 'SALES_MANAGER')
  async getVisitorHistory(
    @CurrentTenant() tenantId: string,
    @Param('visitorId') visitorId: string,
  ) {
    return this.trackingService.getVisitorHistory(tenantId, visitorId);
  }
}
