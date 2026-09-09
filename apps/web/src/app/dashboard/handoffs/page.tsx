'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle, XCircle, CheckCheck, Eye, Clock, UserCheck, Ban } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  pending: 'warning', accepted: 'success', rejected: 'destructive', completed: 'secondary', expired: 'default',
};

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

  const columns = [
    {
      key: 'reason', label: 'Reason', render: (h: any) => (
        <div>
          <span className="font-medium">{h.reason || 'No reason'}</span>
          {h.context?.sentiment && (
            <span className="ml-2 text-xs text-muted-foreground">Sentiment: {h.context.sentiment}</span>
          )}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (h: any) => <Badge variant={statusColors[h.status]}>{h.status}</Badge> },
    {
      key: 'conversationId', label: 'Conversation', render: (h: any) =>
        h.conversationId ? <code className="text-xs text-muted-foreground">...{h.conversationId.slice(-6)}</code> : '-',
    },
    { key: 'createdAt', label: 'Created', render: (h: any) => formatDate(h.createdAt) },
    {
      key: 'timestamps', label: 'Resolved', render: (h: any) => {
        if (h.acceptedAt) return <span className="text-xs text-muted-foreground">{formatDate(h.acceptedAt)}</span>;
        if (h.rejectedAt) return <span className="text-xs text-muted-foreground">{formatDate(h.rejectedAt)}</span>;
        if (h.completedAt) return <span className="text-xs text-muted-foreground">{formatDate(h.completedAt)}</span>;
        return <span className="text-xs text-muted-foreground">-</span>;
      },
    },
    {
      key: 'actions', label: '', render: (h: any) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setViewHandoff(h); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {h.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(h._id); }}>
                <CheckCircle className="mr-1 h-3 w-3" /> Accept
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); setRejectId(h._id); }}>
                <XCircle className="mr-1 h-3 w-3" /> Reject
              </Button>
            </>
          )}
          {h.status === 'accepted' && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setCompleteId(h._id); }}>
              <CheckCheck className="mr-1 h-3 w-3" /> Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Handoffs" description="Manage conversation handoffs from bot to human" />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Pending" value={pendingCount} icon={Clock} />
        <StatCard title="Accepted" value={acceptedCount} icon={UserCheck} />
        <StatCard title="Completed" value={completedCount} icon={CheckCheck} />
        <StatCard title="Rejected" value={rejectedCount} icon={Ban} />
      </div>

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={handoffs} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} />

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
            <Button onClick={() => completeId && completeMutation.mutate({ id: completeId, notes: completeNotes.trim() || undefined })} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Completing...' : 'Complete Handoff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!viewHandoff} onOpenChange={() => setViewHandoff(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Handoff Details</DialogTitle></DialogHeader>
          {viewHandoff && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusColors[viewHandoff.status]}>{viewHandoff.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{formatDate(viewHandoff.createdAt)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="text-sm">{viewHandoff.reason || 'No reason provided'}</p>
              </div>

              {viewHandoff.conversationId && (
                <div>
                  <p className="text-xs text-muted-foreground">Conversation ID</p>
                  <code className="text-xs">{viewHandoff.conversationId}</code>
                </div>
              )}

              {viewHandoff.agentId && (
                <div>
                  <p className="text-xs text-muted-foreground">Agent ID</p>
                  <code className="text-xs">{viewHandoff.agentId}</code>
                </div>
              )}

              {viewHandoff.assignedTo && (
                <div>
                  <p className="text-xs text-muted-foreground">Assigned To</p>
                  <code className="text-xs">{viewHandoff.assignedTo}</code>
                </div>
              )}

              {viewHandoff.context && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Context</p>
                  {viewHandoff.context.sentiment && (
                    <p className="text-sm">Sentiment: <Badge variant="outline">{viewHandoff.context.sentiment}</Badge></p>
                  )}
                  {viewHandoff.context.conversationSummary && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Conversation Summary</p>
                      <p className="text-sm bg-muted p-2 rounded mt-1">{viewHandoff.context.conversationSummary}</p>
                    </div>
                  )}
                </div>
              )}

              {viewHandoff.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm bg-muted p-2 rounded">{viewHandoff.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {viewHandoff.acceptedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Accepted At</p>
                    <p className="text-xs">{formatDate(viewHandoff.acceptedAt)}</p>
                  </div>
                )}
                {viewHandoff.rejectedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rejected At</p>
                    <p className="text-xs">{formatDate(viewHandoff.rejectedAt)}</p>
                  </div>
                )}
                {viewHandoff.completedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Completed At</p>
                    <p className="text-xs">{formatDate(viewHandoff.completedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
