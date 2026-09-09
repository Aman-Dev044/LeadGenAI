import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UsageMeterService {
  private readonly logger = new Logger(UsageMeterService.name);

  constructor(
    @InjectModel('UsageRecord') private readonly usageModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('KnowledgeSource') private readonly kbSourceModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  async getCurrentUsage(tenantId: string) {
    const period = this.getCurrentPeriod();

    let record = await this.usageModel.findOne({ tenantId, period });

    if (!record || this.isStale(record.lastCalculatedAt)) {
      record = await this.calculateUsage(tenantId, period);
    }

    return record;
  }

  async calculateUsage(tenantId: string, period?: string) {
    const currentPeriod = period || this.getCurrentPeriod();
    const periodStart = new Date(`${currentPeriod}-01`);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [conversations, leads, messages, kbSources, emailsSent, smsSent] = await Promise.all([
      this.conversationModel.countDocuments({
        tenantId,
        createdAt: { $gte: periodStart, $lt: periodEnd },
      }),
      this.leadModel.countDocuments({
        tenantId,
        deletedAt: null,
        createdAt: { $gte: periodStart, $lt: periodEnd },
      }),
      this.messageModel.countDocuments({
        tenantId,
        createdAt: { $gte: periodStart, $lt: periodEnd },
      }),
      this.kbSourceModel.countDocuments({
        tenantId,
        deletedAt: null,
      }),
      this.notificationModel.countDocuments({
        tenantId,
        channel: 'email',
        status: { $in: ['sent', 'delivered'] },
        createdAt: { $gte: periodStart, $lt: periodEnd },
      }),
      this.notificationModel.countDocuments({
        tenantId,
        channel: 'sms',
        status: { $in: ['sent', 'delivered'] },
        createdAt: { $gte: periodStart, $lt: periodEnd },
      }),
    ]);

    // Calculate AI token usage from messages
    const tokenAgg = await this.messageModel.aggregate([
      {
        $match: {
          tenantId,
          'tokenUsage.totalTokens': { $exists: true },
          createdAt: { $gte: periodStart, $lt: periodEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
        },
      },
    ]);

    const usage = {
      conversations,
      leads,
      messages,
      kbSources,
      kbStorageMB: 0, // Would calculate from S3
      aiTokensUsed: tokenAgg[0]?.totalTokens || 0,
      emailsSent,
      smsSent,
    };

    const record = await this.usageModel.findOneAndUpdate(
      { tenantId, period: currentPeriod },
      {
        $set: { usage, lastCalculatedAt: new Date() },
      },
      { upsert: true, new: true },
    );

    return record;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private isStale(lastCalculated: Date | undefined): boolean {
    if (!lastCalculated) return true;
    return Date.now() - lastCalculated.getTime() > 60 * 60 * 1000; // 1 hour
  }
}
