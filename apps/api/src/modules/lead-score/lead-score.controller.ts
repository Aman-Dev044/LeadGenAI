import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LeadScoreService } from './lead-score.service';
import { CreateScoringRuleDto } from './dto';
import { CurrentTenant, Roles } from '../../common/decorators';

@Controller('lead-scoring')
@Roles('ADMIN', 'SALES_MANAGER')
export class LeadScoreController {
  constructor(private readonly scoreService: LeadScoreService) {}

  @Post('rules')
  async createRule(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateScoringRuleDto,
  ) {
    return this.scoreService.createRule(tenantId, dto);
  }

  @Get('rules')
  async findAllRules(@CurrentTenant() tenantId: string) {
    return this.scoreService.findAllRules(tenantId);
  }

  @Patch('rules/:id')
  async updateRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateScoringRuleDto>,
  ) {
    return this.scoreService.updateRule(tenantId, id, dto);
  }

  @Delete('rules/:id')
  async deleteRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.scoreService.deleteRule(tenantId, id);
  }

  @Post('score/:leadId')
  async scoreLead(
    @CurrentTenant() tenantId: string,
    @Param('leadId') leadId: string,
  ) {
    return this.scoreService.scoreLead(tenantId, leadId);
  }

  @Post('score-all')
  async scoreAllLeads(@CurrentTenant() tenantId: string) {
    return this.scoreService.scoreAllLeads(tenantId);
  }
}
