import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateTenantDto } from './dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
  ) {}

  async findById(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      tenantId,
      { $set: dto },
      { new: true },
    );
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getUsage(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      plan: tenant.plan,
      status: tenant.status,
      limits: tenant.limits,
      trialEndsAt: tenant.trialEndsAt,
    };
  }

  async getAllowedOrigins(tenantId: string): Promise<string[]> {
    const tenant = await this.tenantModel.findById(tenantId).select('allowedOrigins domain');
    if (!tenant) return [];
    const origins = [...(tenant.allowedOrigins || [])];
    if (tenant.domain) {
      origins.push(`https://${tenant.domain}`);
    }
    return origins;
  }
}
