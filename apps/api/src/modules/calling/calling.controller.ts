import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CallingService } from './calling.service';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import {
  BulkAiCallDto,
  CallQueryDto,
  ClickToCallDto,
  LogManualCallDto,
  StartAiCallDto,
  TestCallDto,
  UpdateCallingSettingsDto,
} from './dto';

type Actor = { userId: string; role: string };

/**
 * AI calling + human calling for one workspace. Salespeople see and place
 * calls for their own leads; admins see everything and own the settings.
 */
@ApiTags('calling')
@Controller('calling')
@Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
export class CallingController {
  constructor(private readonly service: CallingService) {}

  private requireTenant(tenantId: string): string {
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException('Select a workspace first - calls belong to a single tenant.');
    }
    return tenantId;
  }

  // Settings (admin)

  @Get('settings')
  @Roles('ADMIN')
  settings(@CurrentTenant() tenantId: string) {
    return this.service.getSettings(this.requireTenant(tenantId));
  }

  @Put('settings')
  @Roles('ADMIN')
  updateSettings(@CurrentTenant() tenantId: string, @Body() dto: UpdateCallingSettingsDto) {
    return this.service.updateSettings(this.requireTenant(tenantId), dto.settings || {});
  }

  @Get('readiness')
  readiness(@CurrentTenant() tenantId: string) {
    return this.service.readiness(this.requireTenant(tenantId));
  }

  @Post('test-call')
  @Roles('ADMIN')
  testCall(@CurrentTenant() tenantId: string, @Body() dto: TestCallDto, @CurrentUser() user: Actor) {
    return this.service.testCall(this.requireTenant(tenantId), dto.phone, dto.name, user);
  }

  // Calls

  @Get('calls')
  findAll(@CurrentTenant() tenantId: string, @Query() query: CallQueryDto, @CurrentUser() user: Actor) {
    return this.service.findAll(tenantId, query, user);
  }

  @Get('stats')
  stats(@CurrentTenant() tenantId: string, @CurrentUser() user: Actor) {
    return this.service.stats(tenantId, user);
  }

  @Get('calls/:id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.service.findOne(tenantId, id, user);
  }

  @Delete('calls/:id')
  cancel(@CurrentTenant() tenantId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.service.cancelQueued(this.requireTenant(tenantId), id, user);
  }

  /** Re-fetch the report from the provider and re-run the analysis. */
  @Post('calls/:id/reprocess')
  @Roles('ADMIN')
  reprocess(@CurrentTenant() tenantId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.service.reprocess(this.requireTenant(tenantId), id, user);
  }

  @Post('calls/:id/notes')
  addNotes(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { notes: string; outcome?: string },
    @CurrentUser() user: Actor,
  ) {
    if (!body?.notes?.trim()) throw new BadRequestException('Notes are required');
    return this.service.addNotes(this.requireTenant(tenantId), id, body.notes.trim(), body.outcome, user);
  }

  /** AI calls every selected lead, now or at a scheduled time. */
  @Post('bulk-call')
  bulkCall(@CurrentTenant() tenantId: string, @Body() dto: BulkAiCallDto, @CurrentUser() user: Actor) {
    return this.service.bulkAiCall(this.requireTenant(tenantId), dto.leadIds, user, {
      at: dto.at ? new Date(dto.at) : undefined,
      ignoreCallingHours: dto.ignoreCallingHours,
    });
  }

  // Per lead

  @Get('leads/:leadId/calls')
  forLead(@CurrentTenant() tenantId: string, @Param('leadId') leadId: string) {
    return this.service.findForLead(tenantId, leadId);
  }

  /** Have the AI call this lead now. */
  @Post('leads/:leadId/ai-call')
  aiCall(
    @CurrentTenant() tenantId: string,
    @Param('leadId') leadId: string,
    @Body() dto: StartAiCallDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.startAiCallNow(this.requireTenant(tenantId), leadId, user, dto || {});
  }

  /** Ring me, then connect me to the lead (Twilio). */
  @Post('leads/:leadId/click-to-call')
  clickToCall(
    @CurrentTenant() tenantId: string,
    @Param('leadId') leadId: string,
    @Body() dto: ClickToCallDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.clickToCall(this.requireTenant(tenantId), leadId, user, dto?.fromPhone);
  }

  /** I called from my own phone - here is what happened. */
  @Post('leads/:leadId/log')
  logCall(
    @CurrentTenant() tenantId: string,
    @Param('leadId') leadId: string,
    @Body() dto: LogManualCallDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.logManualCall(this.requireTenant(tenantId), leadId, dto, user);
  }
}
