'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MessageSquare, Bot, BookOpen, BarChart3,
  Bell, Settings, CreditCard, Ticket, ArrowLeftRight, Calendar,
  Workflow, Globe, Key, Webhook, Target, UserCog, ChevronLeft,
  ChevronRight, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads', href: '/dashboard/leads', icon: Users, badgeKey: 'leads' },
  { label: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare },
  { label: 'Agents', href: '/dashboard/agents', icon: Bot },
  { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
  { label: 'Follow-ups', href: '/dashboard/follow-ups', icon: Workflow },
  { label: 'Handoffs', href: '/dashboard/handoffs', icon: ArrowLeftRight, badgeKey: 'handoffs' },
  { label: 'Support Tickets', href: '/dashboard/support-tickets', icon: Ticket },
  { label: 'Lead Scoring', href: '/dashboard/lead-scoring', icon: Target },
  { label: 'Visitor Tracking', href: '/dashboard/visitor-tracking', icon: Globe },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badgeKey: 'notifications' },
  { label: 'Users', href: '/dashboard/users', icon: UserCog },
  { label: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
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

  // Clear badges when active section is viewed
  useEffect(() => {
    if (pathname.startsWith('/dashboard/handoffs')) {
      clearHandoffBadge();
    }
    if (pathname.startsWith('/dashboard/leads')) {
      clearLeadBadge();
    }
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

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16',
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        {sidebarOpen ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">LeadAI</span>
          </Link>
        ) : (
          <Sparkles className="h-6 w-6 text-primary mx-auto" />
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-3.5rem-3rem)]">
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const badge = getBadge(item.badgeKey);

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  !sidebarOpen && 'justify-center px-2',
                )}
              >
                <div className="relative">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarOpen && badge && (
                    <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 ring-2 ring-background"></span>
                    </span>
                  )}
                </div>

                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && (
                      <span className="ml-auto flex items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ring-2 ring-red-500/20 animate-pulse">
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
                      <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {badge.label}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>
      </ScrollArea>

      <div className="absolute bottom-0 w-full border-t p-2">
        <Button variant="ghost" size="icon" className="w-full" onClick={toggleSidebar}>
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
