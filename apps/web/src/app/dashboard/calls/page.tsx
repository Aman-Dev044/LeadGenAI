'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PhoneCall, Bot, Flame, Clock, Activity, XCircle, ExternalLink, AlertTriangle, Settings,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, SearchInput, ToolbarDivider } from '@/components/shared/toolbar';
import { TablePagination, TableSkeleton } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { CallDetailDialog, CallTypeIcon, OutcomeBadge } from '@/components/calls/call-detail';
import { cn, formatDate } from '@/lib/utils';
import {
  CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, CALL_TYPE_LABELS, LIVE_CALL_STATUSES, formatDuration, statusLabel, statusTone,
} from '@/lib/pipeline';
import type { CallLog, CallingReadiness } from '@/types';

export default function CallsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const needsWorkspace = useWorkspaceRequired();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<CallLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['calls', page, limit, search, type, outcome, status],
    queryFn: () => api.get<any>('/calling/calls', { page, limit, search: search || undefined, type: type || undefined, outcome: outcome || undefined, status: status || undefined }),
    // Sockets push updates instantly; this is only the safety net, quicker while a call is live
    refetchInterval: (q: any) => ((q.state.data?.data?.data || []).some((c: any) => LIVE_CALL_STATUSES.has(c.status)) ? 4_000 : 20_000),
    enabled: !needsWorkspace,
  });
  const { data: statsData } = useQuery({ queryKey: ['call-stats'], queryFn: () => api.get<any>('/calling/stats'), refetchInterval: 30_000, enabled: !needsWorkspace });
  const { data: readinessData } = useQuery({ queryKey: ['calling-readiness'], queryFn: () => api.get<any>('/calling/readiness'), enabled: !needsWorkspace });

  const calls: CallLog[] = data?.data?.data || [];
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;
  const stats = statsData?.data || {};
  const readiness: CallingReadiness | undefined = readinessData?.data;

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/calling/calls/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calls'] }); toast.success('Call cancelled'); },
    onError: (err: any) => toast.error(err.message),
  });

  if (needsWorkspace) return <WorkspaceRequiredNotice feature="Calls" />;

  const leadName = (c: CallLog) => (c.lead ? [c.lead.firstName, c.lead.lastName].filter(Boolean).join(' ') || c.lead.phone || 'Lead' : c.leadId === 'test' ? 'Test call' : 'Deleted lead');

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Every AI call, bridged call and logged call — with recordings, transcripts and what the AI decided next."
        icon={PhoneCall}
        actions={isAdmin ? <Button variant="outline" asChild><Link href="/dashboard/settings?tab=calling"><Settings className="h-4 w-4" /> AI Calling settings</Link></Button> : undefined}
      />

      {readiness && (!readiness.aiCalling.configured || !readiness.aiCalling.enabled || !readiness.webhookReachable) && isAdmin && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {!readiness.aiCalling.configured ? (
            <span>AI calling is not configured — add your Vapi key under <Link href="/dashboard/settings/credentials" className="font-medium underline underline-offset-2">API Credentials</Link>.</span>
          ) : !readiness.aiCalling.enabled ? (
            <span>AI calling is switched off. Turn it on under <Link href="/dashboard/settings?tab=calling" className="font-medium underline underline-offset-2">Settings › AI Calling</Link>.</span>
          ) : (
            <span>Webhook URL <code className="rounded bg-muted px-1">{readiness.webhookUrl}</code> is not reachable from the internet — set <code className="rounded bg-muted px-1">PUBLIC_API_URL</code> (ngrok in development) or call reports will never arrive.</span>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Calls today" value={stats.today || 0} icon={PhoneCall} description={`${stats.week || 0} in the last 7 days`} tone="primary" />
        <StatCard title="In queue / live" value={stats.pending || 0} icon={Activity} description="queued, ringing or on the phone" tone="info" />
        <StatCard title="Answer rate" value={`${stats.answerRate || 0}%`} icon={Clock} description="of finished calls this week" tone="violet" />
        <StatCard title="Interested" value={`${stats.interestRate || 0}%`} icon={Flame} description="of answered calls this week" tone="success" />
      </div>

      <Toolbar>
        <SearchInput placeholder="Search by lead name, phone, company…" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <ToolbarDivider />
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(CALL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcome || 'all'} onValueChange={(v) => { setOutcome(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            {Object.entries(CALL_OUTCOME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {Object.entries(CALL_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>

      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Lead</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Summary / next step</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><PhoneCall className="h-5 w-5" /></div>
                      <p className="text-sm font-medium text-foreground">No calls yet</p>
                      <p className="text-xs">Add a lead with a phone number — the AI calls it within minutes when calling is on.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => {
                  const live = LIVE_CALL_STATUSES.has(c.status);
                  const il = c.analysis?.interestLevel;
                  return (
                    <TableRow key={c._id} className="cursor-pointer" onClick={() => !live && setSelected(c)}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{leadName(c)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.toNumber}
                            {c.lead?.status && <> · <Badge variant={statusTone(c.lead.status)} className="h-4 px-1.5 text-[10px]">{statusLabel(c.lead.status)}</Badge></>}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', c.type.startsWith('ai') ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600')}><CallTypeIcon type={c.type} className="h-3.5 w-3.5" /></span>
                          {CALL_TYPE_LABELS[c.type] || c.type}{c.attempt > 1 ? <span className="text-xs text-muted-foreground">#{c.attempt}</span> : null}
                        </span>
                      </TableCell>
                      <TableCell><OutcomeBadge outcome={c.outcome} status={c.status} /></TableCell>
                      <TableCell>{typeof il === 'number' ? <span className={cn('font-semibold tabular', il >= 70 ? 'text-rose-600' : il >= 40 ? 'text-amber-600' : 'text-muted-foreground')}>{il}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-[360px]">
                        <p className="truncate text-sm">{c.summary || c.notes || c.errorMessage || (live ? CALL_STATUS_LABELS[c.status] : '—')}</p>
                        {c.analysis?.nextAction && c.analysis.nextAction.type !== 'none' && <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">→ {c.analysis.nextAction.title}</p>}
                      </TableCell>
                      <TableCell className="text-sm tabular">{c.durationSeconds ? formatDuration(c.durationSeconds) : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.startedAt || c.scheduledAt || c.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {live && (c.status === 'queued' || c.status === 'scheduled') ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600" onClick={() => cancel.mutate(c._id)} aria-label="Cancel call"><XCircle className="h-4 w-4" /></Button>
                        ) : c.leadId !== 'test' ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => router.push(`/dashboard/leads/${c.leadId}`)} aria-label="Open lead"><ExternalLink className="h-4 w-4" /></Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
      )}

      <CallDetailDialog call={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} showLead />
    </div>
  );
}
