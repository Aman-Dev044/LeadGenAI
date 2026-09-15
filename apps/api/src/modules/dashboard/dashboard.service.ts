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
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    private readonly cache: CacheService,
  ) {}

  async getOverview(tenantId: string, assignedToUserId?: string) {
    const cacheKey = `dashboard:overview:${tenantId}:${assignedToUserId || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const baseTenant = tenantId && tenantId !== 'all' ? { tenantId } : {};

    let tLead: any = { ...baseTenant, deletedAt: null };
    let tConv: any = { ...baseTenant };
    let totalAppointments = 0;

    if (assignedToUserId) {
      tLead.assignedTo = assignedToUserId;

      const ownedLeads = await this.leadModel.find(tLead).distinct('_id');
      const ownedLeadIdStrs = ownedLeads.map((id: any) => String(id));

      tConv = {
        ...baseTenant,
        $or: [
          { assignedUserId: assignedToUserId },
          { leadId: { $in: ownedLeadIdStrs } },
        ],
      };

      totalAppointments = await this.appointmentModel.countDocuments({
        ...baseTenant,
        assignedTo: assignedToUserId,
        status: { $in: ['scheduled', 'confirmed'] },
      });
    }

    const tAgent = tenantId && tenantId !== 'all' ? { tenantId, status: 'active', deletedAt: null } : { status: 'active', deletedAt: null };
    const tUser = tenantId && tenantId !== 'all' ? { tenantId, isActive: true, deletedAt: null } : { isActive: true, deletedAt: null };

    const [totalLeads, totalConversations, activeAgents, totalUsers] =
      await Promise.all([
        this.leadModel.countDocuments(tLead),
        this.conversationModel.countDocuments(tConv),
        this.agentModel.countDocuments(tAgent),
        this.userModel.countDocuments(tUser),
      ]);

    const leadsByStatus = await this.leadModel.aggregate([
      { $match: tLead },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const leadsByTemperature = await this.leadModel.aggregate([
      { $match: tLead },
      { $group: { _id: '$temperature', count: { $sum: 1 } } },
    ]);

    const result = {
      totalLeads,
      totalConversations,
      activeAgents,
      totalUsers,
      totalAppointments,
      isScoped: !!assignedToUserId,
      leadsByStatus: Object.fromEntries(leadsByStatus.map((s) => [s._id, s.count])),
      leadsByTemperature: Object.fromEntries(leadsByTemperature.map((t) => [t._id, t.count])),
    };

    await this.cache.set(cacheKey, result, 10); // 10s cache
    return result;
  }

  async getLeadStats(tenantId: string, days = 30, assignedToUserId?: string) {
    const cacheKey = `dashboard:leadstats:${tenantId}:${days}:${assignedToUserId || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const match: any = {
      deletedAt: null,
      createdAt: { $gte: startDate },
    };
    if (tenantId && tenantId !== 'all') match.tenantId = tenantId;
    if (assignedToUserId) match.assignedTo = assignedToUserId;

    const matchAllTime: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') matchAllTime.tenantId = tenantId;
    if (assignedToUserId) matchAllTime.assignedTo = assignedToUserId;

    const dailyLeads = await this.leadModel.aggregate([
      { $match: match },
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
      { $match: matchAllTime },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const avgScore = await this.leadModel.aggregate([
      { $match: { ...matchAllTime, score: { $gt: 0 } } },
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

  async getConversationStats(tenantId: string, days = 30, assignedToUserId?: string) {
    const convCacheKey = `dashboard:convstats:${tenantId}:${days}:${assignedToUserId || 'all'}`;
    const convCached = await this.cache.get(convCacheKey);
    if (convCached) return convCached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let matchConv: any = {};
    if (tenantId && tenantId !== 'all') matchConv.tenantId = tenantId;

    if (assignedToUserId) {
      const ownedLeads = await this.leadModel
        .find({ tenantId, assignedTo: assignedToUserId, deletedAt: null })
        .distinct('_id');
      const ownedLeadIdStrs = ownedLeads.map((id: any) => String(id));

      matchConv.$or = [
        { assignedUserId: assignedToUserId },
        { leadId: { $in: ownedLeadIdStrs } },
      ];
    }

    const matchDate = {
      ...matchConv,
      createdAt: { $gte: startDate },
    };

    const dailyConversations = await this.conversationModel.aggregate([
      {
        $match: matchDate,
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
      { $match: matchConv },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const avgMessages = await this.conversationModel.aggregate([
      { $match: matchConv },
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
