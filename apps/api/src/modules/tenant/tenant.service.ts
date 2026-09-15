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
    if (!tenantId || tenantId === 'all') {
      const defaultTenant =
        (await this.tenantModel.findOne({ isPlatformOwner: true })) ||
        (await this.tenantModel.findOne({}));
      if (!defaultTenant) {
        throw new NotFoundException('Tenant not found');
      }
      return defaultTenant;
    }
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    let targetId = tenantId;
    if (!targetId || targetId === 'all') {
      const defaultTenant =
        (await this.tenantModel.findOne({ isPlatformOwner: true })) ||
        (await this.tenantModel.findOne({}));
      if (!defaultTenant) {
        throw new NotFoundException('Tenant not found');
      }
      targetId = String(defaultTenant._id);
    }

    const tenant = await this.tenantModel.findByIdAndUpdate(
      targetId,
      { $set: dto },
      { new: true },
    );
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getUsage(tenantId: string) {
    const tenant = await this.findById(tenantId);

    return {
      plan: tenant.plan,
      status: tenant.status,
      limits: tenant.limits,
      trialEndsAt: tenant.trialEndsAt,
    };
  }

  async getAllowedOrigins(tenantId: string): Promise<string[]> {
    let tenant;
    if (!tenantId || tenantId === 'all') {
      tenant =
        (await this.tenantModel.findOne({ isPlatformOwner: true }).select('allowedOrigins domain')) ||
        (await this.tenantModel.findOne({}).select('allowedOrigins domain'));
    } else {
      tenant = await this.tenantModel.findById(tenantId).select('allowedOrigins domain');
    }
    if (!tenant) return [];
    const origins = [...(tenant.allowedOrigins || [])];
    if (tenant.domain) {
      origins.push(`https://${tenant.domain}`);
    }
    return origins;
  }
}
