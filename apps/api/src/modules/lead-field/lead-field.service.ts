import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLeadFieldDto } from './dto';

@Injectable()
export class LeadFieldService {
  constructor(
    @InjectModel('LeadField') private readonly leadFieldModel: Model<any>,
  ) {}

  async create(tenantId: string, dto: CreateLeadFieldDto) {
    const existing = await this.leadFieldModel.findOne({
      tenantId,
      name: dto.name,
    });
    if (existing) {
      throw new ConflictException('Field with this name already exists');
    }
    return this.leadFieldModel.create({ tenantId, ...dto });
  }

  async findAll(tenantId: string) {
    return this.leadFieldModel
      .find({ tenantId })
      .sort({ order: 1 })
      .lean();
  }

  async update(tenantId: string, fieldId: string, dto: Partial<CreateLeadFieldDto>) {
    const field = await this.leadFieldModel.findOneAndUpdate(
      { _id: fieldId, tenantId },
      { $set: dto },
      { new: true },
    );
    if (!field) {
      throw new NotFoundException('Lead field not found');
    }
    return field;
  }

  async remove(tenantId: string, fieldId: string) {
    const field = await this.leadFieldModel.findOneAndDelete({
      _id: fieldId,
      tenantId,
    });
    if (!field) {
      throw new NotFoundException('Lead field not found');
    }
    return { message: 'Lead field deleted' };
  }
}
