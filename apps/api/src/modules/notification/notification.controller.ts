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
    @CurrentUser('userId') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.findByUser(
      tenantId,
      userId,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationService.getUnreadCount(tenantId, userId);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationService.markAsRead(tenantId, id, userId);
  }

  @Patch('read-all')
  async markAllAsRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationService.markAllAsRead(tenantId, userId);
  }
}
