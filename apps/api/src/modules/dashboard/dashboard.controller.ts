import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';

@Controller('dashboard')
@Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const scopedUserId = user?.role === 'SALESPERSON' ? user.userId : undefined;
    return this.dashboardService.getOverview(tenantId, scopedUserId);
  }

  @Get('leads/stats')
  async getLeadStats(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('days') days?: string,
  ) {
    const scopedUserId = user?.role === 'SALESPERSON' ? user.userId : undefined;
    return this.dashboardService.getLeadStats(tenantId, days ? parseInt(days, 10) : 30, scopedUserId);
  }

  @Get('conversations/stats')
  async getConversationStats(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('days') days?: string,
  ) {
    const scopedUserId = user?.role === 'SALESPERSON' ? user.userId : undefined;
    return this.dashboardService.getConversationStats(tenantId, days ? parseInt(days, 10) : 30, scopedUserId);
  }

  @Get('agents/stats')
  @Roles('ADMIN', 'SALES_MANAGER')
  async getAgentStats(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getAgentStats(tenantId);
  }
}

