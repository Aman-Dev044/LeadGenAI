import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeadService } from '../lead/lead.service';
import { NotificationService } from '../notification/notification.service';
import { AiQualifierService, SERVICE_LABELS } from './ai-qualifier.service';
import { LeadSourceRegistry } from './providers/lead-source.registry';
import { RawProspect } from './providers/lead-source.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { escapeRegex } from '../../common/utils/sanitize';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ImportScrapedLeadsDto,
  RejectScrapedLeadsDto,
} from './dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard ceiling per run so a mis-typed campaign cannot burn the Places quota. */
const ABSOLUTE_MAX_RESULTS = 200;
/** We over-fetch because filters discard most raw results. */
const OVERFETCH_FACTOR = 3;

type Actor = { userId?: string; role?: string };

@Injectable()
export class LeadAutomationService {
  private readonly logger = new Logger(LeadAutomationService.name);

  /** Campaign ids currently executing in this process - guards double-clicks. */
  private readonly running = new Set<string>();

  constructor(
    @InjectModel('ScrapingCampaign') private readonly campaignModel: Model<any>,
    @InjectModel('ScrapedLead') private readonly scrapedLeadModel: Model<any>,
    @InjectModel('ScrapingRun') private readonly runModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly sources: LeadSourceRegistry,
    private readonly qualifier: AiQualifierService,
    private readonly leadService: LeadService,
    private readonly notificationService: NotificationService,
  ) {}

  // Campaigns

  async createCampaign(tenantId: string, dto: CreateCampaignDto, createdBy?: string) {
    const campaign = await this.campaignModel.create({
      ...dto,
      tenantId,
      createdBy,
      maxResultsPerRun: Math.min(dto.maxResultsPerRun || 60, ABSOLUTE_MAX_RESULTS),
      nextRunAt: this.computeNextRun(dto.schedule),
    });
    return campaign;
  }

