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
import { WebhookService } from './webhook.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { CurrentTenant, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('webhooks')
@Roles('ADMIN')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhookService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.webhookService.findAll(tenantId, paginationDto);
  }

  @Get(':id')
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.webhookService.findById(tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.webhookService.remove(tenantId, id);
  }

  @Get(':id/logs')
  async getLogs(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.webhookService.getLogs(tenantId, id, paginationDto);
  }

  @Post(':id/test')
  async test(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.webhookService.testWebhook(tenantId, id);
  }

  @Post(':id/retry/:logId')
  async retry(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('logId') logId: string,
  ) {
    return this.webhookService.retryDelivery(tenantId, id, logId);
  }
}
