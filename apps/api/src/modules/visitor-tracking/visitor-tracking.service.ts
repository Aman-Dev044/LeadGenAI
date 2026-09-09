import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class VisitorTrackingService {
  constructor(
    @InjectModel('PageView') private readonly pageViewModel: Model<any>,
    @InjectModel('Agent') private readonly agentModel: Model<any>,
  ) {}

  async recordPageView(data: {
    agentId: string;
    visitorId: string;
    url: string;
    title?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
    utm?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
    };
  }) {
    // Validate agent exists and get tenantId
    const agent = await this.agentModel
      .findOne({ _id: data.agentId, status: 'active', deletedAt: null })
      .select('tenantId');

    if (!agent) return null;

    // Debounce: skip if same visitor+url within last 30 seconds
    const recentView = await this.pageViewModel.findOne({
      tenantId: agent.tenantId,
      visitorId: data.visitorId,
      url: data.url,
      createdAt: { $gte: new Date(Date.now() - 30000) },
    });

    if (recentView) return recentView;

    return this.pageViewModel.create({
      tenantId: agent.tenantId,
      visitorId: data.visitorId,
      url: data.url,
      title: data.title,
      referrer: data.referrer,
      userAgent: data.userAgent,
      ip: data.ip,
      utm: data.utm,
    });
  }

  async getVisitorHistory(tenantId: string, visitorId: string) {
    return this.pageViewModel
      .find({ tenantId, visitorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async getTopPages(tenantId: string, days = 30) {
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.pageViewModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: periodStart } } },
      {
        $group: {
          _id: '$url',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorId' },
        },
      },
      {
        $project: {
          url: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]);
  }

  async getVisitorCount(tenantId: string, days = 30) {
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.pageViewModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: periodStart } } },
      { $group: { _id: '$visitorId' } },
      { $count: 'total' },
    ]);

    return { uniqueVisitors: result[0]?.total || 0 };
  }
}
