import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminOnly, CurrentUser } from '../../common/decorators';
import { ActorContext, SuperAdminService } from './super-admin.service';
import {
  AdminResetPasswordDto,
  BroadcastDto,
  CreateSuperAdminDto,
  CreateTenantAdminDto,
  DeleteTenantDto,
  ImpersonateDto,
  ListAuditQueryDto,
  ListTenantsQueryDto,
  ListUsersQueryDto,
  SearchQueryDto,
  SuspendTenantDto,
  UpdatePlatformSettingsDto,
  UpdateTenantAdminDto,
  UpdateUserAdminDto,
  UsageQueryDto,
} from './dto';

/**
 * Owner console. Every route here is restricted to SUPER_ADMIN and operates across
 * all tenants. Mutations are written to the audit log by the service.
 */
@ApiTags('super-admin')
@ApiBearerAuth()
@Controller('admin')
@SuperAdminOnly()
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  private actor(user: any, req: any): ActorContext {
    return {
      userId: user.userId,
      email: user.email,
      tenantId: user.tenantId,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    };
  }

  // ---- overview -----------------------------------------------------------

  @Get('overview')
  overview() {
    return this.service.getOverview();
  }

  @Get('activity')
  activity() {
    return this.service.getActivityFeed();
  }

  @Get('search')
  search(@Query() query: SearchQueryDto) {
    return this.service.search(query.q);
  }

  @Get('system')
  system() {
    return this.service.getSystemInfo();
  }

  @Get('usage')
  usage(@Query() query: UsageQueryDto) {
    return this.service.getUsage(query.period);
  }

  // ---- tenants ------------------------------------------------------------

  @Get('tenants')
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.service.listTenants(query);
  }

  @Get('tenants/export.csv')
  async exportTenants(@Res() res: Response) {
    const csv = await this.service.exportTenantsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tenants-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantAdminDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.createTenant(dto, this.actor(user, req));
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.service.getTenant(id);
  }

  @Patch('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantAdminDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.updateTenant(id, dto, this.actor(user, req));
  }

  @Post('tenants/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspendTenant(@Param('id') id: string, @Body() dto: SuspendTenantDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.suspendTenant(id, dto.reason, this.actor(user, req));
  }

  @Post('tenants/:id/activate')
  @HttpCode(HttpStatus.OK)
  activateTenant(@Param('id') id: string, @CurrentUser() user: any, @Req() req: any) {
    return this.service.activateTenant(id, this.actor(user, req));
  }

  @Delete('tenants/:id')
  deleteTenant(@Param('id') id: string, @Body() dto: DeleteTenantDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.deleteTenant(id, dto, this.actor(user, req));
  }

  @Post('tenants/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  impersonate(@Param('id') id: string, @Body() dto: ImpersonateDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.impersonate(id, dto.userId, this.actor(user, req));
  }

  // ---- users --------------------------------------------------------------

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.service.listUsers(query);
  }

  @Get('super-admins')
  listSuperAdmins() {
    return this.service.listSuperAdmins();
  }

  @Post('super-admins')
  createSuperAdmin(@Body() dto: CreateSuperAdminDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.createSuperAdmin(dto, this.actor(user, req));
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserAdminDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.updateUser(id, dto, this.actor(user, req));
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.resetUserPassword(id, dto, this.actor(user, req));
  }

  @Post('users/:id/force-logout')
  @HttpCode(HttpStatus.OK)
  forceLogout(@Param('id') id: string, @CurrentUser() user: any, @Req() req: any) {
    return this.service.forceLogout(id, this.actor(user, req));
  }

  // ---- audit --------------------------------------------------------------

  @Get('audit-logs')
  auditLogs(@Query() query: ListAuditQueryDto) {
    return this.service.listAuditLogs(query);
  }

  // ---- settings / broadcast ----------------------------------------------

  @Get('settings')
  settings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.updateSettings(dto, this.actor(user, req));
  }

  @Get('broadcasts')
  broadcasts() {
    return this.service.listBroadcasts();
  }

  @Post('broadcasts')
  broadcast(@Body() dto: BroadcastDto, @CurrentUser() user: any, @Req() req: any) {
    return this.service.broadcast(dto, this.actor(user, req));
  }
}
