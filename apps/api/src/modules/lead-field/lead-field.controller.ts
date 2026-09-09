import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LeadFieldService } from './lead-field.service';
import { CreateLeadFieldDto } from './dto';
import { CurrentTenant, Roles } from '../../common/decorators';

@Controller('lead-fields')
@Roles('ADMIN')
export class LeadFieldController {
  constructor(private readonly leadFieldService: LeadFieldService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLeadFieldDto,
  ) {
    return this.leadFieldService.create(tenantId, dto);
  }

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.leadFieldService.findAll(tenantId);
  }

  @Patch(':id')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateLeadFieldDto>,
  ) {
    return this.leadFieldService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadFieldService.remove(tenantId, id);
  }
}
