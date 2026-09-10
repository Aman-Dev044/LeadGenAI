import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEFAULT_PLAN_LIMITS, DEFAULT_RESERVED_SLUGS, KNOWN_FEATURE_FLAGS, PlanLimits } from './plan-limits.constants';

const SETTINGS_KEY = 'global';
const REFRESH_INTERVAL_MS = 30_000;

/**
 * In-memory cache of the singleton PlatformSettings document. It is read on every
 * request by the auth guard (maintenance mode), so it must never hit the DB in the
 * request path. Refreshed every 30s so several API replicas converge after a change.
 */
@Injectable()
export class PlatformSettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cached: any = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel('PlatformSettings') private readonly settingsModel: Model<any>,
  ) {}

  async onModuleInit() {
    await this.ensureExists();
    await this.refresh().catch((err) => this.logger.warn(`Settings refresh failed: ${err.message}`));
    this.timer = setInterval(() => this.refresh().catch(() => undefined), REFRESH_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async ensureExists() {
    try {
      const defaults: Record<string, boolean> = {};
      for (const f of KNOWN_FEATURE_FLAGS) defaults[f.key] = f.default;
      await this.settingsModel.updateOne(
        { key: SETTINGS_KEY },
        {
          $setOnInsert: {
            key: SETTINGS_KEY,
            planLimits: DEFAULT_PLAN_LIMITS,
            featureFlags: defaults,
            reservedSlugs: DEFAULT_RESERVED_SLUGS,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      this.logger.warn(`Could not initialise platform settings: ${err.message}`);
    }
  }

  async refresh() {
    const doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).lean();
    if (doc) this.cached = doc;
    return this.cached;
  }

  /** Cached snapshot; empty object until the first refresh completes. */
  get(): any {
    return this.cached || {};
  }

  async update(patch: Record<string, any>, updatedBy?: string) {
    const doc = await this.settingsModel
      .findOneAndUpdate({ key: SETTINGS_KEY }, { $set: { ...patch, updatedBy } }, { new: true, upsert: true })
      .lean();
    this.cached = doc;
    return doc;
  }

  isMaintenance(): boolean {
    return !!this.get().maintenanceMode;
  }

  maintenanceMessage(): string {
    return this.get().maintenanceMessage || 'The platform is under maintenance. Please try again shortly.';
  }

  isSignupEnabled(): boolean {
    const v = this.get().signupEnabled;
    return v === undefined ? true : !!v;
  }

  defaultPlan(): string {
    return this.get().defaultPlan || 'free';
  }

  trialDays(): number {
    const n = Number(this.get().trialDays);
    return Number.isFinite(n) && n >= 0 ? n : 14;
  }

  limitsForPlan(plan: string): PlanLimits {
    const base = DEFAULT_PLAN_LIMITS[plan as keyof typeof DEFAULT_PLAN_LIMITS] || DEFAULT_PLAN_LIMITS.free;
    const custom = this.get().planLimits?.[plan];
    return { ...base, ...(custom || {}) };
  }

  reservedSlugs(): string[] {
    const list = this.get().reservedSlugs;
    return Array.isArray(list) && list.length ? list : DEFAULT_RESERVED_SLUGS;
  }

  isSlugReserved(slug: string): boolean {
    return this.reservedSlugs().includes((slug || '').toLowerCase());
  }

  /** Announcement to show right now (respects the optional time window). */
  activeAnnouncement(): { message: string; level: string; link?: string } | null {
    const a = this.get().announcement;
    if (!a?.enabled || !a.message) return null;
    const now = Date.now();
    if (a.startsAt && new Date(a.startsAt).getTime() > now) return null;
    if (a.endsAt && new Date(a.endsAt).getTime() < now) return null;
    return { message: a.message, level: a.level || 'info', link: a.link || undefined };
  }

  /** Effective flags = built-in defaults, overridden by global settings, overridden by the tenant. */
  effectiveFlags(tenantFlags?: Record<string, boolean>): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    for (const f of KNOWN_FEATURE_FLAGS) flags[f.key] = f.default;
    Object.assign(flags, this.get().featureFlags || {});
    return { ...flags, ...(tenantFlags || {}) };
  }
}
