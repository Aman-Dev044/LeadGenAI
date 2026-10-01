import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeadService } from '../lead/lead.service';
import { NotificationService } from '../notification/notification.service';
import { SERVICE_LABELS } from '../lead-automation/ai-qualifier.service';
import {
  ClassificationResult,
  defaultChannelFor,
  SocialQualifierService,
} from './social-qualifier.service';
import { SocialSourceRegistry } from './providers/social-source.registry';
import { RawSocialPost } from './providers/social-source.interface';
import { COUNTRIES, SELLER_MARKERS, SITE_PRESETS, SUBREDDIT_PRESETS } from './presets';
import { CredentialsService } from '../credentials/credentials.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { escapeRegex } from '../../common/utils/sanitize';
import {
  CreateSocialCampaignDto,
  GenerateMessageDto,
  RejectSocialPostsDto,
  UpdateSocialCampaignDto,
} from './dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** We over-fetch because the filters and the AI gate discard most raw results. */
const OVERFETCH_FACTOR = 3;
const BODY_STORAGE_LIMIT = 4000;

type Actor = { userId?: string; role?: string };

@Injectable()
export class SocialProspectingService {
  private readonly logger = new Logger(SocialProspectingService.name);

  /** Campaign ids currently executing in this process - guards double-clicks. */
  private readonly running = new Set<string>();

