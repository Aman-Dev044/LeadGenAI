import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeadAutomationService } from './lead-automation.service';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateCampaignDto,
  ImportScrapedLeadsDto,
  PreviewQueriesDto,
  RejectScrapedLeadsDto,
  ScrapedLeadQueryDto,
  UpdateCampaignDto,
} from './dto';

type Actor = { userId: string; role: string };

/**
 * Google Maps prospecting. Admin-only inside a workspace; the platform owner
 * reaches it for a specific tenant through the usual X-Tenant-Id header.
 */
@ApiTags('lead-automation')
@Controller('lead-automation')
@Roles('ADMIN')
export class LeadAutomationController {
  constructor(private readonly service: LeadAutomationService) {}

  /** The owner console spans every tenant; writes here need one concrete workspace. */
  private requireTenant(tenantId: string): string {
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException(
        'Select a workspace first - AI Automation campaigns belong to a single tenant.',
      );
    }
    return tenantId;
  }

  // Meta

  @Get('sources')
  listSources() {
    return this.service.listSources();
  }

  @Post('preview-queries')
  previewQueries(@Body() dto: PreviewQueriesDto) {
    return this.service.previewQueries(dto);
  }

  // Campaigns

  @Get('campaigns')
  findCampaigns(@CurrentTenant() tenantId: string, @Query() paginationDto: PaginationDto) {
    return this.service.findCampaigns(tenantId, paginationDto);
  }

  @Post('campaigns')
  createCampaign(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.createCampaign(this.requireTenant(tenantId), dto, user?.userId);
  }

  @Get('campaigns/:id')
  findCampaign(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findCampaign(tenantId, id);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.updateCampaign(this.requireTenant(tenantId), id, dto);
  }

  @Delete('campaigns/:id')
  deleteCampaign(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteCampaign(this.requireTenant(tenantId), id);
  }

  // Runs

  @Post('campaigns/:id/run')
  run(@CurrentTenant() tenantId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.service.startRun(this.requireTenant(tenantId), id, 'manual', user?.userId);
  }

  @Get('campaigns/:id/runs')
  listRuns(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.listRuns(tenantId, id);
  }

  // Results

  // One DTO, not two: the global ValidationPipe uses `forbidNonWhitelisted`, so a
  // second @Query() DTO on the same handler would reject the first one's properties.
  @Get('prospects')
  findProspects(@CurrentTenant() tenantId: string, @Query() query: ScrapedLeadQueryDto) {
    return this.service.findScrapedLeads(
      tenantId,
      {
        campaignId: query.campaignId,
        status: query.status,
        isNewListing: query.isNewListing,
        minScore: query.minScore,
        search: query.search,
      },
      query,
    );
  }

  @Get('prospects/stats')
  stats(@CurrentTenant() tenantId: string, @Query('campaignId') campaignId?: string) {
    return this.service.statsFor(tenantId, campaignId);
  }

  @Get('prospects/:id')
  findProspect(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findScrapedLead(tenantId, id);
  }

  @Post('prospects/import')
  importProspects(
    @CurrentTenant() tenantId: string,
    @Body() dto: ImportScrapedLeadsDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.importScraped(this.requireTenant(tenantId), dto.ids, user);
  }

  @Post('prospects/reject')
  rejectProspects(
    @CurrentTenant() tenantId: string,
    @Body() dto: RejectScrapedLeadsDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.rejectScraped(this.requireTenant(tenantId), dto, user);
  }

  @Delete('prospects/:id')
  deleteProspect(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteScraped(this.requireTenant(tenantId), id);
  }
}
