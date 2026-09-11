'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle, XCircle, CheckCheck, Eye, Clock, UserCheck, Ban, MessageSquare, Bot, Smile, Frown, Meh, Sparkles } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { Toolbar, ToolbarSpacer } from '@/components/shared/toolbar';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  pending: 'warning', accepted: 'info', rejected: 'destructive', completed: 'success', expired: 'secondary',
};

const SENTIMENT: Record<string, { icon: any; cls: string }> = {
  positive: { icon: Smile, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  negative: { icon: Frown, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  neutral: { icon: Meh, cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
};

function SentimentChip({ value }: { value?: string }) {
  if (!value) return null;
  const cfg = SENTIMENT[value.toLowerCase()] || SENTIMENT.neutral;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {value}
    </span>
  );
}

/** "3m ago", "2h ago" style relative time */
function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HandoffsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');

  // Reject with notes
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Complete with notes
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');

  // Detail view
  const [viewHandoff, setViewHandoff] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['handoffs', page, limit, statusFilter],
    queryFn: () => api.get<any>('/handoffs', { page, limit, status: statusFilter || undefined }),
  });

  const { data: pendingData } = useQuery({
    queryKey: ['handoffs', 'pending-count'],
    queryFn: () => api.get<any>('/handoffs/pending-count'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/handoffs/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoffs'] });
      toast.success('Handoff accepted - conversation assigned to you');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/handoffs/${id}/reject`, notes ? { notes } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoffs'] });
      setRejectId(null);
      setRejectNotes('');
      toast.success('Handoff rejected - conversation returned to bot');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/handoffs/${id}/complete`, notes ? { notes } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoffs'] });
      setCompleteId(null);
      setCompleteNotes('');
      toast.success('Handoff completed - conversation ended');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handoffs = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;
  const pendingCount = (pendingData as any)?.data?.count ?? 0;

  // Compute stat counts from current data
  const acceptedCount = handoffs.filter((h: any) => h.status === 'accepted').length;
  const rejectedCount = handoffs.filter((h: any) => h.status === 'rejected').length;
  const completedCount = handoffs.filter((h: any) => h.status === 'completed').length;

  const pendingHandoffs = handoffs.filter((h: any) => h.status === 'pending');
  const otherHandoffs = statusFilter === 'pending' ? [] : handoffs.filter((h: any) => h.status !== 'pending');

  const columns = [
    {
      key: 'reason', label: 'Reason', render: (h: any) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate max-w-[320px]">{h.reason || 'No reason'}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <SentimentChip value={h.context?.sentiment} />
              {h.conversationId && <code className="text-[11px] text-muted-foreground">conv …{h.conversationId.slice(-6)}</code>}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (h: any) => <Badge variant={statusColors[h.status]} dot>{h.status}</Badge> },
    { key: 'createdAt', label: 'Requested', render: (h: any) => <div className="text-xs"><div className="font-medium">{timeAgo(h.createdAt)}</div><div className="text-muted-foreground tabular">{formatDate(h.createdAt)}</div></div> },
    {
      key: 'timestamps', label: 'Resolved', render: (h: any) => {
        const t = h.completedAt || h.rejectedAt || h.acceptedAt;
        return <span className="text-xs text-muted-foreground tabular">{t ? formatDate(t) : '-'}</span>;
      },
    },
    {
      key: 'actions', label: '', className: 'text-right', render: (h: any) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Details" onClick={(e) => { e.stopPropagation(); setViewHandoff(h); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {h.status === 'pending' && (
            <>
              <Button size="xs" variant="soft" onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(h._id); }}>
                <CheckCircle className="h-3 w-3" /> Accept
              </Button>
              <Button size="xs" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setRejectId(h._id); }}>
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </>
          )}
          {h.status === 'accepted' && (
            <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setCompleteId(h._id); }}>
              <CheckCheck className="h-3 w-3" /> Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Handoffs"
        description="Conversations the AI escalated to a human. Accept to take over live, reject to hand it back to the bot."
        icon={ArrowLeftRight}
        actions={pendingCount > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" /></span>
            {pendingCount} waiting for a human
          </span>
        ) : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard title="Pending" value={pendingCount} icon={Clock} tone="warning" description="awaiting response" />
        <StatCard title="Accepted" value={acceptedCount} icon={UserCheck} tone="info" description="live with a human" />
        <StatCard title="Completed" value={completedCount} icon={CheckCheck} tone="success" description="on this page" />
        <StatCard title="Rejected" value={rejectedCount} icon={Ban} tone="danger" description="returned to bot" />
      </div>

      {/* Pending queue */}
      {!isLoading && pendingHandoffs.length > 0 && (statusFilter === '' || statusFilter === 'pending') && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>
            <h2 className="text-sm font-semibold">Waiting for you</h2>
            <span className="text-xs text-muted-foreground">Visitors are on the line — respond quickly.</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pendingHandoffs.map((h: any) => (
              <Card key={h._id} className="relative overflow-hidden border-amber-500/30 p-5 shadow-glow">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/15 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug line-clamp-2">{h.reason || 'Visitor requested a human'}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3" /> waiting {timeAgo(h.createdAt)}</span>
                      <SentimentChip value={h.context?.sentiment} />
                    </div>
                  </div>
                </div>
                {h.context?.conversationSummary && (
                  <p className="relative mt-3 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground line-clamp-3">
                    <Sparkles className="mr-1 inline h-3 w-3 text-primary" />{h.context.conversationSummary}
                  </p>
                )}
                <div className="relative mt-4 flex items-center gap-2">
                  <Button variant="gradient" size="sm" className="flex-1" onClick={() => acceptMutation.mutate(h._id)} disabled={acceptMutation.isPending}>
                    <CheckCircle className="h-4 w-4" /> Accept
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRejectId(h._id)}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="Details" onClick={() => setViewHandoff(h)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Toolbar>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="px-1 text-xs text-muted-foreground tabular">{total} handoff{total === 1 ? '' : 's'}</span>
      </Toolbar>

      <DataTable columns={columns} data={statusFilter === '' ? otherHandoffs : handoffs} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} emptyMessage={statusFilter === '' && pendingHandoffs.length > 0 ? 'No resolved handoffs on this page' : 'No handoffs yet'} emptyDescription="When the AI escalates a chat to a human it will show up here." />

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={() => { setRejectId(null); setRejectNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Handoff</DialogTitle>
            <DialogDescription>Conversation will be returned to bot mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNotes(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectId && rejectMutation.mutate({ id: rejectId, notes: rejectNotes.trim() || undefined })} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeId} onOpenChange={() => { setCompleteId(null); setCompleteNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Handoff</DialogTitle>
            <DialogDescription>Mark this handoff as completed. The conversation will be ended.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} rows={3} placeholder="Resolution notes..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCompleteId(null); setCompleteNotes(''); }}>Cancel</Button>
            <Button variant="gradient" onClick={() => completeId && completeMutation.mutate({ id: completeId, notes: completeNotes.trim() || undefined })} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Completing...' : 'Complete Handoff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!viewHandoff} onOpenChange={() => setViewHandoff(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Handoff Details</DialogTitle>
            <DialogDescription>Context the AI captured when it escalated this conversation.</DialogDescription>
          </DialogHeader>
          {viewHandoff && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ArrowLeftRight className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{viewHandoff.reason || 'No reason provided'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant={statusColors[viewHandoff.status]} dot>{viewHandoff.status}</Badge>
                    <SentimentChip value={viewHandoff.context?.sentiment} />
                    <span className="text-xs text-muted-foreground tabular">{formatDate(viewHandoff.createdAt)}</span>
                  </div>
                </div>
              </div>

              {viewHandoff.context?.conversationSummary && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI summary</p>
                  <p className="rounded-lg border bg-card p-3 text-sm leading-relaxed"><Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-primary" />{viewHandoff.context.conversationSummary}</p>
                </div>
              )}

              {viewHandoff.notes && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="rounded-lg bg-muted p-3 text-sm">{viewHandoff.notes}</p>
                </div>
              )}

              <div className="rounded-xl border">
                {viewHandoff.conversationId && (
                  <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-sm"><span className="text-muted-foreground">Conversation</span><code className="text-xs">{viewHandoff.conversationId}</code></div>
                )}
                {viewHandoff.agentId && (
                  <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-sm"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Bot className="h-3.5 w-3.5" /> Agent</span><code className="text-xs">{viewHandoff.agentId}</code></div>
                )}
                {viewHandoff.assignedTo && (
                  <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-sm"><span className="text-muted-foreground">Assigned to</span><code className="text-xs">{viewHandoff.assignedTo}</code></div>
                )}
                {viewHandoff.acceptedAt && (
                  <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-sm"><span className="text-muted-foreground">Accepted</span><span className="text-xs tabular">{formatDate(viewHandoff.acceptedAt)}</span></div>
                )}
                {viewHandoff.rejectedAt && (
                  <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-sm"><span className="text-muted-foreground">Rejected</span><span className="text-xs tabular">{formatDate(viewHandoff.rejectedAt)}</span></div>
                )}
                {viewHandoff.completedAt && (
                  <div className="flex items-center justify-between gap-4 px-3 py-2 text-sm"><span className="text-muted-foreground">Completed</span><span className="text-xs tabular">{formatDate(viewHandoff.completedAt)}</span></div>
                )}
                <div className="flex items-center justify-between gap-4 px-3 py-2 text-sm last:border-0"><span className="text-muted-foreground">Requested</span><span className="text-xs tabular">{formatDate(viewHandoff.createdAt)}</span></div>
              </div>

              {viewHandoff.status === 'pending' && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setRejectId(viewHandoff._id); setViewHandoff(null); }}><XCircle className="h-4 w-4" /> Reject</Button>
                  <Button variant="gradient" onClick={() => { acceptMutation.mutate(viewHandoff._id); setViewHandoff(null); }}><CheckCircle className="h-4 w-4" /> Accept handoff</Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
