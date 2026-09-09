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
import { FollowUpService } from './follow-up.service';
import { CreateWorkflowDto } from './dto';
import { CurrentTenant, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('follow-ups')
@Roles('ADMIN')
export class FollowUpController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Post('workflows')
  async createWorkflow(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.followUpService.createWorkflow(tenantId, dto);
  }

  @Get('workflows')
  async findAllWorkflows(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.followUpService.findAllWorkflows(tenantId, paginationDto);
  }

  @Get('workflows/:id')
  async findWorkflowById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.followUpService.findWorkflowById(tenantId, id);
  }

  @Patch('workflows/:id')
  async updateWorkflow(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateWorkflowDto>,
  ) {
    return this.followUpService.updateWorkflow(tenantId, id, dto);
  }

  @Delete('workflows/:id')
  async deleteWorkflow(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.followUpService.deleteWorkflow(tenantId, id);
  }

  @Patch('workflows/:id/status')
  async toggleStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.followUpService.toggleStatus(tenantId, id, isActive);
  }

  @Get('workflows/:id/logs')
  async getWorkflowLogs(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.followUpService.getWorkflowLogs(tenantId, id, paginationDto);
  }
}
