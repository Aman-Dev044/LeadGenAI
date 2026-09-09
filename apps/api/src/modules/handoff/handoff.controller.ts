import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { HandoffService } from './handoff.service';
import { CreateHandoffDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('handoffs')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  @Get()
  @Roles('ADMIN', 'SALES_MANAGER')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.handoffService.findAll(tenantId, paginationDto, status);
  }

  @Get('pending-count')
  async getPendingCount(@CurrentTenant() tenantId: string) {
    return this.handoffService.getPendingCount(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.handoffService.findById(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'SALES_MANAGER')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateHandoffDto,
  ) {
    return this.handoffService.create(tenantId, dto);
  }

  @Post(':id/accept')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async accept(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.handoffService.accept(tenantId, id, userId);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async reject(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body('notes') notes?: string,
  ) {
    return this.handoffService.reject(tenantId, id, userId, notes);
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async complete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.handoffService.complete(tenantId, id, notes);
  }
}
