import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @Roles('ADMIN')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationService.create(tenantId, dto);
  }

  @Get()
  async findByUser(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const effectiveTenantId = isSuperAdmin ? undefined : tenantId;
    return this.notificationService.findByUser(
      effectiveTenantId,
      user?.userId || user?._id || user?.id,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const effectiveTenantId = isSuperAdmin ? undefined : tenantId;
    return this.notificationService.getUnreadCount(
      effectiveTenantId,
      user?.userId || user?._id || user?.id,
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const effectiveTenantId = isSuperAdmin ? undefined : tenantId;
    return this.notificationService.markAsRead(
      effectiveTenantId,
      id,
      user?.userId || user?._id || user?.id,
    );
  }

  @Patch('read-all')
  async markAllAsRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const effectiveTenantId = isSuperAdmin ? undefined : tenantId;
    return this.notificationService.markAllAsRead(
      effectiveTenantId,
      user?.userId || user?._id || user?.id,
    );
  }
}
