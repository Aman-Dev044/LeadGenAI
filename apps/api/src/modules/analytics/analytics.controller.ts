import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto';
import { CurrentTenant, Roles } from '../../common/decorators';

@Controller('analytics')
@Roles('ADMIN', 'SALES_MANAGER')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOverview(tenantId, query);
  }

  @Get('leads')
  async getLeadAnalytics(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getLeadAnalytics(tenantId, query);
  }

  @Get('conversations')
  async getConversationAnalytics(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getConversationAnalytics(tenantId, query);
  }

  @Get('agents')
  @Roles('ADMIN')
  async getAgentPerformance(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAgentPerformance(tenantId, query);
  }

  @Get('sources')
  async getSourceBreakdown(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSourceBreakdown(tenantId, query);
  }

  @Get('trends')
  async getTrends(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTrends(tenantId, query);
  }

  @Get('team')
  async getTeamPerformance(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTeamPerformance(tenantId, query);
  }
}
