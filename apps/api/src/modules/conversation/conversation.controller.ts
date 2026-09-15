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

type Actor = { userId: string; role: string };
/** Salespeople only see conversations handed to them or tied to their leads. */
const ownerScope = (user: Actor) => (user?.role === 'SALESPERSON' ? user.userId : undefined);

@Controller('conversations')
@Roles('ADMIN', 'SALES_MANAGER', 'SALESPERSON')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Actor,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.conversationService.findAll(
      tenantId,
      paginationDto,
      { status, agentId, leadId },
      ownerScope(user),
    );
  }

  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    return this.conversationService.findById(tenantId, id, ownerScope(user));
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    // Ownership check for salespeople (throws 403 when the chat is not theirs)
    await this.conversationService.findById(tenantId, id, ownerScope(user));
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
    @CurrentUser() user: Actor,
  ) {
    await this.conversationService.findById(tenantId, id, ownerScope(user));
    return this.conversationService.sendAgentMessage(
      tenantId,
      id,
      dto.content,
      user.userId,
    );
  }

  @Patch(':id/end')
  async endConversation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
  ) {
    await this.conversationService.findById(tenantId, id, ownerScope(user));
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
