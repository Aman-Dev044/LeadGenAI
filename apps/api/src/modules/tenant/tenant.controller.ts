import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto';
import { Roles, CurrentTenant } from '../../common/decorators';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  @Patch()
  @Roles('ADMIN')
  async update(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.update(tenantId, dto);
  }

  @Get('usage')
  async getUsage(@CurrentTenant() tenantId: string) {
    return this.tenantService.getUsage(tenantId);
  }
}
