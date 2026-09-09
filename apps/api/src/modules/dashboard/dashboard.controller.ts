import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentTenant, Roles } from '../../common/decorators';

@Controller('dashboard')
@Roles('ADMIN', 'SALES_MANAGER')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getOverview(tenantId);
  }

  @Get('leads/stats')
  async getLeadStats(
    @CurrentTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getLeadStats(tenantId, days ? parseInt(days, 10) : 30);
  }

  @Get('conversations/stats')
  async getConversationStats(
    @CurrentTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getConversationStats(tenantId, days ? parseInt(days, 10) : 30);
  }

  @Get('agents/stats')
  async getAgentStats(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getAgentStats(tenantId);
  }
}
