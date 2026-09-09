import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';

@Controller('api-keys')
@Roles('ADMIN')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.apiKeyService.create(tenantId, dto, userId);
  }

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.apiKeyService.findAll(tenantId);
  }

  @Delete(':id')
  async revoke(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.apiKeyService.revoke(tenantId, id);
  }
}
