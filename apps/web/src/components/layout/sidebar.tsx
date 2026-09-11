'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MessageSquare, Bot, BookOpen, BarChart3,
  Bell, Settings, CreditCard, Ticket, ArrowLeftRight, Calendar,
  Workflow, Globe, Key, Webhook, Target, UserCog, ChevronLeft,
  ChevronRight, Sparkles, Crown, Building2, Gauge, ScrollText,
  Megaphone, SlidersHorizontal, Activity, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
        roles: ['ADMIN', 'SALES_MANAGER', 'VIEWER'],
      },
    ],
  },
  {
    title: 'Pipeline',
    items: [
      { label: 'Leads', href: '/dashboard/leads', icon: Users, badgeKey: 'leads', roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'] },
      { label: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare, roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'] },
      { label: 'Handoffs', href: '/dashboard/handoffs', icon: ArrowLeftRight, badgeKey: 'handoffs', roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] },
      { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar, roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'] },
    ],
  },
  {
    title: 'AI Engine',
    items: [
      { label: 'Agents', href: '/dashboard/agents', icon: Bot, roles: ['ADMIN', 'SALES_MANAGER'] },
      { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen, roles: ['ADMIN', 'SALES_MANAGER'] },
      { label: 'Lead Scoring', href: '/dashboard/lead-scoring', icon: Target, roles: ['ADMIN', 'SALES_MANAGER'] },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'Follow-ups', href: '/dashboard/follow-ups', icon: Workflow, roles: ['ADMIN', 'SALES_MANAGER'] },
      { label: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook, roles: ['ADMIN'] },
      { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, roles: ['ADMIN', 'SALES_MANAGER', 'VIEWER'] },
      { label: 'Visitor Tracking', href: '/dashboard/visitor-tracking', icon: Globe, roles: ['ADMIN', 'SALES_MANAGER'] },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badgeKey: 'notifications', roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'] },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Users', href: '/dashboard/users', icon: UserCog, roles: ['ADMIN'] },
      { label: 'Support Tickets', href: '/dashboard/support-tickets', icon: Ticket, roles: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] },
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, roles: ['ADMIN'] },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['ADMIN'] },
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
  } = useUIStore();

  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;

  // Clear badges when active section is viewed
  useEffect(() => {
    if (pathname.startsWith('/dashboard/handoffs')) clearHandoffBadge();
    if (pathname.startsWith('/dashboard/leads')) clearLeadBadge();
  }, [pathname, clearHandoffBadge, clearLeadBadge]);

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
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/30">
            <Sparkles className="h-[18px] w-[18px]" />
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </div>
          {sidebarOpen && (
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-bold tracking-tight">LeadAI</span>
                {isOwner && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground truncate max-w-[150px]">
                {tenant?.name || 'AI sales workspace'}
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