  async findCampaigns(tenantId: string, paginationDto: PaginationDto) {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    if (paginationDto.search) {
      query.name = { $regex: escapeRegex(paginationDto.search), $options: 'i' };
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 20;
    const [data, total] = await Promise.all([
      this.campaignModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.campaignModel.countDocuments(query),
    ]);

    // Pending counts drive the "needs review" badge in the list.
    const pending = await this.scrapedLeadModel.aggregate([
      { $match: { campaignId: { $in: data.map((c: any) => String(c._id)) }, status: 'new' } },
      { $group: { _id: '$campaignId', count: { $sum: 1 } } },
    ]);
    const pendingMap = new Map(pending.map((p: any) => [p._id, p.count]));

    const totalPages = Math.ceil(total / limit);
    return {
      data: data.map((c: any) => ({ ...c, pendingCount: pendingMap.get(String(c._id)) || 0 })),
      total,
      totalPages,
      page,
      limit,
      meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  async findCampaign(tenantId: string, campaignId: string) {
    const query: any = { _id: campaignId, deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const campaign = await this.campaignModel.findOne(query).lean();
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async updateCampaign(tenantId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.campaignModel.findOne({ _id: campaignId, tenantId, deletedAt: null });
    if (!campaign) throw new NotFoundException('Campaign not found');

    Object.assign(campaign, dto);
    if (dto.maxResultsPerRun) {
      campaign.maxResultsPerRun = Math.min(dto.maxResultsPerRun, ABSOLUTE_MAX_RESULTS);
    }
    if (dto.schedule || dto.status) {
      campaign.nextRunAt =
        campaign.status === 'paused' ? null : this.computeNextRun(campaign.schedule);
    }
    await campaign.save();
    return campaign;
  }

  async deleteCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: campaignId, tenantId, deletedAt: null },
      { $set: { deletedAt: new Date(), status: 'paused', nextRunAt: null } },
      { new: true },
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    return { success: true };
  }

  /** Sources and whether their API key is present - the UI warns when it is not. */
  listSources() {
    return {
      sources: this.sources.list(),
      serviceTypes: Object.entries(SERVICE_LABELS).map(([id, label]) => ({ id, label })),
    };
  }

  /** Preview the Google Maps queries a campaign config would run, without spending quota. */
  async previewQueries(dto: {
    serviceTypes?: string[];
    businessCategories?: string[];
    locations?: string[];
    extraQueries?: string[];
    regionCode?: string;
  }) {
    const queries = await this.qualifier.buildQueries(dto);
    return { queries, count: queries.length };
  }

  // Runs

  async listRuns(tenantId: string, campaignId: string, limit = 20) {
    const query: any = { campaignId };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    return this.runModel.find(query).sort({ createdAt: -1 }).limit(Math.min(limit, 50)).lean();
  }

  /**
   * Executes a campaign end to end. Kicked off by the controller (manual) or the
   * scheduler; the HTTP caller gets the run document back immediately and polls it.
   */
  async startRun(
    tenantId: string,
    campaignId: string,
    trigger: 'manual' | 'schedule',
    triggeredBy?: string,
  ) {
    const campaign = await this.campaignModel.findOne({ _id: campaignId, tenantId, deletedAt: null });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const provider = this.sources.default();
    if (!provider.isConfigured()) {
      throw new BadRequestException(
        'Google Places API key is missing. Add GOOGLE_PLACES_API_KEY to the API environment.',
      );
    }

    const key = String(campaign._id);
    if (this.running.has(key)) {
      throw new BadRequestException('This campaign is already running');
    }

    const run = await this.runModel.create({
      tenantId,
      campaignId: key,
      status: 'running',
      trigger,
      triggeredBy,
      startedAt: new Date(),
    });

    this.running.add(key);
    // Fire and forget: the dashboard polls the run document for progress.
    void this.executeRun(campaign, run)
      .catch(async (err: any) => {
        this.logger.error(`Campaign ${key} failed: ${err?.message}`);
        await this.runModel.updateOne(
          { _id: run._id },
          { $set: { status: 'failed', error: err?.message || 'Run failed', finishedAt: new Date() } },
        );
        await this.campaignModel.updateOne(
          { _id: campaign._id },
          { $set: { lastError: err?.message || 'Run failed' } },
        );
      })
      .finally(() => this.running.delete(key));

    return run;
  }

  private async executeRun(campaign: any, run: any) {
    const tenantId = campaign.tenantId;
    const campaignId = String(campaign._id);
    const provider = this.sources.default();
    const warnings: string[] = [];
    const stats = {
      fetched: 0,
      duplicates: 0,
      filteredOut: 0,
      saved: 0,
      newListings: 0,
      aiScored: 0,
      autoImported: 0,
      apiCalls: 0,
    };

    const maxResults = Math.min(campaign.maxResultsPerRun || 60, ABSOLUTE_MAX_RESULTS);
    const queries = await this.qualifier.buildQueries(campaign);
    if (!queries.length) {
      throw new BadRequestException('Campaign has no business categories or locations to search');
    }
    await this.runModel.updateOne({ _id: run._id }, { $set: { queries } });

    // 1. Collect raw results, de-duplicated by place id across queries.
    const collected = new Map<string, RawProspect>();
    const fetchBudget = maxResults * OVERFETCH_FACTOR;
    const perQuery = Math.max(10, Math.ceil(fetchBudget / queries.length));

    for (const query of queries) {
      if (collected.size >= fetchBudget) break;
      const result = await provider.search({
        query,
        languageCode: campaign.languageCode || 'en',
        regionCode: campaign.regionCode || '',
        limit: Math.min(perQuery, fetchBudget - collected.size),
      });
      stats.apiCalls += result.apiCalls;
      warnings.push(...result.warnings);
      for (const prospect of result.prospects) {
        if (!collected.has(prospect.externalId)) collected.set(prospect.externalId, prospect);
      }
    }
    stats.fetched = collected.size;

    // 2. Drop anything this campaign already holds.
    const seenIds = await this.scrapedLeadModel
      .find({ tenantId, campaignId, externalId: { $in: [...collected.keys()] } })
      .select('externalId')
      .lean();
    for (const row of seenIds) {
      collected.delete(row.externalId);
      stats.duplicates++;
    }

    // 3. Cheap filters - everything decidable without extra API spend.
    const filters = campaign.filters || {};
    let candidates = [...collected.values()].filter((p) => {
      if (filters.operationalOnly !== false && p.businessStatus && p.businessStatus !== 'OPERATIONAL') {
        return false;
      }
      if (filters.requireNoWebsite && p.website) return false;
      if (filters.requirePhone !== false && !p.phone) return false;
      if (filters.maxReviewCount > 0 && (p.reviewCount || 0) > filters.maxReviewCount) return false;
      // A brand new listing has no rating yet, so only judge rating once reviews exist.
      if (filters.minRating > 0 && (p.reviewCount || 0) > 0 && (p.rating || 0) < filters.minRating) {
        return false;
      }
      return true;
    });
    stats.filteredOut = collected.size - candidates.length;

    // Keep the freshest-looking listings first, then cap before paying for details.
    candidates.sort((a, b) => (a.reviewCount || 0) - (b.reviewCount || 0));
    candidates = candidates.slice(0, maxResults);

    // 4. Review history (second, pricier API pass) only when listing age matters.
    if (candidates.length && filters.newListingMaxAgeDays > 0) {
      const enrich = await provider.enrichReviews(candidates, campaign.languageCode || 'en');
      stats.apiCalls += enrich.apiCalls;
      warnings.push(...enrich.warnings);
    }

    // 5. Decide which listings look new, and enforce onlyNewListings.
    const firstSeen = await this.firstSeenMap(tenantId, candidates.map((c) => c.externalId));
    const evaluated = candidates.map((prospect) => ({
      prospect,
      ...this.evaluateNewness(prospect, filters, firstSeen.has(prospect.externalId)),
    }));

    let kept = evaluated;
    if (filters.onlyNewListings !== false) {
      kept = evaluated.filter((e) => e.isNewListing);
      stats.filteredOut += evaluated.length - kept.length;
    }

    // 6. AI qualification.
    const aiConfig = campaign.aiQualification || {};
    let qualifications = new Map<string, any>();
    if (aiConfig.enabled !== false && kept.length) {
      const tenant = await this.tenantModel.findById(tenantId).select('name').lean();
      qualifications = await this.qualifier.qualify(
        kept.map((k) => k.prospect),
        {
          serviceTypes: campaign.serviceTypes || [],
          generateOutreach: aiConfig.generateOutreach !== false,
          tenantName: (tenant as any)?.name,
        },
      );
      stats.aiScored = qualifications.size;

      const minScore = aiConfig.minScore || 0;
      if (minScore > 0) {
        const before = kept.length;
        // Keep anything the model failed to score rather than silently losing it.
        kept = kept.filter((k) => {
          const q = qualifications.get(k.prospect.externalId);
          return !q || q.score >= minScore;
        });
        stats.filteredOut += before - kept.length;
      }
    }

    // 7. Persist.
    const now = new Date();
    const docs = kept.map(({ prospect, isNewListing, signals }) => {
      const q = qualifications.get(prospect.externalId);
      if (isNewListing) stats.newListings++;
      return {
        tenantId,
        campaignId,
        runId: String(run._id),
        source: provider.id,
        externalId: prospect.externalId,
        sourceUrl: prospect.sourceUrl,
        businessName: prospect.businessName,
        category: prospect.category,
        categories: prospect.categories || [],
        phone: prospect.phone,
        website: prospect.website,
        email: prospect.email,
        address: prospect.address,
        city: prospect.city,
        state: prospect.state,
        country: prospect.country,
        postalCode: prospect.postalCode,
        location: prospect.location || {},
        rating: prospect.rating || 0,
        reviewCount: prospect.reviewCount || 0,
        businessStatus: prospect.businessStatus,
        oldestReviewAt: prospect.oldestReviewAt,
        newestReviewAt: prospect.newestReviewAt,
        reviewSamples: prospect.reviewSamples || [],
        isNewListing,
        newListingSignals: signals,
        firstSeenAt: firstSeen.get(prospect.externalId) || now,
        ai: q
          ? {
              score: q.score,
              temperature: q.temperature,
              fitReason: q.fitReason,
              recommendedService: q.recommendedService,
              painPoints: q.painPoints,
              outreachMessage: q.outreachMessage,
              generatedAt: now,
            }
          : {},
        status: 'new',
        raw: prospect.raw,
      };
    });

    let inserted: any[] = [];
    if (docs.length) {
      try {
        inserted = await this.scrapedLeadModel.insertMany(docs, { ordered: false });
      } catch (err: any) {
        // A concurrent run can win the unique index race; keep whatever landed.
        inserted = err?.insertedDocs || [];
        if (!err?.writeErrors) throw err;
        warnings.push(`${err.writeErrors.length} duplicate(s) skipped`);
      }
      stats.saved = inserted.length;
    }

    // 8. Optional straight-to-pipeline import.
    if (campaign.autoImport && inserted.length) {
      const result = await this.importScraped(
        tenantId,
        inserted.map((d: any) => String(d._id)),
        undefined,
        campaign,
      );
      stats.autoImported = result.imported;
    }

    await this.runModel.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'completed',
          finishedAt: new Date(),
          stats,
          warnings: warnings.slice(0, 20),
        },
      },
    );

    await this.campaignModel.updateOne(
      { _id: campaign._id },
      {
        $set: {
          lastRunAt: new Date(),
          lastError: '',
          nextRunAt: campaign.status === 'paused' ? null : this.computeNextRun(campaign.schedule),
        },
        // `stats.totalImported` is owned by importScraped(), which already counted
        // anything auto-imported above - incrementing it here would double it.
        $inc: {
          'stats.totalRuns': 1,
          'stats.totalFound': stats.fetched,
          'stats.totalNew': stats.saved,
        },
      },
    );

    if (stats.saved > 0) {
      await this.notifyRunFinished(tenantId, campaign, stats);
    }
  }

