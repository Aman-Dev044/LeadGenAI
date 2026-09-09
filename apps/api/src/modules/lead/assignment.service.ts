import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export type AssignmentStrategy = 'round_robin' | 'least_loaded';

export interface AssignmentRule {
  /** Lead field (top-level or custom field name), e.g. "source", "customFields.budget", "metadata.utmSource" */
  field: string;
  operator: 'eq' | 'ne' | 'contains' | 'in' | 'gt' | 'lt' | 'exists';
  value?: any;
  assignTo: string;
}

export interface AssignmentSettings {
  enabled: boolean;
  strategy: AssignmentStrategy;
  roles: string[];
  rules: AssignmentRule[];
  fallbackUserId?: string;
  /** Also route human handoffs with the same settings (default true). */
  assignHandoffs: boolean;
}

const DEFAULTS: AssignmentSettings = {
  enabled: false,
  strategy: 'round_robin',
  roles: ['SALESPERSON', 'SALES_MANAGER'],
  rules: [],
  fallbackUserId: undefined,
  assignHandoffs: true,
};

const OPEN_STATUSES = ['new', 'contacted', 'qualified'];

/**
 * Picks a salesperson for a new lead (or a handoff) based on the tenant's
 * assignment settings: explicit rules first, then round-robin / least-loaded
 * over the eligible active users.
 */
@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Lead') private readonly leadModel: Model<any>,
  ) {}

  async getSettings(tenantId: string): Promise<AssignmentSettings> {
    const tenant: any = await this.tenantModel.findById(tenantId).select('assignmentSettings').lean();
    const s = tenant?.assignmentSettings || {};
    return {
      enabled: !!s.enabled,
      strategy: s.strategy === 'least_loaded' ? 'least_loaded' : 'round_robin',
      roles: Array.isArray(s.roles) && s.roles.length ? s.roles : DEFAULTS.roles,
      rules: Array.isArray(s.rules) ? s.rules.filter((r: any) => r && r.field && r.assignTo) : [],
      fallbackUserId: s.fallbackUserId || undefined,
      assignHandoffs: s.assignHandoffs !== false,
    };
  }

  /**
   * Returns the user id to assign, or null when auto-assignment is disabled or
   * nobody is eligible. Never throws.
   */
  async pickAssignee(tenantId: string, lead: any, opts: { forHandoff?: boolean; preferOnline?: string[] } = {}): Promise<string | null> {
    try {
      const settings = await this.getSettings(tenantId);
      if (!settings.enabled) return null;
      if (opts.forHandoff && !settings.assignHandoffs) return null;

      const eligible = await this.eligibleUsers(tenantId, settings.roles);
      const eligibleIds = new Set(eligible.map((u) => String(u._id)));

      // 1. Explicit rules (first match wins) - target must still be an active user
      for (const rule of settings.rules) {
        if (this.matches(rule, lead) && (await this.isActiveUser(tenantId, rule.assignTo))) {
          return rule.assignTo;
        }
      }

      if (eligible.length === 0) {
        return settings.fallbackUserId && (await this.isActiveUser(tenantId, settings.fallbackUserId))
          ? settings.fallbackUserId
          : null;
      }

      // 2. For handoffs prefer agents who are online right now
      let pool = eligible;
      if (opts.preferOnline?.length) {
        const online = eligible.filter((u) => opts.preferOnline!.includes(String(u._id)));
        if (online.length) pool = online;
      }

      if (settings.strategy === 'least_loaded') {
        return this.leastLoaded(tenantId, pool);
      }
      return this.roundRobin(tenantId, pool, eligibleIds);
    } catch (err: any) {
      this.logger.warn(`Auto-assignment failed: ${err.message}`);
      return null;
    }
  }

  // ─── Strategies ───────────────────────────────────────────────────

  private async roundRobin(tenantId: string, pool: any[], eligibleIds: Set<string>): Promise<string> {
    const ids = pool.map((u) => String(u._id)).sort();
    const tenant: any = await this.tenantModel.findById(tenantId).select('assignmentState').lean();
    const last: string | undefined = tenant?.assignmentState?.lastAssignedUserId;

    let next = ids[0];
    if (last && eligibleIds.has(last)) {
      const idx = ids.indexOf(last);
      next = ids[(idx + 1) % ids.length];
      if (idx === -1) next = ids.find((id) => id > last) || ids[0];
    }

    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { 'assignmentState.lastAssignedUserId': next, 'assignmentState.lastAssignedAt': new Date() } },
    );
    return next;
  }

  private async leastLoaded(tenantId: string, pool: any[]): Promise<string> {
    const ids = pool.map((u) => String(u._id));
    const counts = await this.leadModel.aggregate([
      { $match: { tenantId, assignedTo: { $in: ids }, status: { $in: OPEN_STATUSES }, deletedAt: null } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]);
    const load = new Map<string, number>(counts.map((c: any) => [String(c._id), c.count]));
    let best = ids[0];
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const id of ids.sort()) {
      const l = load.get(id) || 0;
      if (l < bestLoad) {
        best = id;
        bestLoad = l;
      }
    }
    return best;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async eligibleUsers(tenantId: string, roles: string[]) {
    return this.userModel
      .find({ tenantId, isActive: true, deletedAt: null, role: { $in: roles } })
      .select('_id role')
      .limit(200)
      .lean();
  }

  private async isActiveUser(tenantId: string, userId?: string): Promise<boolean> {
    if (!userId || !/^[a-f\d]{24}$/i.test(userId)) return false;
    const exists = await this.userModel.exists({ _id: userId, tenantId, isActive: true, deletedAt: null });
    return !!exists;
  }

  private getField(lead: any, path: string): any {
    if (!lead) return undefined;
    const direct = path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), lead);
    if (direct !== undefined) return direct;
    // Allow bare custom field names
    return lead.customFields?.[path];
  }

  matches(rule: AssignmentRule, lead: any): boolean {
    const actual = this.getField(lead, rule.field);
    const expected = rule.value;
    const norm = (v: any) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

    switch (rule.operator) {
      case 'exists':
        return actual !== undefined && actual !== null && actual !== '';
      case 'eq':
        return norm(actual) === norm(expected);
      case 'ne':
        return norm(actual) !== norm(expected);
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && norm(actual).includes(norm(expected));
      case 'in': {
        const list = Array.isArray(expected) ? expected : String(expected || '').split(',');
        return list.map(norm).includes(norm(actual));
      }
      case 'gt':
        return Number(actual) > Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      default:
        return false;
    }
  }
}
