import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAgentDto, UpdateAgentDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { CacheService } from '../../providers/redis/cache.service';
import { escapeRegex } from '../../common/utils/sanitize';

@Injectable()
export class AgentService {
  constructor(
    @InjectModel('Agent') private readonly agentModel: Model<any>,
    private readonly cache: CacheService,
  ) {}

  async create(tenantId: string, dto: CreateAgentDto) {
    return this.agentModel.create({ tenantId, ...dto });
  }

  async findAll(tenantId: string, paginationDto: PaginationDto) {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }

    if (paginationDto.search) {
      const safeSearch = escapeRegex(paginationDto.search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    return paginate(this.agentModel, query, paginationDto);
  }

  async findById(tenantId: string, agentId: string) {
    const query: any = { _id: agentId, deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }
    const agent = await this.agentModel.findOne(query);
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async update(tenantId: string, agentId: string, dto: UpdateAgentDto) {
    const filter: any = { _id: agentId, deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const agent = await this.agentModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true },
    );
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    await this.cache.del(`agent:public:${agentId}`);
    return agent;
  }

  async remove(tenantId: string, agentId: string) {
    const filter: any = { _id: agentId };
    if (tenantId && tenantId !== 'all') {
      filter.tenantId = tenantId;
    }
    const agent = await this.agentModel.findOneAndUpdate(
      filter,
      { deletedAt: new Date(), status: 'inactive' },
      { new: true },
    );
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    await this.cache.del(`agent:public:${agentId}`);
    return { message: 'Agent deleted' };
  }

  async duplicate(tenantId: string, agentId: string) {
    const original = await this.findById(tenantId, agentId);
    const data = original.toObject();
    delete data._id;
    delete data.createdAt;
    delete data.updatedAt;
    data.name = `${data.name} (Copy)`;
    data.status = 'draft';
    return this.agentModel.create(data);
  }

  async getPublicConfig(agentId: string) {
    const cacheKey = `agent:public:${agentId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const agent = await this.agentModel
      .findOne({ _id: agentId, status: 'active', deletedAt: null })
      .select('name welcomeMessage widgetConfig leadCaptureFields tenantId');

    if (!agent) {
      throw new NotFoundException('Agent not found or inactive');
    }

    await this.cache.set(cacheKey, agent.toObject(), 300); // 5min cache
    return agent;
  }
}
