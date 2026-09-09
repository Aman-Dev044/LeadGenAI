import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeSourceDto, UpdateKnowledgeSourceDto } from './dto';
import { Roles, CurrentTenant } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('knowledge-base')
@Roles('ADMIN', 'SALES_MANAGER')
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Post('sources')
  async createSource(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateKnowledgeSourceDto,
  ) {
    return this.kbService.createSource(tenantId, dto);
  }

  @Post('sources/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
        'text/markdown',
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only PDF, DOCX, TXT, CSV, and Markdown files are allowed'), false);
      }
    },
  }))
  async uploadSource(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!name || !name.trim()) {
      throw new BadRequestException('Name is required');
    }
    return this.kbService.createFileSource(tenantId, name.trim(), file);
  }

  @Get('sources')
  async findAllSources(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.kbService.findAllSources(tenantId, paginationDto);
  }

  @Get('sources/:id')
  async findSourceById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.findSourceById(tenantId, id);
  }

  @Patch('sources/:id')
  async updateSource(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeSourceDto,
  ) {
    return this.kbService.updateSource(tenantId, id, dto);
  }

  @Delete('sources/:id')
  async deleteSource(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.deleteSource(tenantId, id);
  }

  @Post('sources/:id/reprocess')
  async reprocessSource(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.reprocessSource(tenantId, id);
  }

  @Get('search')
  async search(
    @CurrentTenant() tenantId: string,
    @Query('q') query: string,
    @Query('sourceIds') sourceIds?: string,
    @Query('limit') limit?: string,
  ) {
    const ids = sourceIds ? sourceIds.split(',') : undefined;
    return this.kbService.searchKnowledge(
      tenantId,
      query,
      ids,
      limit ? parseInt(limit, 10) : 5,
    );
  }
}
