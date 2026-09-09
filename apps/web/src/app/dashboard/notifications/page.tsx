'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Bell, Check, CheckCheck, UserPlus, Target, ArrowLeftRight,
  MessageSquareOff, AlertTriangle, UserCheck, BookOpen, Mail,
  Smartphone, MessageCircle, Hash, Monitor, Send, BellRing,
  Filter, Eye, XCircle, CheckCircle,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Loading } from '@/components/shared/loading';
import { useUIStore } from '@/store/ui-store';
import { formatDate, cn } from '@/lib/utils';
import { useEffect } from 'react';

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  new_lead: { label: 'New Lead', icon: UserPlus, color: 'text-blue-500' },
  lead_scored: { label: 'Lead Scored', icon: Target, color: 'text-green-500' },
  handoff_request: { label: 'Handoff', icon: ArrowLeftRight, color: 'text-orange-500' },
  conversation_ended: { label: 'Conversation Ended', icon: MessageSquareOff, color: 'text-gray-500' },
  system_alert: { label: 'System Alert', icon: AlertTriangle, color: 'text-red-500' },
  assignment: { label: 'Assignment', icon: UserCheck, color: 'text-purple-500' },
  kb_processing: { label: 'KB Processing', icon: BookOpen, color: 'text-teal-500' },
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: any }> = {
  in_app: { label: 'In-App', icon: Monitor },
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  slack: { label: 'Slack', icon: Hash },
  teams: { label: 'Teams', icon: Monitor },
  push: { label: 'Push', icon: BellRing },
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  pending: 'warning',
  sent: 'default',
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
    }
  };

  const getTypeConfig = (type: string) => TYPE_CONFIG[type] || { label: type, icon: Bell, color: 'text-muted-foreground' };
  const getChannelConfig = (channel: string) => CHANNEL_CONFIG[channel] || { label: channel, icon: Send };

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated on important events"
        actions={
          notifications.length > 0 ? (
            <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Unread" value={unreadCount} icon={Bell} />
        <StatCard title="Total Notifications" value={allNotifications.length} icon={CheckCheck} />
        <StatCard title="Failed Delivery" value={failedCount} icon={XCircle} />
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
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
          </SelectContent>
        </Select>

        <Button
          variant={unreadOnly ? 'default' : 'outline'}
          size="sm"
          className="h-10"
          onClick={() => setUnreadOnly(!unreadOnly)}
        >
          <Filter className="mr-2 h-4 w-4" /> {unreadOnly ? 'Showing Unread' : 'Show Unread Only'}
        </Button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly || typeFilter ? 'No matching notifications' : 'No notifications'}
          description={unreadOnly || typeFilter ? 'Try changing the filters' : "You're all caught up!"}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const typeCfg = getTypeConfig(n.type);
            const channelCfg = getChannelConfig(n.channel);
            const TypeIcon = typeCfg.icon;
            const ChannelIcon = channelCfg.icon;
            const isClickable = !!(n.data?.leadId || n.data?.conversationId || n.type === 'handoff_request' || n.type === 'kb_processing' || n.type === 'assignment');

            return (
              <Card
                key={n._id}
                className={cn(
                  'transition-colors',
                  !n.readAt && 'border-primary/30 bg-primary/5',
                  isClickable && 'cursor-pointer hover:bg-accent/50',
                )}
                onClick={() => isClickable && handleClick(n)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Type Icon */}
                  <div className={cn('flex-shrink-0', typeCfg.color)}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{n.title}</p>
                      {!n.readAt && <Badge variant="default" className="text-xs">New</Badge>}
                      <Badge variant="outline" className="text-xs">{typeCfg.label}</Badge>
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ChannelIcon className="h-3 w-3" />
                        {channelCfg.label}
                      </span>
                      {n.status && n.status !== 'read' && (
                        <Badge variant={STATUS_VARIANT[n.status] || 'secondary'} className="text-xs h-5">
                          {n.status === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
                          {n.status === 'sent' && <CheckCircle className="mr-1 h-3 w-3" />}
                          {n.status}
                        </Badge>
                      )}
                      {isClickable && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Eye className="h-3 w-3" /> View
                        </span>
                      )}
                    </div>
                    {n.status === 'failed' && n.errorMessage && (
                      <p className="text-xs text-destructive mt-1">{n.errorMessage}</p>
                    )}
                  </div>

                  {/* Mark Read Button */}
                  {!n.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(n._id);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
