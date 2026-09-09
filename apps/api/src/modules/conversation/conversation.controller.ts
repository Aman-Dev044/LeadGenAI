import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { SendMessageDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('conversations')
@Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.conversationService.findAll(tenantId, paginationDto, {
      status,
      agentId,
      leadId,
    });
  }

  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.findById(tenantId, id);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.conversationService.getMessages(
      tenantId,
      id,
      limit ? parseInt(limit, 10) : 50,
      before,
    );
  }

  @Post(':id/messages')
  @Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
  async sendAgentMessage(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.conversationService.sendAgentMessage(
      tenantId,
      id,
      dto.content,
      userId,
    );
  }

  @Patch(':id/end')
  async endConversation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.endConversation(tenantId, id);
  }

  @Patch(':id/handoff')
  @Roles('ADMIN', 'SALES_MANAGER')
  async handoff(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('assignTo') assignTo?: string,
  ) {
    return this.conversationService.handoff(tenantId, id, assignTo);
  }

  @Post(':id/summary')
  @Roles('ADMIN', 'SALES_MANAGER')
  async generateSummary(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const conversation = await this.conversationService.findById(tenantId, id);
    const summary = await this.conversationService.generateSummary(
      tenantId,
      id,
      conversation.agentId,
    );
    return { summary };
  }
}
