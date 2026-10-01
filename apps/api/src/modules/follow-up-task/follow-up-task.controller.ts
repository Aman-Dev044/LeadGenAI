import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FollowUpTaskService } from './follow-up-task.service';
import { CompleteTaskDto, CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';

type Actor = { userId: string; role: string };
const ownerScope = (user: Actor) => (user?.role === 'SALESPERSON' ? user.userId : undefined);

@ApiTags('follow-up-tasks')
@Controller('follow-up-tasks')
@Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
export class FollowUpTaskController {
  constructor(private readonly service: FollowUpTaskService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Query() query: TaskQueryDto, @CurrentUser() user: Actor) {
    return this.service.findAll(tenantId, query, user);
  }

  @Get('stats')
  stats(@CurrentTenant() tenantId: string, @CurrentUser() user: Actor) {
    return this.service.stats(tenantId, user);
  }

  @Get('lead/:leadId')
  forLead(@CurrentTenant() tenantId: string, @Param('leadId') leadId: string) {
    return this.service.findForLead(tenantId, leadId);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateTaskDto, @CurrentUser() user: Actor) {
    return this.service.createFromDto(tenantId, dto, user.userId, ownerScope(user));
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.update(tenantId, id, dto, user);
  }

  @Post(':id/complete')
  complete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.complete(tenantId, id, dto, user);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.service.remove(tenantId, id, user);
  }
}
