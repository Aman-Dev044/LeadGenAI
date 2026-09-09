import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventBusService, PlatformEvents } from '../../common/events';
import { CreateScoringRuleDto } from './dto';

@Injectable()
export class LeadScoreService {
  private readonly logger = new Logger(LeadScoreService.name);

  constructor(
    @InjectModel('ScoringRule') private readonly ruleModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    private readonly bus: EventBusService,
  ) {}

  async createRule(tenantId: string, dto: CreateScoringRuleDto) {
    return this.ruleModel.create({ tenantId, ...dto });
  }

  async findAllRules(tenantId: string) {
    return this.ruleModel
      .find({ tenantId })
      .sort({ order: 1 })
      .lean();
  }

  async updateRule(tenantId: string, ruleId: string, dto: Partial<CreateScoringRuleDto>) {
    const rule = await this.ruleModel.findOneAndUpdate(
      { _id: ruleId, tenantId },
      { $set: dto },
      { new: true },
    );
    if (!rule) {
      throw new NotFoundException('Scoring rule not found');
    }
    return rule;
  }

  async deleteRule(tenantId: string, ruleId: string) {
    const rule = await this.ruleModel.findOneAndDelete({
      _id: ruleId,
      tenantId,
    });
    if (!rule) {
      throw new NotFoundException('Scoring rule not found');
    }
    return { message: 'Scoring rule deleted' };
  }

  async scoreLead(tenantId: string, leadId: string) {
    const lead = await this.leadModel.findOne({
      _id: leadId,
      tenantId,
      deletedAt: null,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const rules = await this.ruleModel.find({ tenantId, isActive: true }).lean();
    let totalScore = 0;
    const appliedRules: { rule: string; points: number }[] = [];

    for (const rule of rules) {
      const points = await this.evaluateRule(rule, lead, tenantId);
      if (points > 0) {
        totalScore += points;
        appliedRules.push({ rule: rule.name, points });
      }
    }

    // Determine temperature based on score
    let temperature = 'cold';
    if (totalScore >= 70) temperature = 'hot';
    else if (totalScore >= 40) temperature = 'warm';

    const oldScore = lead.score || 0;
    const oldTemperature = lead.temperature || 'cold';
    const changed = oldScore !== totalScore || oldTemperature !== temperature;

    if (changed) {
      lead.score = totalScore;
      lead.temperature = temperature;
      lead.lastActivityAt = new Date();
      await lead.save();

      await this.activityModel.create({
        tenantId,
        leadId,
        type: 'score_updated',
        description: `Score updated from ${oldScore} to ${totalScore} (${temperature})`,
        oldValue: oldScore,
        newValue: totalScore,
      });

      this.bus.emit(PlatformEvents.LEAD_SCORED, { tenantId, lead, oldScore, oldTemperature, appliedRules });
    }

    return { score: totalScore, temperature, appliedRules, changed };
  }

  async scoreAllLeads(tenantId: string) {
    const leads = await this.leadModel.find({
      tenantId,
      deletedAt: null,
    });

    const results: any[] = [];
    for (const lead of leads) {
      try {
        const result = await this.scoreLead(tenantId, lead._id.toString());
        results.push({ leadId: lead._id, ...result });
      } catch (err: any) {
        this.logger.warn(`Failed to score lead ${lead._id}: ${err.message}`);
      }
    }

    return { scored: results.length, results };
  }

  private async evaluateRule(rule: any, lead: any, tenantId: string): Promise<number> {
    switch (rule.condition) {
      case 'has_email':
        return lead.email ? rule.points : 0;

      case 'has_phone':
        return lead.phone ? rule.points : 0;

      case 'field_match': {
        const { field, value } = rule.conditionConfig || {};
        if (!field) return 0;
        const leadValue = lead.customFields?.[field] || lead[field];
        if (leadValue === value) return rule.points;
        return 0;
      }

      case 'conversation_count': {
        const minCount = rule.conditionConfig?.min || 1;
        const count = await this.conversationModel.countDocuments({
          tenantId,
          leadId: lead._id.toString(),
        });
        return count >= minCount ? rule.points : 0;
      }

      case 'message_count': {
        const minMessages = rule.conditionConfig?.min || 5;
        const conversations = await this.conversationModel.find({
          tenantId,
          leadId: lead._id.toString(),
        });
        let total = 0;
        for (const conv of conversations) {
          total += conv.messageCount || 0;
        }
        return total >= minMessages ? rule.points : 0;
      }

      case 'keyword_match': {
        const keywords: string[] = rule.conditionConfig?.keywords || [];
        if (keywords.length === 0) return 0;
        const messages = await this.messageModel.find({
          tenantId,
          conversationId: { $in: lead.conversationIds || [] },
          sender: 'visitor',
        }).select('content').lean();

        const allContent = messages.map((m: any) => m.content).join(' ').toLowerCase();
        const matched = keywords.some((kw) => allContent.includes(kw.toLowerCase()));
        return matched ? rule.points : 0;
      }

      default:
        return 0;
    }
  }
}