  private async notifyRunFinished(tenantId: string, campaign: any, stats: { saved: number; newListings: number }) {
    try {
      await this.notificationService.notifyTenant(
        tenantId,
        {
          title: `${stats.saved} new prospects from "${campaign.name}"`,
          body: `${stats.newListings} look like recently listed businesses. Review them in AI Automation.`,
          type: 'system_alert',
          data: { campaignId: String(campaign._id), kind: 'lead_automation_run' },
        } as any,
        { channels: false },
      );
    } catch (err: any) {
      this.logger.warn(`Run notification failed: ${err?.message}`);
    }
  }

  /**
   * Earliest time this tenant saw each place, across every campaign. A place with
   * no history is appearing on Maps for us for the first time.
   */
  private async firstSeenMap(tenantId: string, externalIds: string[]): Promise<Map<string, Date>> {
    if (!externalIds.length) return new Map();
    const rows = await this.scrapedLeadModel.aggregate([
      { $match: { tenantId, externalId: { $in: externalIds } } },
      { $group: { _id: '$externalId', firstSeenAt: { $min: '$firstSeenAt' } } },
    ]);
    return new Map(rows.map((r: any) => [r._id, r.firstSeenAt]));
  }

  /**
   * Google exposes no "listing created" date, so newness is inferred from review
   * volume, the age of the oldest visible review, and whether we have ever seen
   * the place before. Each reason is recorded so the dashboard can show its work.
   */
  private evaluateNewness(
    prospect: RawProspect,
    filters: any,
    seenBefore: boolean,
  ): { isNewListing: boolean; signals: string[] } {
    const signals: string[] = [];

    const maxReviews = filters?.maxReviewCount ?? 15;
    if (maxReviews > 0 && (prospect.reviewCount || 0) <= maxReviews) {
      signals.push(
        prospect.reviewCount
          ? `only ${prospect.reviewCount} review${prospect.reviewCount === 1 ? '' : 's'}`
          : 'no reviews yet',
      );
    }

    const maxAgeDays = filters?.newListingMaxAgeDays ?? 365;
    if (maxAgeDays > 0 && prospect.oldestReviewAt) {
      const ageDays = Math.floor((Date.now() - prospect.oldestReviewAt.getTime()) / DAY_MS);
      if (ageDays <= maxAgeDays) {
        signals.push(`first review ${ageDays} day${ageDays === 1 ? '' : 's'} ago`);
      }
    }

    if (!seenBefore) signals.push('first time seen by this workspace');
    if (!prospect.website) signals.push('no website listed');

    // "No website" alone is a buying signal, not proof of a new listing.
    const newnessSignals = signals.filter((s) => s !== 'no website listed');
    return { isNewListing: newnessSignals.length > 0, signals };
  }