  constructor(
    @InjectModel('SocialCampaign') private readonly campaignModel: Model<any>,
    @InjectModel('SocialPostLead') private readonly postModel: Model<any>,
    @InjectModel('SocialRun') private readonly runModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly sources: SocialSourceRegistry,
    private readonly qualifier: SocialQualifierService,
    private readonly leadService: LeadService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  private get absoluteMaxResults(): number {
    return this.configService.get<number>('socialProspecting.maxResultsPerRun') || 300;
  }

  private get maxMessagesPerRun(): number {
    return this.configService.get<number>('socialProspecting.maxMessagesPerRun') || 25;
  }

  // Campaigns

  async createCampaign(tenantId: string, dto: CreateSocialCampaignDto, createdBy?: string) {
    const platforms = this.resolvePlatforms(dto.platforms);
    return this.campaignModel.create({
      ...dto,
      platforms,
      tenantId,
      createdBy,
      maxResultsPerRun: Math.min(dto.maxResultsPerRun || 60, this.absoluteMaxResults),
      nextRunAt: this.computeNextRun(dto.schedule),
    });
  }

  async findCampaigns(tenantId: string, paginationDto: PaginationDto) {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    if (paginationDto.search) {
      const safe = escapeRegex(paginationDto.search);
      query.name = { $regex: safe, $options: 'i' };
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

    // Pending-review counts make the list actionable without opening each campaign.
    const ids = data.map((c: any) => String(c._id));
    const pending = ids.length
      ? await this.postModel.aggregate([
          { $match: { campaignId: { $in: ids }, status: 'new' } },
          { $group: { _id: '$campaignId', count: { $sum: 1 } } },
        ])
      : [];
    const pendingMap = Object.fromEntries(pending.map((p: any) => [p._id, p.count]));

    const totalPages = Math.ceil(total / limit);
    return {
      data: data.map((c: any) => ({ ...c, pendingCount: pendingMap[String(c._id)] || 0 })),
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

  async updateCampaign(tenantId: string, campaignId: string, dto: UpdateSocialCampaignDto) {
    const campaign = await this.campaignModel.findOne({
      _id: campaignId,
      tenantId,
      deletedAt: null,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    Object.assign(campaign, dto);
    if (dto.platforms) campaign.platforms = this.resolvePlatforms(dto.platforms);
    if (dto.maxResultsPerRun) {
      campaign.maxResultsPerRun = Math.min(dto.maxResultsPerRun, this.absoluteMaxResults);
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

  /**
   * A campaign's target countries. Falls back to the legacy single-country
   * field so campaigns created before multi-country keep working.
   */
  private resolveRegions(campaign: { regionCodes?: string[]; regionCode?: string }): string[] {
    const many = (campaign.regionCodes || []).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (many.length) return many;
    const one = (campaign.regionCode || '').trim().toUpperCase();
    return one ? [one] : [];
  }

  /** A campaign with no runnable platform would silently return nothing. */
  private resolvePlatforms(requested?: string[]): string[] {
    const wanted = (requested || []).filter(Boolean);
    if (!wanted.length) return [this.sources.default().id];
    return wanted;
  }

  // Meta

  /**
   * The tenant's own settings for each source, as a lookup the registry and the
   * run pipeline can both consult. A workspace that saved nothing falls back to
   * the platform's environment.
   */
  private async sourceCredentials(tenantId: string): Promise<Map<string, Record<string, string>>> {
    const ids = this.sources.all().map((p) => p.id);
    const entries = await Promise.all(
      ids.map(async (id) => [id, await this.credentials.resolve(tenantId, id)] as const),
    );
    return new Map(entries);
  }

  /** Sources, their configuration state, and the presets the campaign form offers. */
  async listSources(tenantId: string) {
    const creds = await this.sourceCredentials(tenantId);
    return {
      sources: this.sources.list((id) => creds.get(id)),
      serviceTypes: Object.entries(SERVICE_LABELS).map(([id, label]) => ({ id, label })),
      subredditPresets: SUBREDDIT_PRESETS,
      sitePresets: SITE_PRESETS,
      countries: COUNTRIES,
    };
  }

  /** Show exactly what would be searched, per platform, before spending any quota. */
  async previewQueries(
    tenantId: string,
    dto: {
    serviceTypes?: string[];
    platforms?: string[];
    keywords?: string[];
    subreddits?: string[];
    siteFilters?: string[];
    extraQueries?: string[];
      maxAgeDays?: number;
      regionCodes?: string[];
    },
  ) {
    const queries = await this.qualifier.buildQueries(dto);
    const platforms = this.resolvePlatforms(dto.platforms);
    const maxAgeDays = dto.maxAgeDays || 7;
    const regions = this.resolveRegions({ regionCodes: dto.regionCodes });
    const creds = await this.sourceCredentials(tenantId);

    const perPlatform = platforms.map((id) => {
      const provider = this.sources.get(id);
      if (!provider) return { platform: id, configured: false, searches: 0, samples: [] };

      // Ask the provider itself where it can, so the preview can never drift
      // from the query that actually gets paid for.
      let samples: string[];
      if (provider.previewQueries) {
        samples = provider.previewQueries({
          queries,
          maxAgeDays,
          limit: 0,
          languageCode: 'en',
          regionCodes: regions,
          subreddits: dto.subreddits || [],
          siteFilters: dto.siteFilters || [],
          credentials: creds.get(id),
        });
      } else if (id === 'reddit' && dto.subreddits?.length) {
        samples = queries.flatMap((q) => dto.subreddits!.map((s) => `r/${s}: ${q}`));
      } else {
        samples = queries;
      }

      // SERP sources are capped per run, and each country costs its own search.
      const isSerp = id === 'quora' || id === 'web';
      const budget = isSerp
        ? Number(creds.get(id)?.maxSearchesPerRun) ||
          this.configService.get<number>('socialProspecting.serp.maxSearchesPerRun') ||
          6
        : undefined;
      const searches = isSerp ? samples.length * Math.max(1, regions.length) : samples.length;

      return {
        platform: id,
        label: provider.label,
        configured: provider.isConfigured(creds.get(id)),
        searches,
        budget,
        willRun: budget ? Math.min(searches, budget) : searches,
        // Reddit and Hacker News have no geography; say so rather than implying one.
        geo: isSerp ? regions : [],
        samples: samples.slice(0, 25),
      };
    });

    return { keywords: queries, count: queries.length, perPlatform };
  }

  suggestKeywords(serviceTypes: string[]) {
    return this.qualifier
      .suggestKeywords(serviceTypes || [])
      .then((keywords) => ({ keywords }));
  }

  // Runs

  async listRuns(tenantId: string, campaignId: string, limit = 20) {
    const query: any = { campaignId };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    return this.runModel.find(query).sort({ createdAt: -1 }).limit(Math.min(limit, 50)).lean();
  }

  /**
   * Executes a campaign end to end. Kicked off by the controller (manual) or the
   * scheduler; the caller gets the run document back immediately and polls it.
   */
  async startRun(
    tenantId: string,
    campaignId: string,
    trigger: 'manual' | 'schedule',
    triggeredBy?: string,
  ) {
    const campaign = await this.campaignModel.findOne({
      _id: campaignId,
      tenantId,
      deletedAt: null,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const platforms = this.resolvePlatforms(campaign.platforms);
    const sourceCreds = await this.sourceCredentials(tenantId);
    const runnable = platforms.filter((id) =>
      this.sources.get(id)?.isConfigured(sourceCreds.get(id)),
    );
    if (!runnable.length) {
      const names = platforms.map((id) => this.sources.get(id)?.label || id).join(', ');
      throw new BadRequestException(
        `None of this campaign's sources are configured (${names}). ` +
          'Add the missing keys in Settings > API Credentials, or enable Hacker News which needs none.',
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
    void this.executeRun(campaign, run, runnable)
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

  private async executeRun(campaign: any, run: any, platforms: string[]) {
    const tenantId = campaign.tenantId;
    const campaignId = String(campaign._id);
    const warnings: string[] = [];
    const perPlatform: any[] = [];
    const stats = {
      fetched: 0,
      duplicates: 0,
      filteredOut: 0,
      aiClassified: 0,
      qualified: 0,
      saved: 0,
      messagesGenerated: 0,
      autoImported: 0,
      apiCalls: 0,
      aiTokens: 0,
    };

    const maxResults = Math.min(campaign.maxResultsPerRun || 60, this.absoluteMaxResults);
    const filters = campaign.filters || {};
    const maxAgeDays = filters.maxAgeDays || 7;
    const regions = this.resolveRegions(campaign);

    const sourceCreds = await this.sourceCredentials(tenantId);
    const queries = await this.qualifier.buildQueries(campaign);
    if (!queries.length) {
      throw new BadRequestException('Campaign has no keywords or service types to search for');
    }
    await this.runModel.updateOne({ _id: run._id }, { $set: { queries } });

    // 1. Collect raw posts from every configured platform. A source that fails is
    //    recorded and skipped - it must not hide what the others found.
    const collected = new Map<string, { post: RawSocialPost; source: string }>();
    const fetchBudget = maxResults * OVERFETCH_FACTOR;
    const perSourceBudget = Math.max(10, Math.ceil(fetchBudget / platforms.length));

    for (const platformId of platforms) {
      const provider = this.sources.get(platformId);
      if (!provider) continue;

      const entry = { platform: platformId, fetched: 0, saved: 0, apiCalls: 0, error: undefined as any };
      try {
        const result = await provider.search({
          queries,
          maxAgeDays,
          limit: Math.min(perSourceBudget, Math.max(0, fetchBudget - collected.size)),
          languageCode: campaign.languageCode || 'en',
          regionCodes: regions,
          credentials: sourceCreds.get(platformId),
          subreddits: campaign.subreddits || [],
          siteFilters: campaign.siteFilters || [],
        });

        entry.fetched = result.posts.length;
        entry.apiCalls = result.apiCalls;
        stats.apiCalls += result.apiCalls;
        warnings.push(...result.warnings);

        for (const post of result.posts) {
          if (!collected.has(post.externalId)) collected.set(post.externalId, { post, source: platformId });
        }
      } catch (err: any) {
        this.logger.warn(`${platformId} failed for campaign ${campaignId}: ${err?.message}`);
        entry.error = err?.message || 'Source failed';
        warnings.push(`${provider.label}: ${entry.error}`);
      }
      perPlatform.push(entry);
    }
    stats.fetched = collected.size;

    // 2. Drop anything this campaign already holds.
    const seenRows = await this.postModel
      .find({ tenantId, campaignId, externalId: { $in: [...collected.keys()] } })
      .select('externalId')
      .lean();
    for (const row of seenRows) {
      collected.delete(row.externalId);
      stats.duplicates++;
    }

    // 3. Cheap filters - everything decidable without an AI call.
    const negatives = (campaign.negativeKeywords || []).map((n: string) => n.toLowerCase()).filter(Boolean);
    let candidates = [...collected.values()].filter(({ post }) => {
      const haystack = `${post.title || ''} ${post.body}`.toLowerCase();

      if (post.postedAt && post.postedAt.getTime() < Date.now() - maxAgeDays * DAY_MS) return false;
      if ((post.body || '').length < (filters.minBodyLength ?? 40)) return false;
      if (negatives.some((n: string) => haystack.includes(n))) return false;
      if (filters.excludeSellers !== false && SELLER_MARKERS.some((m) => haystack.includes(m))) {
        return false;
      }
      if (filters.minEngagement > 0) {
        const engagement = (post.engagement?.upvotes || 0) + (post.engagement?.comments || 0);
        if (engagement < filters.minEngagement) return false;
      }
      return true;
    });
    stats.filteredOut = collected.size - candidates.length;

    // Freshest first, then cap before paying for AI.
    candidates.sort((a, b) => (b.post.postedAt?.getTime() || 0) - (a.post.postedAt?.getTime() || 0));
    candidates = candidates.slice(0, maxResults);

    // 4. AI classification - the gate that decides what is actually a lead.
    const aiConfig = campaign.ai || {};
    const tenant = await this.tenantModel.findById(tenantId).select('name').lean();
    let classifications = new Map<string, ClassificationResult>();

    if (aiConfig.enabled !== false && candidates.length) {
      const outcome = await this.qualifier.classify(
        candidates.map((c) => c.post),
        {
          serviceTypes: campaign.serviceTypes || [],
          tenantName: (tenant as any)?.name,
          regionCodes: regions,
          tenantId,
        },
      );
      classifications = outcome.results;
      stats.aiTokens += outcome.tokens;
      stats.aiClassified = classifications.size;
    }

    // 5. Score gate. Without AI everything is stored neutral for manual review.
    const minScore = aiConfig.enabled === false ? 0 : (aiConfig.minScore ?? 50);
    let droppedByCountry = 0;

    /**
     * Country gate. Reddit and Hacker News cannot filter by geography at all, so
     * this is the only place it can be enforced for them. A post the AI could
     * not place is kept unless the campaign asked for strictness - most posts
     * never say where the author is, and they are still real leads.
     */
    const countryAllowed = (verdict?: ClassificationResult) => {
      if (!regions.length) return true;
      const country = verdict?.country || '';
      if (!country) return !filters.strictCountry;
      return regions.includes(country);
    };

    const survivors = candidates.filter(({ post }) => {
      if (aiConfig.enabled === false) return true;
      const verdict = classifications.get(post.externalId);
      if (!verdict) return false;
      if (!verdict.isLead) return false;
      if (verdict.score < minScore) return false;
      if (!countryAllowed(verdict)) {
        droppedByCountry++;
        return false;
      }
      return true;
    });
    stats.qualified = survivors.length;
    stats.filteredOut += candidates.length - survivors.length;

    // 6. Persist. Unordered so a concurrent run losing the unique-index race skips
    //    duplicates instead of failing the whole batch.
    const now = new Date();
    const docs = survivors.map(({ post, source }) => {
      const verdict = classifications.get(post.externalId);
      return {
        tenantId,
        campaignId,
        runId: String(run._id),
        source,
        externalId: post.externalId,
        sourceUrl: post.sourceUrl,
        title: post.title,
        body: (post.body || '').slice(0, BODY_STORAGE_LIMIT),
        authorHandle: post.authorHandle,
        authorProfileUrl: post.authorProfileUrl,
        communityName: post.communityName,
        postedAt: post.postedAt,
        dateConfidence: post.dateConfidence,
        engagement: post.engagement || {},
        language: post.language,
        country: verdict?.country || post.countryHint || '',
        locationText: verdict?.locationText || '',
        ai: verdict
          ? {
              isLead: verdict.isLead,
              score: verdict.score,
              temperature: verdict.temperature,
              intent: verdict.intent,
              needSummary: verdict.needSummary,
              wantedServices: verdict.wantedServices,
              recommendedService: verdict.recommendedService,
              budgetHint: verdict.budgetHint,
              urgency: verdict.urgency,
              painPoints: verdict.painPoints,
              rejectReason: verdict.rejectReason,
              generatedAt: now,
            }
          : {},
        outreach: { channel: defaultChannelFor(source), sendStatus: 'draft' },
        status: 'new',
        raw: post.raw || {},
      };
    });

    let inserted: any[] = [];
    if (docs.length) {
      try {
        inserted = await this.postModel.insertMany(docs, { ordered: false });
      } catch (err: any) {
        // A duplicate-key error still inserts every non-duplicate document.
        inserted = err?.insertedDocs || [];
        if (err?.code !== 11000) {
          warnings.push(`Some prospects could not be saved: ${err?.message}`);
        }
      }
    }
    stats.saved = inserted.length;

    for (const entry of perPlatform) {
      entry.saved = inserted.filter((d: any) => d.source === entry.platform).length;
    }

    // 7. Draft outreach for the best prospects only - one AI call each.
    if (aiConfig.generateMessage !== false && inserted.length) {
      const ranked = [...inserted].sort((a: any, b: any) => (b.ai?.score || 0) - (a.ai?.score || 0));
      for (const doc of ranked.slice(0, this.maxMessagesPerRun)) {
        try {
          const { result, tokens } = await this.qualifier.generateMessage(
            {
              title: doc.title,
              body: doc.body,
              communityName: doc.communityName,
              authorHandle: doc.authorHandle,
              source: doc.source,
              ai: doc.ai,
            },
            {
              serviceTypes: campaign.serviceTypes || [],
              tone: aiConfig.messageTone || 'helpful',
              language: aiConfig.messageLanguage || 'auto',
              tenantName: (tenant as any)?.name,
              tenantId,
            },
          );
          await this.postModel.updateOne(
            { _id: doc._id },
            {
              $set: {
                'outreach.message': result.message,
                'outreach.subject': result.subject,
                'outreach.channel': result.channel,
                'outreach.generatedAt': new Date(),
                'outreach.sendStatus': 'draft',
              },
            },
          );
          stats.messagesGenerated++;
          stats.aiTokens += tokens;
        } catch (err: any) {
          this.logger.warn(`Message generation failed for ${doc._id}: ${err?.message}`);
        }
      }
    }

    // 8. Optional auto-import. Off by default - AI false positives should not
    //    reach the pipeline unreviewed.
    if (campaign.autoImport && inserted.length) {
      const threshold = campaign.autoImportMinScore ?? 80;
      const autoIds = inserted
        .filter((d: any) => (d.ai?.score || 0) >= threshold)
        .map((d: any) => String(d._id));
      if (autoIds.length) {
        const outcome = await this.importPosts(tenantId, autoIds, undefined, campaign);
        stats.autoImported = outcome.imported;
      }
    }

    await this.runModel.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'completed',
          finishedAt: new Date(),
          stats,
          perPlatform,
          warnings: warnings.slice(0, 40),
        },
      },
    );

    await this.campaignModel.updateOne(
      { _id: campaign._id },
      {
        $inc: {
          'stats.totalRuns': 1,
          'stats.totalFound': stats.fetched,
          'stats.totalQualified': stats.qualified,
        },
        $set: { 'stats.lastRunAt': new Date(), lastError: null },
      },
    );

    if (droppedByCountry > 0) {
      warnings.push(
        `${droppedByCountry} prospect${droppedByCountry === 1 ? '' : 's'} dropped for being outside ` +
          `${regions.join(', ')}.`,
      );
    }

    if (stats.saved > 0) {
      await this.notifyRunFinished(tenantId, campaign, stats);
    }
  }

  private async notifyRunFinished(
    tenantId: string,
    campaign: any,
    stats: { saved: number; qualified: number },
  ) {
    try {
      await this.notificationService.notifyTenant(
        tenantId,
        {
          title: `${stats.saved} new prospects from "${campaign.name}"`,
          body: `${stats.qualified} posts look like real buying intent. Review them in Leads Scrap AI.`,
          type: 'system_alert',
          data: { campaignId: String(campaign._id), kind: 'social_prospecting_run' },
        } as any,
        { channels: false },
      );
    } catch (err: any) {
      this.logger.warn(`Run notification failed: ${err?.message}`);
    }
  }

  // Results

  async findPosts(
    tenantId: string,
    filters: {
      campaignId?: string;
      status?: string;
      source?: string;
      intent?: string;
      minScore?: number;
      country?: string;
      withinDays?: number;
      search?: string;
    },
    paginationDto: PaginationDto,
  ) {
    const query: any = {};
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.status) query.status = filters.status;
    if (filters.source) query.source = filters.source;
    if (filters.intent) query['ai.intent'] = filters.intent;
    if (filters.minScore) query['ai.score'] = { $gte: filters.minScore };
    if (filters.country) query.country = filters.country.toUpperCase();
    if (filters.withinDays) {
      query.postedAt = { $gte: new Date(Date.now() - filters.withinDays * DAY_MS) };
    }
    if (filters.search) {
      const safe = escapeRegex(filters.search);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { body: { $regex: safe, $options: 'i' } },
        { authorHandle: { $regex: safe, $options: 'i' } },
        { communityName: { $regex: safe, $options: 'i' } },
      ];
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 20;
    // Newest post first is the whole point of this feature; score is the alternative.
    const sort: any =
      paginationDto.sortBy === 'score'
        ? { 'ai.score': -1, postedAt: -1 }
        : { postedAt: -1, createdAt: -1 };

    const [data, total] = await Promise.all([
      this.postModel
        .find(query)
        .select('-raw')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.postModel.countDocuments(query),
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

  async findPost(tenantId: string, id: string) {
    const query: any = { _id: id };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const doc = await this.postModel.findOne(query).lean();
    if (!doc) throw new NotFoundException('Prospect not found');
    return doc;
  }

  async statsFor(tenantId: string, campaignId?: string) {
    const match: any = {};
    if (tenantId && tenantId !== 'all') match.tenantId = tenantId;
    if (campaignId) match.campaignId = campaignId;

    const dayAgo = new Date(Date.now() - DAY_MS);

    const [byStatus, bySource, byCountry, totals] = await Promise.all([
      this.postModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.postModel.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
      this.postModel.aggregate([
        { $match: { ...match, country: { $nin: [null, ''] } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.postModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            hot: { $sum: { $cond: [{ $gte: ['$ai.score', 70] }, 1, 0] } },
            postedToday: { $sum: { $cond: [{ $gte: ['$postedAt', dayAgo] }, 1, 0] } },
            withMessage: {
              $sum: { $cond: [{ $ifNull: ['$outreach.message', false] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s: any) => [s._id, s.count]));
    const agg = totals[0] || {};
    return {
      total: agg.total || 0,
      hot: agg.hot || 0,
      postedToday: agg.postedToday || 0,
      withMessage: agg.withMessage || 0,
      pending: statusMap.new || 0,
      reviewed: statusMap.reviewed || 0,
      imported: statusMap.imported || 0,
      rejected: statusMap.rejected || 0,
      bySource: Object.fromEntries(bySource.map((s: any) => [s._id, s.count])),
      byCountry: Object.fromEntries(byCountry.map((c: any) => [c._id, c.count])),
    };
  }

  // Outreach drafts

  async regenerateMessage(tenantId: string, id: string, dto: GenerateMessageDto) {
    const post = await this.postModel.findOne(
      tenantId && tenantId !== 'all' ? { _id: id, tenantId } : { _id: id },
    );
    if (!post) throw new NotFoundException('Prospect not found');

    const campaign = await this.campaignModel.findById(post.campaignId).lean();
    const tenant = await this.tenantModel.findById(post.tenantId).select('name').lean();

    const { result } = await this.qualifier.generateMessage(
      {
        title: post.title,
        body: post.body,
        communityName: post.communityName,
        authorHandle: post.authorHandle,
        source: post.source,
        ai: post.ai,
      },
      {
        serviceTypes: (campaign as any)?.serviceTypes || [],
        tone: dto.tone || (campaign as any)?.ai?.messageTone || 'helpful',
        language: dto.language || (campaign as any)?.ai?.messageLanguage || 'auto',
        tenantName: (tenant as any)?.name,
        channel: dto.channel,
        tenantId: post.tenantId,
      },
    );

    post.outreach = {
      ...(post.outreach || {}),
      message: result.message,
      subject: result.subject,
      channel: result.channel,
      generatedAt: new Date(),
      // A fresh draft replaces the old edit rather than silently keeping it.
      editedBody: undefined,
      sendStatus: 'draft',
    };
    await post.save();
    return post;
  }

  async updateMessage(tenantId: string, id: string, body: string) {
    const post = await this.postModel.findOneAndUpdate(
      tenantId && tenantId !== 'all' ? { _id: id, tenantId } : { _id: id },
      { $set: { 'outreach.editedBody': body } },
      { new: true },
    );
    if (!post) throw new NotFoundException('Prospect not found');
    return post;
  }

  /**
   * Records that a human sent the draft themselves. Nothing is transmitted from
   * here - unsolicited bulk messaging is against every one of these platforms'
   * rules, so sending stays a deliberate manual act.
   */
  async markSent(tenantId: string, id: string, actor?: Actor, channel?: string) {
    const update: any = {
      'outreach.sendStatus': 'sent',
      'outreach.sentAt': new Date(),
      'outreach.sentBy': actor?.userId,
    };
    if (channel) update['outreach.channel'] = channel;

    const post = await this.postModel.findOneAndUpdate(
      tenantId && tenantId !== 'all' ? { _id: id, tenantId } : { _id: id },
      { $set: update },
      { new: true },
    );
    if (!post) throw new NotFoundException('Prospect not found');
    return post;
  }

  // Import / reject

  /**
   * Promote reviewed prospects into the real Leads pipeline.
   *
   * Goes through `LeadService.create` on purpose: that emits `lead.created`, so a
   * promoted post picks up scoring, notifications, webhooks, follow-up triggers
   * and assignment without this module knowing any of it exists.
   */
  async importPosts(
    tenantId: string,
    ids: string[],
    actor?: Actor,
    campaignHint?: any,
  ): Promise<{ imported: number; skipped: number; leadIds: string[] }> {
    const query: any = { _id: { $in: ids }, status: { $ne: 'imported' } };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const posts = await this.postModel.find(query);

    const leadIds: string[] = [];
    const importedPerCampaign = new Map<string, number>();
    let skipped = 0;

    for (const post of posts) {
      try {
        const campaign =
          campaignHint && String(campaignHint._id) === post.campaignId
            ? campaignHint
            : await this.campaignModel.findById(post.campaignId).lean();

        const lead = await this.leadService.create(
          tenantId,
          {
            // Social posts carry no email or phone - the handle is the identity.
            firstName: post.authorHandle || 'Unknown',
            company: post.communityName,
            source: post.source,
            temperature: post.ai?.temperature || 'cold',
            score: post.ai?.score || 0,
            tags: ['leads-scrap-ai', post.source, post.ai?.intent].filter(Boolean),
            customFields: {
              postUrl: post.sourceUrl,
              postedAt: post.postedAt,
              dateConfidence: post.dateConfidence,
              platform: post.source,
              community: post.communityName,
              authorHandle: post.authorHandle,
              authorProfile: post.authorProfileUrl,
              postTitle: post.title,
              postExcerpt: (post.body || '').slice(0, 500),
              needSummary: post.ai?.needSummary,
              wantedServices: (post.ai?.wantedServices || []).join(', '),
              recommendedService: post.ai?.recommendedService,
              urgency: post.ai?.urgency,
              budgetHint: post.ai?.budgetHint,
              painPoints: (post.ai?.painPoints || []).join(', '),
              outreachMessage: post.outreach?.editedBody || post.outreach?.message,
              campaign: (campaign as any)?.name,
            },
            metadata: {
              // Powers "See original" on the lead itself.
              url: post.sourceUrl,
              referrer: post.source,
              utmSource: 'leads_scrap_ai',
              utmMedium: post.source,
              utmCampaign: (campaign as any)?.name,
            },
          } as any,
          actor?.userId,
        );

        const leadId = String((lead as any)._id);
        leadIds.push(leadId);
        importedPerCampaign.set(
          post.campaignId,
          (importedPerCampaign.get(post.campaignId) || 0) + 1,
        );

        post.status = 'imported';
        post.importedLeadId = leadId;
        post.importedAt = new Date();
        post.reviewedBy = actor?.userId;
        post.reviewedAt = new Date();
        await post.save();
      } catch (err: any) {
        skipped++;
        this.logger.warn(`Import failed for ${post._id}: ${err?.message}`);
      }
    }

    // A selection can span campaigns, so credit each one with its own imports.
    for (const [id, count] of importedPerCampaign) {
      await this.campaignModel.updateOne({ _id: id }, { $inc: { 'stats.totalImported': count } });
    }

    return { imported: leadIds.length, skipped, leadIds };
  }

  async rejectPosts(tenantId: string, dto: RejectSocialPostsDto, actor?: Actor) {
    const query: any = { _id: { $in: dto.ids } };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;

    const result = await this.postModel.updateMany(query, {
      $set: {
        status: 'rejected',
        rejectedReason: dto.reason,
        reviewedBy: actor?.userId,
        reviewedAt: new Date(),
      },
    });
    return { rejected: result.modifiedCount || 0 };
  }

  async deletePost(tenantId: string, id: string) {
    const query: any = { _id: id };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const result = await this.postModel.deleteOne(query);
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
