'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ListChecks, AlertTriangle, CalendarDays, CheckCircle2, Clock, PhoneCall, MessageSquare, Mail, ExternalLink, Users, Bot, UserRound,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, ToolbarDivider } from '@/components/shared/toolbar';
import { TablePagination } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { CompleteTaskDialog } from '@/components/leads/lead-calling-panel';
import { cn, formatDate } from '@/lib/utils';
import { TASK_TYPE_LABELS, relativeTime, statusLabel, statusTone } from '@/lib/pipeline';
import type { FollowUpTask } from '@/types';

const TASK_ICON: Record<string, any> = { call: PhoneCall, whatsapp: MessageSquare, email: Mail, meeting: CalendarDays, other: ListChecks };

export default function FollowUpTasksPage() {
  const router = useRouter();
  const needsWorkspace = useWorkspaceRequired();
  const role = useAuthStore((s) => s.user?.role);
  const isManager = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [window, setWindow] = useState('all');
  const [status, setStatus] = useState('pending');
  const [assignedTo, setAssignedTo] = useState('');
  const [completing, setCompleting] = useState<FollowUpTask | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['follow-up-tasks', page, limit, window, status, assignedTo],
    queryFn: () => api.get<any>('/follow-up-tasks', { page, limit, window: window === 'all' ? undefined : window, status, assignedTo: assignedTo || undefined }),
    refetchInterval: 30_000,
    enabled: !needsWorkspace,
  });
  const { data: statsData } = useQuery({ queryKey: ['follow-up-task-stats'], queryFn: () => api.get<any>('/follow-up-tasks/stats'), refetchInterval: 30_000, enabled: !needsWorkspace });
  const { data: usersData } = useQuery({ queryKey: ['users', 'assignable'], queryFn: () => api.get<any>('/users/assignable'), enabled: isManager && !needsWorkspace });

  const tasks: FollowUpTask[] = data?.data?.data || [];
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;
  const stats = statsData?.data || {};
  const users: any[] = usersData?.data?.data || usersData?.data || [];
  const nameOf = (id?: string) => { const u = users.find((x) => x._id === id); return u ? `${u.firstName} ${u.lastName}` : id ? 'Teammate' : 'Unassigned'; };

  if (needsWorkspace) return <WorkspaceRequiredNotice feature="Follow-up tasks" />;

  const leadName = (t: FollowUpTask) => (t.lead ? [t.lead.firstName, t.lead.lastName].filter(Boolean).join(' ') || t.lead.phone || 'Lead' : 'Deleted lead');

  return (
    <div>
      <PageHeader
        title={isManager ? 'Follow-up Tasks' : 'My Follow-ups'}
        description={isManager ? 'Every follow-up the AI and your team scheduled. Overdue ones alert you automatically.' : 'What the AI and you have planned — do them before they go red.'}
        icon={ListChecks}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Overdue" value={stats.overdue || 0} icon={AlertTriangle} description={stats.overdue ? 'leads going cold' : 'nothing slipping'} tone={stats.overdue ? 'danger' : 'success'} onClick={() => { setWindow('overdue'); setStatus('pending'); setPage(1); }} />
        <StatCard title="Due today" value={stats.dueToday || 0} icon={Clock} description="before end of day" tone="warning" onClick={() => { setWindow('today'); setStatus('pending'); setPage(1); }} />
        <StatCard title="Upcoming" value={stats.upcoming || 0} icon={CalendarDays} description="after today" tone="info" onClick={() => { setWindow('upcoming'); setStatus('pending'); setPage(1); }} />
        <StatCard title="Done today" value={stats.doneToday || 0} icon={CheckCircle2} description="completed follow-ups" tone="success" onClick={() => { setWindow('all'); setStatus('done'); setPage(1); }} />
      </div>

      {isManager && Array.isArray(stats.team) && stats.team.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Team load</CardTitle>
            <CardDescription>Pending follow-ups per salesperson — red means someone is falling behind.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.team.map((m: any) => (
              <button key={m.userId || 'none'} type="button" onClick={() => { setAssignedTo(m.userId || ''); setStatus('pending'); setWindow('all'); setPage(1); }} className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent', m.overdue > 0 && 'border-rose-500/40 bg-rose-500/[0.05]')}>
                <span className="truncate font-medium">{m.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{m.pending} open</span>
                  {m.overdue > 0 && <Badge variant="destructive">{m.overdue} overdue</Badge>}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Toolbar>
        <Select value={window} onValueChange={(v) => { setWindow(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any time</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {isManager && (
          <>
            <ToolbarDivider />
            <Select value={assignedTo || 'all'} onValueChange={(v) => { setAssignedTo(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="Salesperson" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map((u) => <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </Toolbar>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing here"
          description="Follow-ups appear after AI calls, logged calls and workflow steps. Change the filters above to see done or upcoming ones."
        />
      ) : (
        <div>
          <ul className="space-y-3">
            {tasks.map((t) => {
              const Icon = TASK_ICON[t.type] || ListChecks;
              const overdue = t.status === 'pending' && new Date(t.dueAt).getTime() < Date.now();
              const isAi = t.source === 'ai' || t.source === 'human_call';
              return (
                <li key={t._id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/leads/${t.leadId}`)}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/leads/${t.leadId}`)}
                    className={cn(
                      'group grid cursor-pointer gap-3 rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start',
                      overdue && 'border-rose-500/40 bg-rose-500/[0.03]',
                      t.status !== 'pending' && 'opacity-75',
                    )}
                  >
                    {/* Icon */}
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', overdue ? 'bg-rose-500/10 text-rose-600' : t.status === 'done' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-violet-500/10 text-violet-600')}>
                      {t.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>

                    {/* Body */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className={cn('text-[15px] font-semibold leading-snug', t.status !== 'pending' && 'line-through')}>{t.title}</h3>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{TASK_TYPE_LABELS[t.type]}</Badge>
                        {isAi && <Badge variant="default" className="h-5 gap-1 px-1.5 text-[10px]"><Bot className="h-3 w-3" /> AI</Badge>}
                        {(t.priority === 'high' || t.priority === 'urgent') && <Badge variant={t.priority === 'urgent' ? 'destructive' : 'warning'} className="h-5 px-1.5 text-[10px] capitalize">{t.priority}</Badge>}
                      </div>
                      {t.description && (
                        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground line-clamp-2" title={t.description}>{t.description}</p>
                      )}
                      {t.outcomeNote && t.status !== 'pending' && (
                        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground line-clamp-2">{t.outcomeNote}</p>
                      )}

                      {/* Facts row */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                          {leadName(t)}
                          {t.lead?.phone && <span className="font-normal text-muted-foreground">· {t.lead.phone}</span>}
                          {t.lead?.status && <Badge variant={statusTone(t.lead.status)} className="h-4 px-1.5 text-[10px]">{statusLabel(t.lead.status)}</Badge>}
                        </span>
                        <span className={cn('inline-flex items-center gap-1.5', overdue && 'font-semibold text-rose-600')}>
                          {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {t.status === 'pending'
                            ? `${overdue ? 'Overdue' : 'Due'} ${relativeTime(t.dueAt)} · ${formatDate(t.dueAt)}`
                            : `${t.status.charAt(0).toUpperCase() + t.status.slice(1)}${t.outcome ? ` · ${t.outcome.replace(/_/g, ' ')}` : ''}${t.completedAt ? ` · ${formatDate(t.completedAt)}` : ''}`}
                        </span>
                        {isManager && (
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" /> {nameOf(t.assignedTo)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 md:justify-end" onClick={(e) => e.stopPropagation()}>
                      {t.status === 'pending' && (
                        <Button size="sm" variant="soft" className="h-8" onClick={() => setCompleting(t)}><CheckCircle2 className="h-3.5 w-3.5" /> Done</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => router.push(`/dashboard/leads/${t.leadId}`)} aria-label="Open lead"><ExternalLink className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <TablePagination total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
      )}

      <CompleteTaskDialog task={completing} open={!!completing} onOpenChange={(o) => !o && setCompleting(null)} />
    </div>
  );
}
