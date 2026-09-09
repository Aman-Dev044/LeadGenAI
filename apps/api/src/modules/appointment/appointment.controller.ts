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
import { Throttle } from '@nestjs/throttler';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, RescheduleAppointmentDto } from './dto';
import { CurrentTenant, Roles, Public } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Roles('ADMIN', 'SALESPERSON')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentService.create(tenantId, dto);
  }

  @Get()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentService.findAll(tenantId, paginationDto, {
      status,
      assignedTo,
      from,
      to,
    });
  }

  @Get('available-slots')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async getAvailableSlots(
    @Query('tenantId') tenantId: string,
    @Query('assignedTo') assignedTo: string,
    @Query('date') date: string,
    @Query('duration') duration?: string,
  ) {
    if (!tenantId || !assignedTo || !date) {
      throw new BadRequestException('tenantId, assignedTo and date are required');
    }
    // Validate date format
    if (isNaN(Date.parse(date))) {
      throw new BadRequestException('Invalid date format');
    }
    return this.appointmentService.getAvailableSlots(
      tenantId,
      assignedTo,
      date,
      duration ? parseInt(duration, 10) : 30,
    );
  }

  @Post('book')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async bookFromWidget(
    @Body()
    body: {
      tenantId: string;
      assignedTo: string;
      startTime: string;
      endTime: string;
      attendee: { name?: string; email?: string; phone?: string };
      leadId?: string;
      conversationId?: string;
    },
  ) {
    if (!body.tenantId || !body.assignedTo || !body.startTime || !body.endTime) {
      throw new BadRequestException('tenantId, assignedTo, startTime and endTime are required');
    }
    return this.appointmentService.bookFromWidget(body.tenantId, body);
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentService.findById(tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SALESPERSON')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(tenantId, id, dto);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async cancel(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.appointmentService.cancel(tenantId, id, reason);
  }

  @Post(':id/reschedule')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async reschedule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.reschedule(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SALES_MANAGER')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentService.remove(tenantId, id);
  }
}
