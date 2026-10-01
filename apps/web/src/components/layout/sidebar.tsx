'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MessageSquare, Bot, BookOpen, BarChart3,
  Bell, Settings, CreditCard, Ticket, ArrowLeftRight, Calendar,
  Workflow, Globe, Key, Webhook, Target, UserCog, ChevronLeft,
  ChevronRight, Crown, Building2, Gauge, ScrollText,
  Megaphone, SlidersHorizontal, Activity, ShieldCheck, Plug, UserX, Radar, Radio, KeyRound,
  PhoneCall, ListChecks, type LucideIcon,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useUIStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import { PAGE_ACCESS } from '@/lib/permissions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogoMark, PoweredBy } from '@/components/brand/logo';
import { BRAND } from '@/lib/brand';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: string;
  exact?: boolean;
  roles?: string[];
};
type NavGroup = { title: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        exact: true,
        roles: PAGE_ACCESS['/dashboard'],
      },
    ],
  },
  {
    title: 'Pipeline',
    items: [
      { label: 'Leads', href: '/dashboard/leads', icon: Users, badgeKey: 'leads', roles: PAGE_ACCESS['/dashboard/leads'] },
      { label: 'Follow-up Tasks', href: '/dashboard/follow-up-tasks', icon: ListChecks, badgeKey: 'tasks', roles: PAGE_ACCESS['/dashboard/follow-up-tasks'] },
      { label: 'Calls', href: '/dashboard/calls', icon: PhoneCall, roles: PAGE_ACCESS['/dashboard/calls'] },
      { label: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare, roles: PAGE_ACCESS['/dashboard/conversations'] },
      { label: 'Handoffs', href: '/dashboard/handoffs', icon: ArrowLeftRight, badgeKey: 'handoffs', roles: PAGE_ACCESS['/dashboard/handoffs'] },
      { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar, roles: PAGE_ACCESS['/dashboard/appointments'] },
    ],
  },
  {
    title: 'AI Engine',
    items: [
      { label: 'Agents', href: '/dashboard/agents', icon: Bot, roles: PAGE_ACCESS['/dashboard/agents'] },
      { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen, roles: PAGE_ACCESS['/dashboard/knowledge-base'] },
      { label: 'Lead Scoring', href: '/dashboard/lead-scoring', icon: Target, roles: PAGE_ACCESS['/dashboard/lead-scoring'] },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'AI Automation', href: '/dashboard/ai-automation', icon: Radar, badgeKey: 'aiAutomation', roles: PAGE_ACCESS['/dashboard/ai-automation'] },
      { label: 'Leads Scrap AI', href: '/dashboard/leads-scrap-ai', icon: Radio, badgeKey: 'leadsScrapAi', roles: PAGE_ACCESS['/dashboard/leads-scrap-ai'] },
      { label: 'Workflows', href: '/dashboard/follow-ups', icon: Workflow, roles: PAGE_ACCESS['/dashboard/follow-ups'] },
      { label: 'Integrations', href: '/dashboard/integrations', icon: Plug, roles: PAGE_ACCESS['/dashboard/integrations'] },
      { label: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook, roles: PAGE_ACCESS['/dashboard/webhooks'] },
      { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, roles: PAGE_ACCESS['/dashboard/api-keys'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, roles: PAGE_ACCESS['/dashboard/analytics'] },
      { label: 'Visitor Tracking', href: '/dashboard/visitor-tracking', icon: Globe, roles: PAGE_ACCESS['/dashboard/visitor-tracking'] },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badgeKey: 'notifications', roles: PAGE_ACCESS['/dashboard/notifications'] },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Users', href: '/dashboard/users', icon: UserCog, roles: PAGE_ACCESS['/dashboard/users'] },
      { label: 'Support Tickets', href: '/dashboard/support-tickets', icon: Ticket, roles: PAGE_ACCESS['/dashboard/support-tickets'] },
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, roles: PAGE_ACCESS['/dashboard/billing'] },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, exact: true, roles: PAGE_ACCESS['/dashboard/settings'] },
      { label: 'API Credentials', href: '/dashboard/settings/credentials', icon: KeyRound, roles: PAGE_ACCESS['/dashboard/settings/credentials'] },
    ],
  },
];

/** Owner console - only rendered for SUPER_ADMIN when not impersonating. */
export const ownerNavItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard/admin', icon: Crown, exact: true },
  { label: 'Tenants', href: '/dashboard/admin/tenants', icon: Building2 },
  { label: 'All Users', href: '/dashboard/admin/users', icon: ShieldCheck },
  { label: 'Usage & Limits', href: '/dashboard/admin/usage', icon: Gauge },
  { label: 'Audit Logs', href: '/dashboard/admin/audit-logs', icon: ScrollText },
  { label: 'Announcements', href: '/dashboard/admin/announcements', icon: Megaphone },
  { label: 'Deletion Requests', href: '/dashboard/admin/deletion-requests', icon: UserX, badgeKey: 'deletionRequests' },
  { label: 'Platform Settings', href: '/dashboard/admin/settings', icon: SlidersHorizontal },
  { label: 'System Health', href: '/dashboard/admin/system', icon: Activity },
];

