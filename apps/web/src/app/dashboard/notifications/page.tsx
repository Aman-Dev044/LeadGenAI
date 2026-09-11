'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Bell, Check, CheckCheck, UserPlus, Target, ArrowLeftRight,
  MessageSquareOff, AlertTriangle, UserCheck, BookOpen, Mail,
  Smartphone, MessageCircle, Hash, Monitor, Send, BellRing,
  Eye, XCircle, CheckCircle, ChevronRight,
  CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toolbar, ToolbarSpacer } from '@/components/shared/toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Loading } from '@/components/shared/loading';
import { useUIStore } from '@/store/ui-store';
import { formatDate, cn } from '@/lib/utils';
import { useEffect } from 'react';

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  new_lead: { label: 'New Lead', icon: UserPlus, color: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
  lead_scored: { label: 'Lead Scored', icon: Target, color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  handoff_request: { label: 'Handoff', icon: ArrowLeftRight, color: 'bg-amber-500/14 text-amber-600 dark:text-amber-400' },
  conversation_ended: { label: 'Conversation Ended', icon: MessageSquareOff, color: 'bg-slate-500/12 text-slate-600 dark:text-slate-300' },
  system_alert: { label: 'System Alert', icon: AlertTriangle, color: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  assignment: { label: 'Assignment', icon: UserCheck, color: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  kb_processing: { label: 'KB Processing', icon: BookOpen, color: 'bg-teal-500/12 text-teal-600 dark:text-teal-400' },
  billing: { label: 'Billing', icon: CreditCard, color: 'bg-amber-500/14 text-amber-700 dark:text-amber-400' },
};

function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(date);
}

/** Group notifications into Today / Yesterday / Earlier buckets */
function dayGroup(date: string) {
  const d = new Date(date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return 'Today';
  if (d.getTime() >= startOfToday - 86400000) return 'Yesterday';
  if (d.getTime() >= startOfToday - 6 * 86400000) return 'This week';
  return 'Earlier';
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: any }> = {
  in_app: { label: 'In-App', icon: Monitor },
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  slack: { label: 'Slack', icon: Hash },
  teams: { label: 'Teams', icon: Monitor },
  push: { label: 'Push', icon: BellRing },
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  pending: 'warning',
  sent: 'info',
  delivered: 'success',
  failed: 'destructive',
  read: 'secondary',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { setUnreadNotificationsCount } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', typeFilter, unreadOnly],
    queryFn: () => api.get<any>('/notifications', { unreadOnly: unreadOnly ? 'true' : undefined }),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<any>('/notifications/unread-count'),
  });

  const unreadCount = (unreadData as any)?.data?.count ?? (unreadData as any)?.count ?? 0;

  useEffect(() => {
    if (unreadData !== undefined) {
      setUnreadNotificationsCount(unreadCount);
    }
  }, [unreadCount, unreadData, setUnreadNotificationsCount]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      setUnreadNotificationsCount(0);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked as read');
    },
  });

  const allNotifications = (data as any)?.data?.data || (data as any)?.data || [];

  // Client-side type filter (backend doesn't support type filter param)
  const notifications = typeFilter
    ? allNotifications.filter((n: any) => n.type === typeFilter)
    : allNotifications;

  const failedCount = allNotifications.filter((n: any) => n.status === 'failed').length;

  const handleClick = (n: any) => {
    // Mark as read if unread
    if (!n.readAt) {
      markReadMutation.mutate(n._id);
    }
    // Navigate based on data
    if (n.data?.leadId) {
      router.push(`/dashboard/leads`);
    } else if (n.data?.conversationId) {
      router.push(`/dashboard/conversations`);
    } else if (n.type === 'handoff_request') {
      router.push(`/dashboard/handoffs`);
    } else if (n.type === 'kb_processing') {
      router.push(`/dashboard/knowledge-base`);
    } else if (n.type === 'assignment') {
      router.push(`/dashboard/leads`);
    } else if (n.type === 'billing') {
      router.push(`/dashboard/billing`);
    }
  };

  const getTypeConfig = (type: string) => TYPE_CONFIG[type] || { label: type, icon: Bell, color: 'bg-muted text-muted-foreground' };

  const groups = notifications.reduce((acc: Record<string, any[]>, n: any) => {
    const g = dayGroup(n.createdAt);
    (acc[g] ||= []).push(n);
    return acc;
  }, {} as Record<string, any[]>);
  const groupOrder = ['Today', 'Yesterday', 'This week', 'Earlier'].filter((g) => groups[g]?.length);
  const getChannelConfig = (channel: string) => CHANNEL_CONFIG[channel] || { label: channel, icon: Send };

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Every alert sent to you — new leads, handoffs, scoring changes and system events."
        icon={Bell}
        actions={
          allNotifications.length > 0 ? (
            <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending || unreadCount === 0}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Unread" value={unreadCount} icon={BellRing} tone={unreadCount > 0 ? 'primary' : 'neutral'} description={unreadCount > 0 ? 'waiting for you' : "you're all caught up"} />
        <StatCard title="Total" value={allNotifications.length} icon={Bell} tone="violet" description="in your inbox" />
        <StatCard title="Failed delivery" value={failedCount} icon={XCircle} tone={failedCount > 0 ? 'danger' : 'neutral'} description="email / SMS errors" />
      </div>

      <Toolbar>
        <Tabs value={unreadOnly ? 'unread' : 'all'} onValueChange={(v) => setUnreadOnly(v === 'unread')}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="h-7 px-3">All</TabsTrigger>
            <TabsTrigger value="unread" className="h-7 px-3">
              Unread
              {unreadCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="new_lead">New Lead</SelectItem>
            <SelectItem value="lead_scored">Lead Scored</SelectItem>
            <SelectItem value="handoff_request">Handoff Request</SelectItem>
            <SelectItem value="conversation_ended">Conversation Ended</SelectItem>
            <SelectItem value="system_alert">System Alert</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="kb_processing">KB Processing</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="px-1 text-xs text-muted-foreground tabular">{notifications.length} shown</span>
      </Toolbar>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly || typeFilter ? 'No matching notifications' : 'Inbox zero'}
          description={unreadOnly || typeFilter ? 'Try changing the filters above.' : "You're all caught up. New alerts will land here in real time."}
        />
      ) : (
        <div className="space-y-6">
          {groupOrder.map((group) => (
            <section key={group}>
              <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</h2>
              <div className="overflow-hidden rounded-xl border bg-card shadow-card divide-y divide-border/70">
                {groups[group].map((n: any) => {
                  const typeCfg = getTypeConfig(n.type);
                  const channelCfg = getChannelConfig(n.channel);
                  const TypeIcon = typeCfg.icon;
                  const ChannelIcon = channelCfg.icon;
                  const isClickable = !!(n.data?.leadId || n.data?.conversationId || n.type === 'handoff_request' || n.type === 'kb_processing' || n.type === 'assignment' || n.type === 'billing');
                  const unread = !n.readAt;

                  return (
                    <div
                      key={n._id}
                      className={cn(
                        'group relative flex items-start gap-4 px-4 py-3.5 transition-colors',
                        unread && 'bg-primary/[0.04]',
                        isClickable && 'cursor-pointer hover:bg-accent/60',
                      )}
                      onClick={() => isClickable && handleClick(n)}
                    >
                      {unread && <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" />}

                      {/* Type icon tile */}
                      <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', typeCfg.color)}>
                        <TypeIcon className="h-[18px] w-[18px]" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                          {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                          <Badge variant="outline" className="h-5">{typeCfg.label}</Badge>
                        </div>
                        {n.body && <p className={cn('mt-0.5 text-sm line-clamp-2', unread ? 'text-foreground/80' : 'text-muted-foreground')}>{n.body}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="tabular" title={formatDate(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <ChannelIcon className="h-3 w-3" />
                            {channelCfg.label}
                          </span>
                          {n.status && n.status !== 'read' && (
                            <Badge variant={STATUS_VARIANT[n.status] || 'secondary'} className="h-4 px-1.5 text-[10px]">
                              {n.status === 'failed' && <XCircle className="h-2.5 w-2.5" />}
                              {n.status === 'sent' && <CheckCircle className="h-2.5 w-2.5" />}
                              {n.status}
                            </Badge>
                          )}
                        </div>
                        {n.status === 'failed' && n.errorMessage && (
                          <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{n.errorMessage}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1 self-center">
                        {unread && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            title="Mark as read"
                            onClick={(e) => {
                              e.stopPropagation();
                              markReadMutation.mutate(n._id);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {isClickable && (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            <Eye className="h-3.5 w-3.5" /> View <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
