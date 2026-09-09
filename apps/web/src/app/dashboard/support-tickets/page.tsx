'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Ticket, Eye, Send } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { formatDate } from '@/lib/utils';

const priorityColors: Record<string, 'default' | 'warning' | 'destructive' | 'secondary'> = {
  low: 'secondary', medium: 'default', high: 'warning', urgent: 'destructive',
};

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  open: 'warning', in_progress: 'default', resolved: 'success', closed: 'secondary',
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', assignedTo: '', leadId: '' });

  // Detail / view
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [noteText, setNoteText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', page, limit, statusFilter, priorityFilter],
    queryFn: () => api.get<any>('/support-tickets', { page, limit, status: statusFilter || undefined, priority: priorityFilter || undefined }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/support-tickets', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowCreate(false);
      setForm({ subject: '', description: '', priority: 'medium', assignedTo: '', leadId: '' });
      toast.success('Ticket created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/support-tickets/${id}/status`, { status }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      const updated = (res as any)?.data;
      if (viewTicket && updated) setViewTicket(updated);
      toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      api.patch(`/support-tickets/${id}/assign`, { assignedTo }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      const updated = (res as any)?.data;
      if (viewTicket && updated) setViewTicket(updated);
      toast.success('Ticket assigned');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/support-tickets/${id}/notes`, { content }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      const updated = (res as any)?.data;
      if (viewTicket && updated) setViewTicket(updated);
      setNoteText('');
      toast.success('Note added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const tickets = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;

  const handleCreate = () => {
    const payload: Record<string, any> = {};
    if (form.subject.trim()) payload.subject = form.subject.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    payload.priority = form.priority;
    if (form.assignedTo) payload.assignedTo = form.assignedTo;
    if (form.leadId) payload.leadId = form.leadId;
    if (!payload.subject) { toast.error('Subject is required'); return; }
    createMutation.mutate(payload);
  };

  const getUserName = (id: string) => {
    const u = users.find((u: any) => u._id === id);
    return u ? `${u.firstName} ${u.lastName}` : '-';
  };

  const columns = [
    { key: 'subject', label: 'Subject', render: (t: any) => <span className="font-medium">{t.subject}</span> },
    { key: 'priority', label: 'Priority', render: (t: any) => <Badge variant={priorityColors[t.priority]}>{t.priority}</Badge> },
    { key: 'status', label: 'Status', render: (t: any) => <Badge variant={statusColors[t.status]}>{t.status?.replace('_', ' ')}</Badge> },
    { key: 'assignedTo', label: 'Assigned', render: (t: any) => t.assignedTo ? getUserName(t.assignedTo) : <span className="text-muted-foreground">Unassigned</span> },
    { key: 'createdAt', label: 'Created', render: (t: any) => formatDate(t.createdAt) },
    {
      key: 'actions', label: '', render: (t: any) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setViewTicket(t); setNoteText(''); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Track and resolve support issues"
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> New Ticket</Button>}
      />

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || 'all'} onValueChange={(v) => { setPriorityFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={tickets} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Issue with..." />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe the issue..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={form.assignedTo || 'none'} onValueChange={(v) => setForm({ ...form, assignedTo: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / View Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ticket Details</DialogTitle></DialogHeader>
          {viewTicket && (
            <div className="space-y-5">
              {/* Header info */}
              <div>
                <h3 className="font-semibold text-lg">{viewTicket.subject}</h3>
                {viewTicket.description && <p className="text-sm text-muted-foreground mt-1">{viewTicket.description}</p>}
              </div>

              {/* Status + Priority + Assign */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select value={viewTicket.status} onValueChange={(v) => statusMutation.mutate({ id: viewTicket._id, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Priority</Label>
                  <Badge variant={priorityColors[viewTicket.priority]}>{viewTicket.priority}</Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Assign To</Label>
                  <Select value={viewTicket.assignedTo || 'none'} onValueChange={(v) => { if (v !== 'none') assignMutation.mutate({ id: viewTicket._id, assignedTo: v }); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium">Created</p>
                  <p>{formatDate(viewTicket.createdAt)}</p>
                </div>
                {viewTicket.resolvedAt && (
                  <div>
                    <p className="font-medium">Resolved</p>
                    <p>{formatDate(viewTicket.resolvedAt)}</p>
                  </div>
                )}
                {viewTicket.closedAt && (
                  <div>
                    <p className="font-medium">Closed</p>
                    <p>{formatDate(viewTicket.closedAt)}</p>
                  </div>
                )}
              </div>

              {viewTicket.leadId && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Lead ID: </span>
                  <code>{viewTicket.leadId}</code>
                </div>
              )}

              <Separator />

              {/* Notes section */}
              <div>
                <Label className="text-sm font-medium">Notes ({viewTicket.notes?.length || 0})</Label>

                {(viewTicket.notes || []).length > 0 && (
                  <div className="space-y-2 mt-3">
                    {viewTicket.notes.map((note: any, i: number) => (
                      <div key={i} className="bg-muted p-3 rounded-lg">
                        <p className="text-sm">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{getUserName(note.createdBy)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && noteText.trim()) {
                        noteMutation.mutate({ id: viewTicket._id, content: noteText.trim() });
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => { if (noteText.trim()) noteMutation.mutate({ id: viewTicket._id, content: noteText.trim() }); }}
                    disabled={noteMutation.isPending || !noteText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