/** Flat list used by the header's quick-jump search. */
export const allNavItems = (isOwner: boolean, userRole?: string): NavItem[] => [
  ...(isOwner ? ownerNavItems.map((i) => ({ ...i, label: `Owner · ${i.label}` })) : []),
  ...navGroups
    .filter((g) => !(isOwner && g.title === 'Overview'))
    .flatMap((g) =>
      g.items.filter((item) => {
        if (!userRole || userRole === 'SUPER_ADMIN') return true;
        return !item.roles || item.roles.includes(userRole);
      }),
    ),
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, tenant, impersonation } = useAuthStore();
  const {
    sidebarOpen,
    toggleSidebar,
    unreadNotificationsCount,
    hasNewHandoff,
    pendingHandoffsCount,
    hasNewLead,
    newLeadsCount,
    clearHandoffBadge,
    clearLeadBadge,
    seenCounts,
    markSeen,
  } = useUIStore();

  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;

  const { data: adminDeletionData } = useQuery({
    queryKey: ['admin-deletion-requests-count'],
    queryFn: async () => {
      const res: any = await api.get('/account-deletion/admin/requests?status=pending&limit=1');
      return res?.data?.pendingCount ?? res?.pendingCount ?? 0;
    },
    enabled: !!isOwner,
    refetchInterval: 30_000,
  });
  const pendingDeletionCount = typeof adminDeletionData === 'number' ? adminDeletionData : 0;

  // Prospects waiting to be reviewed in AI Automation (admins and the owner only)
  const canSeeAutomation = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const { data: automationPending } = useQuery({
    queryKey: ['ai-automation-pending'],
    queryFn: async () => {
      const res: any = await api.get('/lead-automation/prospects/stats');
      return res?.data?.pending ?? res?.pending ?? 0;
    },
    enabled: !!canSeeAutomation,
    refetchInterval: 60_000,
  });
  const pendingProspectCount = typeof automationPending === 'number' ? automationPending : 0;

  // Posts waiting to be reviewed in Leads Scrap AI (admins and the owner only)
  const { data: scrapPending } = useQuery({
    queryKey: ['leads-scrap-ai-pending'],
    queryFn: async () => {
      const res: any = await api.get('/social-prospecting/posts/stats');
      return res?.data?.pending ?? res?.pending ?? 0;
    },
    enabled: !!canSeeAutomation,
    refetchInterval: 60_000,
  });
  const pendingScrapCount = typeof scrapPending === 'number' ? scrapPending : 0;

  // Follow-ups that are due or overdue for this user (managers: whole team)
  const canSeeTasks = user?.role === 'ADMIN' || user?.role === 'SALESPERSON' || user?.role === 'SUPER_ADMIN';
  const { data: taskStats } = useQuery({
    queryKey: ['follow-up-task-stats'],
    queryFn: async () => {
      const res: any = await api.get('/follow-up-tasks/stats');
      const s = res?.data || res || {};
      return (Number(s.overdue) || 0) + (Number(s.dueToday) || 0);
    },
    enabled: !!canSeeTasks && !(isOwner && (!useAuthStore.getState().activeTenantId || useAuthStore.getState().activeTenantId === 'all')),
    refetchInterval: 60_000,
  });
  const dueTaskCount = typeof taskStats === 'number' ? taskStats : 0;

  // Clear badges when active section is viewed
  useEffect(() => {
    if (pathname.startsWith('/dashboard/handoffs')) clearHandoffBadge();
    // `/dashboard/leads` must not swallow `/dashboard/leads-scrap-ai`.
    if (pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads/')) clearLeadBadge();
  }, [pathname, clearHandoffBadge, clearLeadBadge]);

  /**
   * Badges backed by a live server count cannot simply be zeroed on click - the
   * next refetch would bring them straight back. Instead, record what the user
   * has seen and badge only what arrived after that. The watermark also follows
   * the count downwards, so items cleared elsewhere do not mute future arrivals.
   */
  useEffect(() => {
    const sync = (key: string, href: string, count: number) => {
      if (pathname === href || pathname.startsWith(href + '/') || count < (seenCounts[key] ?? 0)) {
        markSeen(key, count);
      }
    };
    sync('leadsScrapAi', '/dashboard/leads-scrap-ai', pendingScrapCount);
    sync('aiAutomation', '/dashboard/ai-automation', pendingProspectCount);
  }, [pathname, pendingScrapCount, pendingProspectCount, seenCounts, markSeen]);

  /** Items that arrived since the user last looked at that section. */
  const unseen = (key: string, count: number) => Math.max(0, count - (seenCounts[key] ?? 0));

  const getBadge = (key?: string) => {
    if (key === 'notifications' && unreadNotificationsCount > 0) {
      return { count: unreadNotificationsCount, label: unreadNotificationsCount > 99 ? '99+' : `${unreadNotificationsCount}` };
    }
    if (key === 'handoffs' && (hasNewHandoff || pendingHandoffsCount > 0)) {
      const cnt = pendingHandoffsCount > 0 ? pendingHandoffsCount : 1;
      return { count: cnt, label: cnt > 99 ? '99+' : `${cnt}` };
    }
    if (key === 'leads' && (hasNewLead || newLeadsCount > 0)) {
      const cnt = newLeadsCount > 0 ? newLeadsCount : 1;
      return { count: cnt, label: cnt > 99 ? '99+' : `${cnt}` };
    }
    if (key === 'aiAutomation') {
      const cnt = unseen('aiAutomation', pendingProspectCount);
      if (cnt > 0) return { count: cnt, label: cnt > 99 ? '99+' : `${cnt}` };
    }
    if (key === 'leadsScrapAi') {
      const cnt = unseen('leadsScrapAi', pendingScrapCount);
      if (cnt > 0) return { count: cnt, label: cnt > 99 ? '99+' : `${cnt}` };
    }
    if (key === 'tasks' && dueTaskCount > 0) {
      return { count: dueTaskCount, label: dueTaskCount > 99 ? '99+' : `${dueTaskCount}` };
    }
    if (key === 'deletionRequests' && pendingDeletionCount > 0) {
      return { count: pendingDeletionCount, label: pendingDeletionCount > 99 ? '99+' : `${pendingDeletionCount}` };
    }
    return null;
  };

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

  const renderItem = (item: NavItem, accent = false) => {
    const active = isActive(item);
    const badge = getBadge(item.badgeKey);

    const link = (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-all duration-150',
          active
            ? accent
              ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
              : 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/80 hover:bg-accent hover:text-foreground',
          !sidebarOpen && 'justify-center px-0 h-10 w-10 mx-auto',
        )}
      >
        {active && sidebarOpen && (
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
              accent ? 'bg-amber-500' : 'bg-primary',
            )}
          />
        )}
        <div className="relative">
          <item.icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110',
              active && 'drop-shadow-[0_0_6px_color-mix(in_srgb,currentColor_50%,transparent)]',
            )}
            strokeWidth={active ? 2.25 : 1.9}
          />
          {!sidebarOpen && badge && (
            <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-sidebar"></span>
            </span>
          )}
        </div>

        {sidebarOpen && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {badge && (
              <span className="ml-auto flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-rose-500/40">
                {badge.label}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (!sidebarOpen) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{item.label}</span>
            {badge && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{badge.label}</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const GroupTitle = ({ children }: { children: React.ReactNode }) =>
    sidebarOpen ? (
      <p className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 first:pt-0">
        {children}
      </p>
    ) : (
      <div className="mx-3 my-2 border-t border-border/70" />
    );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar transition-[width] duration-300',
        sidebarOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Brand */}
      <div className={cn('flex h-16 items-center border-b px-4', !sidebarOpen && 'justify-center px-0')}>
        <Link href={isOwner ? '/dashboard/admin' : '/dashboard'} className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9 shrink-0" />
          {sidebarOpen && (
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-bold tracking-tight">{BRAND.name}</span>
                {isOwner && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Owner
                  </span>
                )}
              </div>
              <p className="max-w-[150px] truncate text-[10.5px] text-muted-foreground">
                {tenant?.name || BRAND.taglineShort}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className={cn('flex flex-col gap-0.5 py-3', sidebarOpen ? 'px-3' : 'px-0 items-center')}>
          {isOwner && (
            <>
              <GroupTitle>Owner console</GroupTitle>
              {ownerNavItems.map((item) => renderItem(item, true))}
            </>
          )}
          {navGroups
            .filter((group) => !(isOwner && group.title === 'Overview'))
            .map((group) => {
              const visibleItems = group.items.filter((item) => {
                if (!user?.role || user.role === 'SUPER_ADMIN') return true;
                return !item.roles || item.roles.includes(user.role);
              });
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title} className="contents">
                  <GroupTitle>{group.title}</GroupTitle>
                  {visibleItems.map((item) => renderItem(item))}
                </div>
              );
            })}
        </nav>
      </ScrollArea>

      {/* User + collapse */}
      <div className={cn('border-t p-3', !sidebarOpen && 'px-2')}>
        {sidebarOpen ? (
          <>
            <div className="flex items-center gap-2.5 rounded-xl border bg-card/70 p-2 shadow-xs">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} alt={user?.firstName} />
                <AvatarFallback>{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="truncate text-[11px] text-muted-foreground capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 space-y-1 px-1.5 text-[11px] text-muted-foreground/75">
              <div className="flex items-center justify-between">
                <Link
                  href="/privacy"
                  target="_blank"
                  className="transition-colors hover:text-foreground hover:underline"
                >
                  Privacy Policy
                </Link>
                <span>·</span>
                <span className="font-mono text-[10px]">{BRAND.taglineShort}</span>
              </div>
              <PoweredBy className="text-[9.5px] leading-tight text-muted-foreground/70" />
            </div>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="flex h-10 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
