import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsQueryDto } from './dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Agent') private readonly agentModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('PageView') private readonly pageViewModel: Model<any>,
    @InjectModel('Handoff') private readonly handoffModel: Model<any>,
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
  ) {}

  private getPeriodStart(query: AnalyticsQueryDto): Date {
    if (query.period === 'custom' && query.from) {
      return new Date(query.from);
    }
    const now = new Date();
    const days = query.period === '7d' ? 7 : query.period === '90d' ? 90 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private tMatch(tenantId: string): Record<string, any> {
    return tenantId && tenantId !== 'all' ? { tenantId } : {};
  }

  async getOverview(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    const [
      totalVisitors,
      totalConversations,
      totalLeads,
      qualifiedLeads,
      hotLeads,
      handoffCount,
      appointmentCount,
    ] = await Promise.all([
      this.pageViewModel.distinct('visitorId', {
        ...tm,
        createdAt: { $gte: periodStart },
      }).then((ids) => ids.length),
      this.conversationModel.countDocuments({
        ...tm,
        createdAt: { $gte: periodStart },
      }),
      this.leadModel.countDocuments({
        ...tm,
        deletedAt: null,
        createdAt: { $gte: periodStart },
      }),
      this.leadModel.countDocuments({
        ...tm,
        deletedAt: null,
        status: 'qualified',
        createdAt: { $gte: periodStart },
      }),
      this.leadModel.countDocuments({
        ...tm,
        deletedAt: null,
        temperature: 'hot',
        createdAt: { $gte: periodStart },
      }),
      this.handoffModel.countDocuments({
        ...tm,
        createdAt: { $gte: periodStart },
      }),
      this.appointmentModel.countDocuments({
        ...tm,
        createdAt: { $gte: periodStart },
      }),
    ]);

    const avgScore = await this.leadModel.aggregate([
      { $match: { ...tm, deletedAt: null, score: { $gt: 0 }, createdAt: { $gte: periodStart } } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]);

    const conversionRate = totalConversations > 0
      ? ((totalLeads / totalConversations) * 100).toFixed(1)
      : '0';

    const widgetEngagement = totalVisitors > 0
      ? ((totalConversations / totalVisitors) * 100).toFixed(1)
      : '0';

    return {
      totalVisitors,
      totalConversations,
      totalLeads,
      qualifiedLeads,
      hotLeads,
      handoffCount,
      appointmentCount,
      averageLeadScore: Math.round(avgScore[0]?.avg || 0),
      conversionRate: parseFloat(conversionRate),
      widgetEngagement: parseFloat(widgetEngagement),
    };
  }

  async getLeadAnalytics(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    const [byStatus, byTemperature, scoreDistribution] = await Promise.all([
      this.leadModel.aggregate([
        { $match: { ...tm, deletedAt: null, createdAt: { $gte: periodStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.leadModel.aggregate([
        { $match: { ...tm, deletedAt: null, createdAt: { $gte: periodStart } } },
        { $group: { _id: '$temperature', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
      ]),
      this.leadModel.aggregate([
        { $match: { ...tm, deletedAt: null, createdAt: { $gte: periodStart } } },
        {
          $bucket: {
            groupBy: '$score',
            boundaries: [0, 20, 40, 60, 80, 101],
            default: 'unknown',
            output: { count: { $sum: 1 } },
          },
        },
      ]),
    ]);

    return { byStatus, byTemperature, scoreDistribution };
  }

  async getConversationAnalytics(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    const [byStatus, avgDuration, avgMessages] = await Promise.all([
      this.conversationModel.aggregate([
        { $match: { ...tm, createdAt: { $gte: periodStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.conversationModel.aggregate([
        {
          $match: {
            ...tm,
            createdAt: { $gte: periodStart },
            endedAt: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            avgDurationMs: {
              $avg: { $subtract: ['$endedAt', '$createdAt'] },
            },
          },
        },
      ]),
      this.conversationModel.aggregate([
        { $match: { ...tm, createdAt: { $gte: periodStart } } },
        { $group: { _id: null, avg: { $avg: '$messageCount' } } },
      ]),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((s: any) => [s._id, s.count])),
      averageDurationMinutes: Math.round((avgDuration[0]?.avgDurationMs || 0) / 60000),
      averageMessagesPerConversation: Math.round(avgMessages[0]?.avg || 0),
    };
  }

  async getAgentPerformance(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    const agents = await this.agentModel.find({ ...tm, deletedAt: null }).lean();

    return Promise.all(
      agents.map(async (agent: any) => {
        const [conversations, totalMessages, handoffs] = await Promise.all([
          this.conversationModel.countDocuments({
            ...tm,
            agentId: agent._id.toString(),
            createdAt: { $gte: periodStart },
          }),
          this.messageModel.countDocuments({
            ...tm,
            sender: 'bot',
            createdAt: { $gte: periodStart },
          }),
          this.handoffModel.countDocuments({
            ...tm,
            agentId: agent._id.toString(),
            createdAt: { $gte: periodStart },
          }),
        ]);

        return {
          id: agent._id,
          name: agent.name,
          status: agent.status,
          conversations,
          totalMessages,
          handoffs,
          handoffRate: conversations > 0
            ? parseFloat(((handoffs / conversations) * 100).toFixed(1))
            : 0,
        };
      }),
    );
  }

  async getSourceBreakdown(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    return this.leadModel.aggregate([
      { $match: { ...tm, deletedAt: null, createdAt: { $gte: periodStart } } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
          hotLeads: { $sum: { $cond: [{ $eq: ['$temperature', 'hot'] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
  }

  async getTrends(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    const [leadTrend, conversationTrend] = await Promise.all([
      this.leadModel.aggregate([
        { $match: { ...tm, deletedAt: null, createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            leads: { $sum: 1 },
            avgScore: { $avg: '$score' },
            hotLeads: { $sum: { $cond: [{ $eq: ['$temperature', 'hot'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.conversationModel.aggregate([
        { $match: { ...tm, createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            conversations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return { leadTrend, conversationTrend };
  }

  async getTeamPerformance(tenantId: string, query: AnalyticsQueryDto) {
    const periodStart = this.getPeriodStart(query);
    const tm = this.tMatch(tenantId);

    return this.leadModel.aggregate([
      {
        $match: {
          ...tm,
          deletedAt: null,
          assignedTo: { $exists: true, $ne: null },
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          totalLeads: { $sum: 1 },
          avgScore: { $avg: '$score' },
          convertedLeads: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
          hotLeads: {
            $sum: { $cond: [{ $eq: ['$temperature', 'hot'] }, 1, 0] },
          },
        },
      },
      { $sort: { convertedLeads: -1 } },
    ]);
  }
}