  // Results

  async findScrapedLeads(
    tenantId: string,
    filters: {
      campaignId?: string;
      status?: string;
      isNewListing?: boolean;
      minScore?: number;
      search?: string;
    },
    paginationDto: PaginationDto,
  ) {
    const query: any = {};
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.status) query.status = filters.status;
    if (filters.isNewListing !== undefined) query.isNewListing = filters.isNewListing;
    if (filters.minScore) query['ai.score'] = { $gte: filters.minScore };
    if (filters.search) {
      const safe = escapeRegex(filters.search);
      query.$or = [
        { businessName: { $regex: safe, $options: 'i' } },
        { city: { $regex: safe, $options: 'i' } },
        { category: { $regex: safe, $options: 'i' } },
      ];
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 20;
    // Best prospects first; `paginate()` cannot sort on a nested path.
    const sort: any =
      paginationDto.sortBy === 'createdAt'
        ? { createdAt: paginationDto.sortOrder === 'asc' ? 1 : -1 }
        : { 'ai.score': -1, reviewCount: 1, createdAt: -1 };

    const [data, total] = await Promise.all([
      this.scrapedLeadModel
        .find(query)
        .select('-raw')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.scrapedLeadModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      total,
      totalPages,
      page,
      limit,
      meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  async findScrapedLead(tenantId: string, id: string) {
    const query: any = { _id: id };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const doc = await this.scrapedLeadModel.findOne(query).lean();
    if (!doc) throw new NotFoundException('Prospect not found');
    return doc;
  }

  async statsFor(tenantId: string, campaignId?: string) {
    const match: any = {};
    if (tenantId && tenantId !== 'all') match.tenantId = tenantId;
    if (campaignId) match.campaignId = campaignId;

    const [byStatus, totals] = await Promise.all([
      this.scrapedLeadModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.scrapedLeadModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newListings: { $sum: { $cond: ['$isNewListing', 1, 0] } },
            hot: { $sum: { $cond: [{ $gte: ['$ai.score', 70] }, 1, 0] } },
            noWebsite: {
              $sum: { $cond: [{ $in: ['$website', [null, '']] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s: any) => [s._id, s.count]));
    const agg = totals[0] || {};
    return {
      total: agg.total || 0,
      newListings: agg.newListings || 0,
      hot: agg.hot || 0,
      noWebsite: agg.noWebsite || 0,
      pending: statusMap.new || 0,
      imported: statusMap.imported || 0,
      rejected: statusMap.rejected || 0,
    };
  }

  /** Promote reviewed prospects into the real Leads pipeline. */
  async importScraped(
    tenantId: string,
    ids: string[],
    actor?: Actor,
    campaignHint?: any,
  ): Promise<{ imported: number; skipped: number; leadIds: string[] }> {
    const query: any = { _id: { $in: ids }, status: { $ne: 'imported' } };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const prospects = await this.scrapedLeadModel.find(query);

    const leadIds: string[] = [];
    const importedPerCampaign = new Map<string, number>();
    let skipped = 0;

    for (const prospect of prospects) {
      try {
        const campaign =
          campaignHint && String(campaignHint._id) === prospect.campaignId
            ? campaignHint
            : await this.campaignModel.findById(prospect.campaignId).lean();

        const lead = await this.leadService.create(
          tenantId,
          {
            firstName: prospect.businessName,
            company: prospect.businessName,
            phone: prospect.phone || undefined,
            email: prospect.email || undefined,
            source: prospect.source || 'google_maps',
            temperature: prospect.ai?.temperature || 'cold',
            score: prospect.ai?.score || 0,
            tags: ['ai-automation', prospect.isNewListing ? 'new-listing' : 'maps-prospect'],
            customFields: {
              googleMapsUrl: prospect.sourceUrl,
              businessCategory: prospect.category,
              address: prospect.address,
              city: prospect.city,
              state: prospect.state,
              country: prospect.country,
              rating: prospect.rating,
              reviewCount: prospect.reviewCount,
              website: prospect.website || 'none',
              recommendedService: prospect.ai?.recommendedService,
              outreachMessage: prospect.ai?.outreachMessage,
              newListingSignals: (prospect.newListingSignals || []).join(', '),
              campaign: (campaign as any)?.name,
            },
            metadata: {
              // Powers "See original" on the lead itself.
              url: prospect.sourceUrl,
              referrer: 'google_maps',
              utmSource: 'ai_automation',
              utmMedium: 'google_maps',
              utmCampaign: (campaign as any)?.name,
              country: prospect.country,
              city: prospect.city,
            },
          } as any,
          actor?.userId,
        );

        const leadId = String((lead as any)._id);
        leadIds.push(leadId);
        importedPerCampaign.set(
          prospect.campaignId,
          (importedPerCampaign.get(prospect.campaignId) || 0) + 1,
        );

        prospect.status = 'imported';
        prospect.importedLeadId = leadId;
        prospect.importedAt = new Date();
        prospect.reviewedBy = actor?.userId;
        prospect.reviewedAt = new Date();
        await prospect.save();
      } catch (err: any) {
        skipped++;
        this.logger.warn(`Import failed for ${prospect.businessName}: ${err?.message}`);
      }
    }

    // A selection can span campaigns, so credit each one with its own imports.
    for (const [id, count] of importedPerCampaign) {
      await this.campaignModel.updateOne({ _id: id }, { $inc: { 'stats.totalImported': count } });
    }

    return { imported: leadIds.length, skipped, leadIds };
  }

  async rejectScraped(tenantId: string, dto: RejectScrapedLeadsDto, actor?: Actor) {
    const query: any = { _id: { $in: dto.ids } };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const result = await this.scrapedLeadModel.updateMany(query, {
      $set: {
        status: 'rejected',
        rejectedReason: dto.reason || '',
        reviewedBy: actor?.userId,
        reviewedAt: new Date(),
      },
    });
    return { rejected: result.modifiedCount || 0 };
  }

  async deleteScraped(tenantId: string, id: string) {
    const query: any = { _id: id };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const result = await this.scrapedLeadModel.deleteOne(query);
    if (!result.deletedCount) throw new NotFoundException('Prospect not found');
    return { success: true };
  }

  // Scheduling

  /** Campaigns whose next run is due. Used by the scheduler. */
  async findDueCampaigns(limit = 5) {
    return this.campaignModel
      .find({
        status: 'active',
        deletedAt: null,
        nextRunAt: { $ne: null, $lte: new Date() },
        'schedule.mode': { $in: ['daily', 'weekly'] },
      })
      .limit(limit)
      .lean();
  }

  computeNextRun(schedule?: { mode?: string; hourUtc?: number; dayOfWeek?: number }): Date | null {
    const mode = schedule?.mode || 'manual';
    if (mode === 'manual') return null;

    const hour = Math.min(23, Math.max(0, schedule?.hourUtc ?? 3));
    const next = new Date();
    next.setUTCHours(hour, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);

    if (mode === 'weekly') {
      const target = Math.min(6, Math.max(0, schedule?.dayOfWeek ?? 1));
      while (next.getUTCDay() !== target) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
    }
    return next;
  }

  /** Push a campaign's next run forward so a failure cannot hot-loop the scheduler. */
  async deferCampaign(campaignId: string, schedule: any) {
    await this.campaignModel.updateOne(
      { _id: campaignId },
      { $set: { nextRunAt: this.computeNextRun(schedule) } },
    );
  }
}
