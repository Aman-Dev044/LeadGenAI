/**
 * Single source of truth for what each workspace role can see and do in the dashboard.
 * The API enforces the same rules (RolesGuard + per-endpoint @Roles).
 *
 *  ADMIN          full workspace access (all leads, team members, bots, settings, billing)
 *  SALESPERSON    works their own leads, chats, handoffs, appointments and personal dashboard
 *  SUPER_ADMIN    platform owner, bypasses everything
 */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SALESPERSON';

const ALL: Role[] = ['ADMIN', 'SALESPERSON'];
const MANAGERS: Role[] = ['ADMIN'];
const TEAM: Role[] = ['ADMIN', 'SALESPERSON'];
const ADMIN_ONLY: Role[] = ['ADMIN'];

/** Which roles may open each dashboard route (prefix match, longest wins). */
export const PAGE_ACCESS: Record<string, Role[]> = {
  '/dashboard': ALL,
  '/dashboard/leads': ALL,
  '/dashboard/conversations': TEAM,
  '/dashboard/handoffs': TEAM,
  '/dashboard/appointments': ALL,
  '/dashboard/agents': ADMIN_ONLY,
  '/dashboard/knowledge-base': ADMIN_ONLY,
  '/dashboard/lead-scoring': ADMIN_ONLY,
  '/dashboard/follow-ups': ADMIN_ONLY,
  '/dashboard/integrations': ADMIN_ONLY,
  '/dashboard/webhooks': ADMIN_ONLY,
  '/dashboard/api-keys': ADMIN_ONLY,
  '/dashboard/analytics': ADMIN_ONLY,
  '/dashboard/visitor-tracking': ADMIN_ONLY,
  '/dashboard/notifications': ALL,
  '/dashboard/users': ADMIN_ONLY,
  '/dashboard/support-tickets': TEAM,
  '/dashboard/billing': ADMIN_ONLY,
  '/dashboard/settings': ALL,
};

/** Where a role lands after login / when a page is off-limits. */
export const homePathFor = (_role?: string | null) => '/dashboard';

/** True when `role` may open `pathname` (owner console is handled by its own layout). */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (pathname.startsWith('/dashboard/admin')) return false;
  // Dashboard home is accessible to all workspace users
  if (pathname === '/dashboard') return true;
  const match = Object.keys(PAGE_ACCESS)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return true;
  return PAGE_ACCESS[match].includes(role as Role);
}

const is = (role: string | null | undefined, ...roles: Role[]) =>
  !!role && (role === 'SUPER_ADMIN' || roles.includes(role as Role));

/** Fine-grained UI capabilities, mirrored from the API's @Roles decorators. */
export const perms = {
  isViewer: (role?: string | null) => role === 'VIEWER',
  isSalesperson: (role?: string | null) => role === 'SALESPERSON',
  /** ADMIN / SALES_MANAGER (or owner) */
  isManager: (role?: string | null) => is(role, ...MANAGERS),

  // Leads
  createLead: (role?: string | null) => is(role, ...TEAM),
  editLead: (role?: string | null) => is(role, ...TEAM),
  deleteLead: (role?: string | null) => is(role, ...MANAGERS),
  importExportLeads: (role?: string | null) => is(role, ...MANAGERS),
  bulkAssignLeads: (role?: string | null) => is(role, ...MANAGERS),
  /** Reassigning a lead to someone else is a manager call; a salesperson keeps their own. */
  reassignLead: (role?: string | null) => is(role, ...MANAGERS),

  // Appointments
  createAppointment: (role?: string | null) => is(role, ...TEAM),
  editAppointment: (role?: string | null) => is(role, ...TEAM),
  deleteAppointment: (role?: string | null) => is(role, ...MANAGERS),

  // Conversations
  takeOverConversation: (role?: string | null) => is(role, ...MANAGERS),
  summarizeConversation: (role?: string | null) => is(role, ...MANAGERS),
  replyInConversation: (role?: string | null) => is(role, ...TEAM),

  // Support tickets
  createTicket: (role?: string | null) => is(role, ...MANAGERS),
  manageTicket: (role?: string | null) => is(role, ...MANAGERS),
  noteOnTicket: (role?: string | null) => is(role, ...TEAM),
};
