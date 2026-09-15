import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SupportTicketService } from './support-ticket.service';
import { CreateSupportTicketDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('support-tickets')
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Post()
  @Roles('ADMIN', 'SALES_MANAGER')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.ticketService.create(tenantId, dto);
  }

  @Get()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    // A salesperson only sees tickets assigned to them
    const scopedAssignee = user.role === 'SALESPERSON' ? user.userId : assignedTo;
    return this.ticketService.findAll(tenantId, paginationDto, {
      status,
      priority,
      assignedTo: scopedAssignee,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.ticketService.findById(tenantId, id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SALES_MANAGER')
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ticketService.updateStatus(tenantId, id, status);
  }

  @Patch(':id/assign')
  @Roles('ADMIN', 'SALES_MANAGER')
  async assign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('assignedTo') assignedTo: string,
  ) {
    return this.ticketService.assign(tenantId, id, assignedTo);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async addNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketService.addNote(tenantId, id, content, userId);
  }
}
