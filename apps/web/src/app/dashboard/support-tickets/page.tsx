'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Ticket, Eye, Send, Inbox, LoaderCircle, CheckCircle2, AlertTriangle, User, StickyNote } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { perms } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, ToolbarSpacer } from '@/components/shared/toolbar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';
import { formatDate, getInitials } from '@/lib/utils';

const priorityColors: Record<string, 'default' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  low: 'secondary', medium: 'info', high: 'warning', urgent: 'destructive',
};

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'info'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'secondary',
};

const PRIORITY_BAR: Record<string, string> = {
  low: 'bg-slate-400', medium: 'bg-sky-500', high: 'bg-amber-500', urgent: 'bg-rose-500',
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function SupportTicketsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = perms.createTicket(role);
  const canManage = perms.manageTicket(role);
  const isSalesperson = perms.isSalesperson(role);
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

  const openCount = tickets.filter((t: any) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t: any) => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
  const urgentCount = tickets.filter((t: any) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;

  const columns = [
    {
      key: 'subject', label: 'Ticket', render: (t: any) => (
        <div className="flex items-center gap-3">
          <span className={`h-9 w-1 shrink-0 rounded-full ${PRIORITY_BAR[t.priority] || 'bg-muted'}`} />
          <div className="min-w-0">
            <div className="font-semibold truncate max-w-[360px]">{t.subject}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {t.description ? <span className="truncate max-w-[280px]">{t.description}</span> : <span>No description</span>}
              {(t.notes?.length || 0) > 0 && <span className="inline-flex items-center gap-1 shrink-0"><StickyNote className="h-3 w-3" />{t.notes.length}</span>}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'priority', label: 'Priority', render: (t: any) => <Badge variant={priorityColors[t.priority]} dot>{t.priority}</Badge> },
    { key: 'status', label: 'Status', render: (t: any) => <Badge variant={statusColors[t.status]}>{t.status?.replace('_', ' ')}</Badge> },
    {
      key: 'assignedTo', label: 'Assigned', render: (t: any) => t.assignedTo ? (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{getInitials(getUserName(t.assignedTo))}</AvatarFallback></Avatar>
          <span className="text-sm">{getUserName(t.assignedTo)}</span>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed"><User className="h-3.5 w-3.5" /></span>Unassigned</span>
      ),
    },
    { key: 'createdAt', label: 'Created', render: (t: any) => <span className="text-xs text-muted-foreground tabular">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions', label: '', className: 'text-right', render: (t: any) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Open ticket" onClick={(e) => { e.stopPropagation(); setViewTicket(t); setNoteText(''); }}>
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
        description={isSalesperson ? 'Tickets assigned to you — keep the note trail going until they are resolved.' : 'Track issues raised by leads and your team, assign an owner and keep a note trail until resolved.'}
        icon={Ticket}
        actions={canCreate && <Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Ticket</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open" value={openCount} icon={Inbox} tone="warning" description="on this page" />
        <StatCard title="In progress" value={inProgressCount} icon={LoaderCircle} tone="info" description="being worked on" />
        <StatCard title="Resolved" value={resolvedCount} icon={CheckCircle2} tone="success" description="resolved or closed" />
        <StatCard title="Urgent" value={urgentCount} icon={AlertTriangle} tone="danger" description="need attention" />
      </div>

      <Toolbar>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || 'all'} onValueChange={(v) => { setPriorityFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="px-1 text-xs text-muted-foreground tabular">{total} ticket{total === 1 ? '' : 's'}</span>
      </Toolbar>

      <DataTable columns={columns} data={tickets} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} onRowClick={(t: any) => { setViewTicket(t); setNoteText(''); }} emptyMessage="No tickets yet" emptyDescription="Create a ticket to track an issue for a lead or your team." />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Ticket</DialogTitle>
            <DialogDescription>Log an issue, set its priority and optionally assign an owner.</DialogDescription>
          </DialogHeader>
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
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / View Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          {viewTicket && (
            <>
              {/* Header */}
              <div className="relative border-b bg-muted/40 p-6 pr-14">
                <span className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_BAR[viewTicket.priority] || 'bg-muted'}`} />
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={priorityColors[viewTicket.priority]} dot>{viewTicket.priority}</Badge>
                    <Badge variant={statusColors[viewTicket.status]}>{viewTicket.status?.replace('_', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground tabular">Opened {formatDate(viewTicket.createdAt)}</span>
                  </div>
                  <DialogTitle className="text-lg leading-snug">{viewTicket.subject}</DialogTitle>
                  <DialogDescription>{viewTicket.description || 'No description provided.'}</DialogDescription>
                </DialogHeader>
              </div>

              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
                {/* Status + Assign */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select value={viewTicket.status} onValueChange={(v) => statusMutation.mutate({ id: viewTicket._id, status: v })} disabled={!canManage}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Assign To</Label>
                    <Select value={viewTicket.assignedTo || 'none'} onValueChange={(v) => { if (v !== 'none') assignMutation.mutate({ id: viewTicket._id, assignedTo: v }); }} disabled={!canManage}>
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

                {/* Meta */}
                {(viewTicket.resolvedAt || viewTicket.closedAt || viewTicket.leadId) && (
                  <div className="rounded-xl border text-sm">
                    {viewTicket.resolvedAt && <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-muted-foreground">Resolved</span><span className="text-xs tabular">{formatDate(viewTicket.resolvedAt)}</span></div>}
                    {viewTicket.closedAt && <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-muted-foreground">Closed</span><span className="text-xs tabular">{formatDate(viewTicket.closedAt)}</span></div>}
                    {viewTicket.leadId && <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Lead</span><code className="text-xs">{viewTicket.leadId}</code></div>}
                  </div>
                )}

                {/* Notes thread */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Notes</p>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular">{viewTicket.notes?.length || 0}</span>
                  </div>

                  {(viewTicket.notes || []).length === 0 ? (
                    <p className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">No notes yet. Add the first update below.</p>
                  ) : (
                    <div className="space-y-3">
                      {viewTicket.notes.map((note: any, i: number) => {
                        const author = getUserName(note.createdBy);
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <Avatar className="h-7 w-7 mt-0.5"><AvatarFallback className="text-[10px]">{getInitials(author === '-' ? 'U' : author)}</AvatarFallback></Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">{note.content}</div>
                              <div className="mt-1 flex items-center gap-2 pl-1 text-[11px] text-muted-foreground">
                                <span className="font-medium">{author}</span>
                                <span>·</span>
                                <span className="tabular">{formatDate(note.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Composer */}
              <div className="border-t bg-muted/30 p-4">
                <div className="flex gap-2">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an internal note… (Enter to send)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && noteText.trim()) {
                        noteMutation.mutate({ id: viewTicket._id, content: noteText.trim() });
                      }
                    }}
                  />
                  <Button
                    variant="gradient"
                    size="icon"
                    onClick={() => { if (noteText.trim()) noteMutation.mutate({ id: viewTicket._id, content: noteText.trim() }); }}
                    disabled={noteMutation.isPending || !noteText.trim()}
                    aria-label="Add note"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
