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
import { SocialProspectingService } from './social-prospecting.service';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateSocialCampaignDto,
  GenerateMessageDto,
  ImportSocialPostsDto,
  MarkSentDto,
  PreviewSocialQueriesDto,
  RejectSocialPostsDto,
  SocialPostQueryDto,
  SuggestKeywordsDto,
  UpdateMessageDto,
  UpdateSocialCampaignDto,
} from './dto';

type Actor = { userId: string; role: string };

/**
 * Leads Scrap AI - buying-intent prospecting across Reddit, Hacker News, Quora
 * and the open web. Admin-only inside a workspace; the platform owner reaches it
 * for a specific tenant through the usual X-Tenant-Id header.
 */
@ApiTags('social-prospecting')
@Controller('social-prospecting')
@Roles('ADMIN')
export class SocialProspectingController {
  constructor(private readonly service: SocialProspectingService) {}

  /** The owner console spans every tenant; writes here need one concrete workspace. */
  private requireTenant(tenantId: string): string {
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException(
        'Select a workspace first - Leads Scrap AI campaigns belong to a single tenant.',
      );
    }
    return tenantId;
  }

  // Meta

  @Get('sources')
  listSources(@CurrentTenant() tenantId: string) {
    return this.service.listSources(tenantId);
  }

  @Post('preview-queries')
  previewQueries(@CurrentTenant() tenantId: string, @Body() dto: PreviewSocialQueriesDto) {
    return this.service.previewQueries(this.requireTenant(tenantId), dto);
  }

  @Post('suggest-keywords')
  suggestKeywords(@Body() dto: SuggestKeywordsDto) {
    return this.service.suggestKeywords(dto.serviceTypes || []);
  }

  // Campaigns

  @Get('campaigns')
  findCampaigns(@CurrentTenant() tenantId: string, @Query() paginationDto: PaginationDto) {
    return this.service.findCampaigns(tenantId, paginationDto);
  }

  @Post('campaigns')
  createCampaign(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSocialCampaignDto,
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
    @Body() dto: UpdateSocialCampaignDto,
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

  // Review queue

  // One DTO, not two: the global ValidationPipe uses `forbidNonWhitelisted`, so a
  // second @Query() DTO on the same handler would reject the first one's properties.
  @Get('posts')
  findPosts(@CurrentTenant() tenantId: string, @Query() query: SocialPostQueryDto) {
    return this.service.findPosts(
      tenantId,
      {
        campaignId: query.campaignId,
        status: query.status,
        source: query.source,
        intent: query.intent,
        minScore: query.minScore,
        country: query.country,
        withinDays: query.withinDays,
        search: query.search,
      },
      query,
    );
  }

  @Get('posts/stats')
  stats(@CurrentTenant() tenantId: string, @Query('campaignId') campaignId?: string) {
    return this.service.statsFor(tenantId, campaignId);
  }

  @Get('posts/:id')
  findPost(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findPost(tenantId, id);
  }

  // Outreach drafts

  @Post('posts/:id/generate-message')
  generateMessage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: GenerateMessageDto,
  ) {
    return this.service.regenerateMessage(this.requireTenant(tenantId), id, dto);
  }

  @Patch('posts/:id/message')
  updateMessage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.service.updateMessage(this.requireTenant(tenantId), id, dto.body);
  }

  @Post('posts/:id/mark-sent')
  markSent(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: MarkSentDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.markSent(this.requireTenant(tenantId), id, user, dto.channel);
  }

  // Promote / discard

  @Post('posts/import')
  importPosts(
    @CurrentTenant() tenantId: string,
    @Body() dto: ImportSocialPostsDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.importPosts(this.requireTenant(tenantId), dto.ids, user);
  }

  @Post('posts/reject')
  rejectPosts(
    @CurrentTenant() tenantId: string,
    @Body() dto: RejectSocialPostsDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.rejectPosts(this.requireTenant(tenantId), dto, user);
  }

  @Delete('posts/:id')
  deletePost(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deletePost(this.requireTenant(tenantId), id);
  }
}
