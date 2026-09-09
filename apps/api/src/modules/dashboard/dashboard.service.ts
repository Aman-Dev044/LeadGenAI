import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from '../../providers/redis/cache.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Agent') private readonly agentModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly cache: CacheService,
  ) {}

  async getOverview(tenantId: string) {
    const cacheKey = `dashboard:overview:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [totalLeads, totalConversations, activeAgents, totalUsers] =
      await Promise.all([
        this.leadModel.countDocuments({ tenantId, deletedAt: null }),
        this.conversationModel.countDocuments({ tenantId }),
        this.agentModel.countDocuments({ tenantId, status: 'active', deletedAt: null }),
        this.userModel.countDocuments({ tenantId, isActive: true, deletedAt: null }),
      ]);

    const leadsByStatus = await this.leadModel.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const leadsByTemperature = await this.leadModel.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$temperature', count: { $sum: 1 } } },
    ]);

    const result = {
      totalLeads,
      totalConversations,
      activeAgents,
      totalUsers,
      leadsByStatus: Object.fromEntries(leadsByStatus.map((s) => [s._id, s.count])),
      leadsByTemperature: Object.fromEntries(leadsByTemperature.map((t) => [t._id, t.count])),
    };

    await this.cache.set(cacheKey, result, 10); // 10s cache
    return result;
  }

  async getLeadStats(tenantId: string, days = 30) {
    const cacheKey = `dashboard:leadstats:${tenantId}:${days}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyLeads = await this.leadModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topSources = await this.leadModel.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const avgScore = await this.leadModel.aggregate([
      { $match: { tenantId, deletedAt: null, score: { $gt: 0 } } },
      { $group: { _id: null, avgScore: { $avg: '$score' } } },
    ]);

    const leadStatsResult = {
      dailyLeads,
      topSources,
      averageScore: avgScore[0]?.avgScore || 0,
    };

    await this.cache.set(cacheKey, leadStatsResult, 15);
    return leadStatsResult;
  }

  async getConversationStats(tenantId: string, days = 30) {
    const convCacheKey = `dashboard:convstats:${tenantId}:${days}`;
    const convCached = await this.cache.get(convCacheKey);
    if (convCached) return convCached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyConversations = await this.conversationModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byStatus = await this.conversationModel.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const avgMessages = await this.conversationModel.aggregate([
      { $match: { tenantId } },
      { $group: { _id: null, avg: { $avg: '$messageCount' } } },
    ]);

    const convStatsResult = {
      dailyConversations,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      averageMessagesPerConversation: Math.round(avgMessages[0]?.avg || 0),
    };

    await this.cache.set(convCacheKey, convStatsResult, 15);
    return convStatsResult;
  }

  async getAgentStats(tenantId: string) {
    const agentCacheKey = `dashboard:agentstats:${tenantId}`;
    const agentCached = await this.cache.get(agentCacheKey);
    if (agentCached) return agentCached;

    const agents = await this.agentModel.find({
      tenantId,
      deletedAt: null,
    }).lean();

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const conversationCount = await this.conversationModel.countDocuments({
          tenantId,
          agentId: (agent as any)._id.toString(),
        });

        return {
          id: agent._id,
          name: agent.name,
          status: agent.status,
          conversationCount,
        };
      }),
    );

    await this.cache.set(agentCacheKey, stats, 15);
    return stats;
  }
}
