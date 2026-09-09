import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { CreateAgentDto, UpdateAgentDto } from './dto';
import { Roles, CurrentTenant } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('agents')
@Roles('ADMIN', 'SALES_MANAGER')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAgentDto,
  ) {
    return this.agentService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.agentService.findAll(tenantId, paginationDto);
  }

  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.findById(tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentService.update(tenantId, id, dto);
  }

  @Post(':id/duplicate')
  async duplicate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.duplicate(tenantId, id);
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.agentService.remove(tenantId, id);
  }
}
