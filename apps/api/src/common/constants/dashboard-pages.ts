/**
 * The dashboard pages an administrator can switch on or off per person.
 *
 * The role is still the ceiling: a per-person list can only take pages AWAY
 * from what the role already allows, never add one. That is what keeps this
 * safe to enforce in the browser - every endpoint behind these pages is still
 * gated by @Roles on the API, so hiding a menu is a convenience, not the lock.
 */

export type DashboardRole = 'ADMIN' | 'SALES_MANAGER' | 'SALESPERSON' | 'VIEWER';

export interface DashboardPage {
  /** The route, and the key stored on the user. */
  path: string;
  label: string;
  /** Sidebar grouping, so the settings screen reads like the menu itself. */
  group: string;
  /** Roles that may ever open it. A person's own list is intersected with this. */
  roles: DashboardRole[];
  /** Always on - taking it away would leave someone with nowhere to land. */
  locked?: boolean;
}

const TEAM: DashboardRole[] = ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'];
const WITH_VIEWER: DashboardRole[] = ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'];
const MANAGERS: DashboardRole[] = ['ADMIN', 'SALES_MANAGER'];
const ADMIN_ONLY: DashboardRole[] = ['ADMIN'];

export const DASHBOARD_PAGES: DashboardPage[] = [
  { path: '/dashboard', label: 'Dashboard', group: 'Overview', roles: WITH_VIEWER, locked: true },

  { path: '/dashboard/leads', label: 'Leads', group: 'Pipeline', roles: WITH_VIEWER },
  { path: '/dashboard/follow-up-tasks', label: 'Follow-up Tasks', group: 'Pipeline', roles: TEAM },
  { path: '/dashboard/calls', label: 'Calls', group: 'Pipeline', roles: TEAM },
  { path: '/dashboard/conversations', label: 'Conversations', group: 'Pipeline', roles: TEAM },
  { path: '/dashboard/handoffs', label: 'Handoffs', group: 'Pipeline', roles: TEAM },
  { path: '/dashboard/appointments', label: 'Appointments', group: 'Pipeline', roles: WITH_VIEWER },
  { path: '/dashboard/bookings', label: 'Bookings', group: 'Pipeline', roles: TEAM },

  { path: '/dashboard/agents', label: 'Agents', group: 'AI Engine', roles: ADMIN_ONLY },
  { path: '/dashboard/knowledge-base', label: 'Knowledge Base', group: 'AI Engine', roles: ADMIN_ONLY },
  { path: '/dashboard/lead-scoring', label: 'Lead Scoring', group: 'AI Engine', roles: ADMIN_ONLY },

  { path: '/dashboard/ai-automation', label: 'AI Automation', group: 'Automation', roles: ADMIN_ONLY },
  { path: '/dashboard/leads-scrap-ai', label: 'Leads Scrap AI', group: 'Automation', roles: ADMIN_ONLY },
  { path: '/dashboard/follow-ups', label: 'Workflows', group: 'Automation', roles: ADMIN_ONLY },
  { path: '/dashboard/integrations', label: 'Integrations', group: 'Automation', roles: ADMIN_ONLY },
  { path: '/dashboard/webhooks', label: 'Webhooks', group: 'Automation', roles: ADMIN_ONLY },
  { path: '/dashboard/api-keys', label: 'API Keys', group: 'Automation', roles: ADMIN_ONLY },

  { path: '/dashboard/analytics', label: 'Analytics', group: 'Insights', roles: ADMIN_ONLY },
  { path: '/dashboard/revenue-brain', label: 'Revenue Brain', group: 'Insights', roles: TEAM },
  { path: '/dashboard/visitor-tracking', label: 'Visitor Tracking', group: 'Insights', roles: ADMIN_ONLY },
  { path: '/dashboard/notifications', label: 'Notifications', group: 'Insights', roles: WITH_VIEWER },

  { path: '/dashboard/users', label: 'Users', group: 'Workspace', roles: ADMIN_ONLY },
  { path: '/dashboard/support-tickets', label: 'Support Tickets', group: 'Workspace', roles: TEAM },
  { path: '/dashboard/billing', label: 'Billing', group: 'Workspace', roles: ADMIN_ONLY },
  { path: '/dashboard/settings', label: 'Settings', group: 'Workspace', roles: WITH_VIEWER, locked: true },
  { path: '/dashboard/settings/credentials', label: 'API Credentials', group: 'Workspace', roles: ADMIN_ONLY },
];

const BY_PATH = new Map(DASHBOARD_PAGES.map((p) => [p.path, p]));

/** Pages this role may ever see, before any per-person restriction. */
export function pagesForRole(role: string): string[] {
  return DASHBOARD_PAGES.filter((p) => p.roles.includes(role as DashboardRole)).map((p) => p.path);
}

/**
 * Clean a list an administrator submitted: keep only real pages the role can
 * reach, always keep the locked ones, and return [] when it covers everything
 * the role allows - an empty list means "no restriction", so a later change to
 * the role's pages is picked up automatically.
 */
export function sanitisePagePermissions(role: string, submitted: unknown): string[] {
  const allowed = pagesForRole(role);
  if (!Array.isArray(submitted)) return [];

  const chosen = new Set(
    submitted.filter((p): p is string => typeof p === 'string' && allowed.includes(p)),
  );
  for (const p of DASHBOARD_PAGES) {
    if (p.locked && allowed.includes(p.path)) chosen.add(p.path);
  }
  return chosen.size >= allowed.length ? [] : allowed.filter((p) => chosen.has(p));
}

/** Can this person open this path? Role first, then their own restriction. */
export function canOpenPage(role: string, pagePermissions: string[] | undefined, path: string): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const page = matchPage(path);
  if (!page) return false;
  if (!page.roles.includes(role as DashboardRole)) return false;
  if (!pagePermissions?.length) return true; // no restriction set
  return page.locked || pagePermissions.includes(page.path);
}

/** Longest prefix wins, so /dashboard/settings/credentials beats /dashboard/settings. */
export function matchPage(path: string): DashboardPage | undefined {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/dashboard';
  if (BY_PATH.has(clean)) return BY_PATH.get(clean);
  const best = DASHBOARD_PAGES.filter((p) => clean === p.path || clean.startsWith(p.path + '/')).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return best;
}
