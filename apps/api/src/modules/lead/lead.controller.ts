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

type Actor = { userId: string; role: string };
/** Salespeople are scoped to the leads assigned to them; every other role sees the whole tenant. */
const ownerScope = (user: Actor) => (user?.role === 'SALESPERSON' ? user.userId : undefined);

@Controller('leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.create(tenantId, dto, user.userId, ownerScope(user));
  }

  @Get()
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Actor,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('temperature') temperature?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('source') source?: string,
    @Query('tags') tags?: string,
    @Query('aiCallStatus') aiCallStatus?: string,
    @Query('followUp') followUp?: string,
  ) {
    return this.leadService.findAll(
      tenantId,
      paginationDto,
      { status, temperature, assignedTo, source, tags, aiCallStatus, followUp },
      ownerScope(user),
    );
  }

  /** Kanban: every pipeline stage with counts and its most recent leads. */
  @Get('pipeline')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async pipeline(@CurrentTenant() tenantId: string, @CurrentUser() user: Actor) {
    return this.leadService.getPipeline(tenantId, ownerScope(user));
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

  /**
   * Bulk import from CSV or Excel. `autoCall=true` makes the AI phone every
   * imported lead (with the sheet's description as context), one by one.
   */
  @Post('import/csv')
  @Roles('ADMIN', 'SALES_MANAGER')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!/\.(csv|xlsx|xlsm|xls)$/i.test(file.originalname || '')) {
        return cb(new BadRequestException('Only CSV or Excel (.xlsx) files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async importSheet(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @Body('autoCall') autoCall?: string | boolean,
  ) {
    if (!file) {
      throw new BadRequestException('A CSV or Excel file is required');
    }
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException('Select a workspace first');
    }
    const wantsCalls = autoCall === true || autoCall === 'true' || autoCall === '1';
    return this.leadService.importFromSheet(tenantId, file.buffer, file.originalname, userId, { autoCall: wantsCalls });
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
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.findById(tenantId, id, ownerScope(user));
  }

  @Patch(':id')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.update(tenantId, id, dto, user.userId, ownerScope(user));
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
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER')
  async getActivities(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.getActivities(tenantId, id, ownerScope(user));
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async addNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('note') note: string,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.addNote(tenantId, id, note, user.userId, ownerScope(user));
  }

  @Post(':id/dossier')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async generateDossier(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.generateLeadDossier(tenantId, id, ownerScope(user));
  }

  @Post(':id/voice-note')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async generateVoiceNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    return this.leadService.generateVoiceNoteScript(tenantId, id, ownerScope(user));
  }
}
