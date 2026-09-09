import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { LeadService } from './lead.service';
import { CreateLeadDto, UpdateLeadDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLeadDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leadService.create(tenantId, dto, userId);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('temperature') temperature?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('source') source?: string,
    @Query('tags') tags?: string,
  ) {
    return this.leadService.findAll(tenantId, paginationDto, {
      status,
      temperature,
      assignedTo,
      source,
      tags,
    });
  }

  // Static routes MUST come before :id routes
  @Get('export/csv')
  @Roles('ADMIN', 'SALES_MANAGER')
  async exportCsv(
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('temperature') temperature?: string,
    @Query('source') source?: string,
  ) {
    const csv = await this.leadService.exportToCsv(tenantId, { status, temperature, source });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads-export-${Date.now()}.csv`);
    res.send(csv);
  }

  @Post('import/csv')
  @Roles('ADMIN', 'SALES_MANAGER')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
        return cb(new BadRequestException('Only CSV files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async importCsv(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.leadService.importFromCsv(tenantId, csvContent, userId);
  }

  @Post('bulk/assign')
  @Roles('ADMIN', 'SALES_MANAGER')
  async bulkAssign(
    @CurrentTenant() tenantId: string,
    @Body() body: { leadIds: string[]; assignTo: string },
    @CurrentUser('userId') userId: string,
  ) {
    return this.leadService.bulkAssign(tenantId, body.leadIds, body.assignTo, userId);
  }

  // Dynamic :id routes come AFTER static routes
  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadService.findById(tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leadService.update(tenantId, id, dto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SALES_MANAGER')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadService.remove(tenantId, id);
  }

  @Get(':id/activities')
  async getActivities(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadService.getActivities(tenantId, id);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async addNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('note') note: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leadService.addNote(tenantId, id, note, userId);
  }
}
