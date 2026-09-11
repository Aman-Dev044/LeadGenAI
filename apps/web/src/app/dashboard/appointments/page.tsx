'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Calendar, Pencil, Trash2, XCircle, CalendarClock, CalendarCheck, CalendarDays, CheckCircle2, Video, User } from 'lucide-react';
import { api } from '@/lib/api-client';
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
import type { Appointment } from '@/types';
import { formatDate, getInitials } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  scheduled: 'info', confirmed: 'success', cancelled: 'destructive', completed: 'secondary', no_show: 'warning',
};

/** Rounded month/day tile used in the list */
function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const d = new Date(date);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return (
    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-center leading-none ${muted ? 'bg-muted text-muted-foreground' : 'bg-primary/10 border-primary/20 text-primary'}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider">{month}</span>
      <span className="mt-0.5 text-lg font-bold tabular">{d.getDate()}</span>
    </div>
  );
}

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

const emptyForm = { title: '', description: '', startTime: '', endTime: '', assignedTo: '', leadId: '', attendeeName: '', attendeeEmail: '', attendeePhone: '', meetingLink: '' };

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Edit
  const [editAppt, setEditAppt] = useState<any>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm, status: 'scheduled' });

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ startTime: '', endTime: '', reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page, limit, statusFilter],
    queryFn: () => api.get<any>('/appointments', { page, limit, status: statusFilter || undefined }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads-list'],
    queryFn: () => api.get<any>('/leads', { limit: 100 }),
  });

  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];
  const leads = (leadsData as any)?.data?.data || (leadsData as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/appointments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast.success('Appointment created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/appointments/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setEditAppt(null);
      toast.success('Appointment updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/appointments/${id}/cancel`, reason ? { reason } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setCancelId(null);
      setCancelReason('');
      toast.success('Appointment cancelled');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.post(`/appointments/${id}/reschedule`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setRescheduleAppt(null);
      toast.success('Appointment rescheduled');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toLocalInput = (d: string | Date) => {
    if (!d) return '';
    const dt = new Date(d);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    return dt.toISOString().slice(0, 16);
  };

  const openReschedule = (appt: any) => {
    setRescheduleAppt(appt);
    setRescheduleForm({ startTime: toLocalInput(appt.startTime), endTime: toLocalInput(appt.endTime), reason: '' });
  };

  // Keep the original duration when the start time changes
  const onRescheduleStartChange = (value: string) => {
    let endTime = rescheduleForm.endTime;
    if (value && rescheduleAppt?.startTime && rescheduleAppt?.endTime) {
      const duration = new Date(rescheduleAppt.endTime).getTime() - new Date(rescheduleAppt.startTime).getTime();
      if (duration > 0) endTime = toLocalInput(new Date(new Date(value).getTime() + duration));
    }
    setRescheduleForm({ ...rescheduleForm, startTime: value, endTime });
  };

  const handleReschedule = () => {
    if (!rescheduleAppt) return;
    if (!rescheduleForm.startTime || !rescheduleForm.endTime) { toast.error('New start and end time are required'); return; }
    const start = new Date(rescheduleForm.startTime);
    const end = new Date(rescheduleForm.endTime);
    if (end <= start) { toast.error('End time must be after start time'); return; }
    if (start.toISOString() === rescheduleAppt.startTime && end.toISOString() === rescheduleAppt.endTime) { toast.info('Time is unchanged'); return; }
    rescheduleMutation.mutate({
      id: rescheduleAppt._id,
      body: { startTime: start.toISOString(), endTime: end.toISOString(), ...(rescheduleForm.reason.trim() ? { reason: rescheduleForm.reason.trim() } : {}) },
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setDeleteId(null);
      toast.success('Appointment deleted permanently');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const appointments = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;

  const handleCreate = () => {
    const payload: Record<string, any> = {};
    if (form.title.trim()) payload.title = form.title.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.startTime) payload.startTime = new Date(form.startTime).toISOString();
    if (form.endTime) payload.endTime = new Date(form.endTime).toISOString();
    if (form.assignedTo) payload.assignedTo = form.assignedTo;
    if (form.leadId) payload.leadId = form.leadId;
    if (form.meetingLink.trim()) payload.meetingLink = form.meetingLink.trim();

    const attendee: Record<string, string> = {};
    if (form.attendeeName.trim()) attendee.name = form.attendeeName.trim();
    if (form.attendeeEmail.trim()) attendee.email = form.attendeeEmail.trim();
    if (form.attendeePhone.trim()) attendee.phone = form.attendeePhone.trim();
    if (Object.keys(attendee).length > 0) payload.attendee = attendee;

    if (!payload.title) { toast.error('Title is required'); return; }
    if (!payload.assignedTo) { toast.error('Assigned To is required'); return; }
    if (!payload.startTime) { toast.error('Start time is required'); return; }
    if (!payload.endTime) { toast.error('End time is required'); return; }

    createMutation.mutate(payload);
  };

  const handleEdit = (appt: any) => {
    setEditAppt(appt);
    const toLocal = (d: string) => {
      if (!d) return '';
      const dt = new Date(d);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      return dt.toISOString().slice(0, 16);
    };
    setEditForm({
      title: appt.title || '',
      description: appt.description || '',
      startTime: toLocal(appt.startTime),
      endTime: toLocal(appt.endTime),
      assignedTo: appt.assignedTo || '',
      leadId: appt.leadId || '',
      attendeeName: appt.attendee?.name || '',
      attendeeEmail: appt.attendee?.email || '',
      attendeePhone: appt.attendee?.phone || '',
      meetingLink: appt.meetingLink || '',
      status: appt.status || 'scheduled',
    });
  };

  const handleEditSave = () => {
    if (!editAppt) return;
    const payload: Record<string, any> = {};

    if (editForm.title.trim() !== (editAppt.title || '')) payload.title = editForm.title.trim();
    if (editForm.description.trim() !== (editAppt.description || '')) payload.description = editForm.description.trim();
    if (editForm.startTime && new Date(editForm.startTime).toISOString() !== editAppt.startTime) payload.startTime = new Date(editForm.startTime).toISOString();
    if (editForm.endTime && new Date(editForm.endTime).toISOString() !== editAppt.endTime) payload.endTime = new Date(editForm.endTime).toISOString();
    if (editForm.status !== editAppt.status) payload.status = editForm.status;
    if (editForm.meetingLink.trim() !== (editAppt.meetingLink || '')) payload.meetingLink = editForm.meetingLink.trim();

    const attendee: Record<string, string> = {};
    if (editForm.attendeeName.trim()) attendee.name = editForm.attendeeName.trim();
    if (editForm.attendeeEmail.trim()) attendee.email = editForm.attendeeEmail.trim();
    if (editForm.attendeePhone.trim()) attendee.phone = editForm.attendeePhone.trim();
    const origAttendee = editAppt.attendee || {};
    if (attendee.name !== (origAttendee.name || '') || attendee.email !== (origAttendee.email || '') || attendee.phone !== (origAttendee.phone || '')) {
      payload.attendee = attendee;
    }

    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditAppt(null); return; }
    updateMutation.mutate({ id: editAppt._id, body: payload });
  };

  const getUserName = (id: string) => {
    const u = users.find((u: any) => u._id === id);
    return u ? `${u.firstName} ${u.lastName}` : id || '-';
  };

  const now = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const todayCount = appointments.filter((a: any) => isSameDay(new Date(a.startTime), now) && a.status !== 'cancelled').length;
  const upcomingCount = appointments.filter((a: any) => new Date(a.startTime) > now && !['cancelled', 'completed', 'no_show'].includes(a.status)).length;
  const completedCount = appointments.filter((a: any) => a.status === 'completed').length;

  const columns = [
    {
      key: 'title', label: 'Appointment', render: (a: any) => {
        const past = new Date(a.endTime || a.startTime) < now;
        return (
          <div className="flex items-center gap-3">
            <DateTile date={a.startTime} muted={past || a.status === 'cancelled'} />
            <div className="min-w-0">
              <div className="font-semibold truncate">{a.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular">{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</span>
                {a.meetingLink && (
                  <a href={a.meetingLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Video className="h-3 w-3" /> Join
                  </a>
                )}
                {a.rescheduledCount > 0 && <span className="rounded-full bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Rescheduled {a.rescheduledCount}x</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    { key: 'status', label: 'Status', render: (a: Appointment) => <Badge variant={statusColors[a.status]} dot>{a.status.replace('_', ' ')}</Badge> },
    {
      key: 'attendee', label: 'Attendee', render: (a: any) => {
        const name = a.attendee?.name || a.attendee?.email;
        if (!name) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8"><AvatarFallback className="text-[11px]">{getInitials(name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{a.attendee?.name || a.attendee?.email}</div>
              {a.attendee?.name && a.attendee?.email && <div className="text-xs text-muted-foreground truncate">{a.attendee.email}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'assignedTo', label: 'Assigned To', render: (a: any) => (
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"><User className="h-3.5 w-3.5" /></div>
          <span>{getUserName(a.assignedTo)}</span>
        </div>
      ),
    },
    {
      key: 'actions', label: '', className: 'text-right', render: (a: any) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(a); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {a.status !== 'completed' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" title="Reschedule" onClick={(e) => { e.stopPropagation(); openReschedule(a); }}>
              <CalendarClock className="h-3.5 w-3.5" />
            </Button>
          )}
          {a.status !== 'cancelled' && a.status !== 'completed' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" title="Cancel appointment" onClick={(e) => { e.stopPropagation(); setCancelId(a._id); }}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete permanently" onClick={(e) => { e.stopPropagation(); setDeleteId(a._id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Meetings booked by your AI agents and your team, all in one calendar."
        icon={Calendar}
        actions={<Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Appointment</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={total} icon={CalendarDays} tone="primary" description="all appointments" />
        <StatCard title="Today" value={todayCount} icon={CalendarCheck} tone="violet" description="on this page" />
        <StatCard title="Upcoming" value={upcomingCount} icon={CalendarClock} tone="info" description="scheduled ahead" />
        <StatCard title="Completed" value={completedCount} icon={CheckCircle2} tone="success" description="on this page" />
      </div>

      <Toolbar>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="px-1 text-xs text-muted-foreground tabular">{total} appointment{total === 1 ? '' : 's'}</span>
      </Toolbar>

      <DataTable columns={columns} data={appointments} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} emptyMessage="No appointments yet" emptyDescription="Create one manually or let your AI agent book meetings for you." />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Appointment</DialogTitle>
            <DialogDescription>Schedule a meeting and assign it to a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sales Demo Call" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Meeting details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned To *</Label>
                <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={form.leadId || 'none'} onValueChange={(v) => setForm({ ...form, leadId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leads.map((l: any) => (
                      <SelectItem key={l._id} value={l._id}>{l.firstName} {l.lastName} {l.email ? `(${l.email})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendee Info</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Name" value={form.attendeeName} onChange={(e) => setForm({ ...form, attendeeName: e.target.value })} />
                <Input placeholder="Email" value={form.attendeeEmail} onChange={(e) => setForm({ ...form, attendeeEmail: e.target.value })} />
                <Input placeholder="Phone" value={form.attendeePhone} onChange={(e) => setForm({ ...form, attendeePhone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meeting Link</Label>
              <Input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://meet.google.com/..." />
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

      {/* Edit Dialog */}
      <Dialog open={!!editAppt} onOpenChange={() => setEditAppt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
            <DialogDescription>Update details, status or attendee information.</DialogDescription>
          </DialogHeader>
          {editAppt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendee Info</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="Name" value={editForm.attendeeName} onChange={(e) => setEditForm({ ...editForm, attendeeName: e.target.value })} />
                  <Input placeholder="Email" value={editForm.attendeeEmail} onChange={(e) => setEditForm({ ...editForm, attendeeEmail: e.target.value })} />
                  <Input placeholder="Phone" value={editForm.attendeePhone} onChange={(e) => setEditForm({ ...editForm, attendeePhone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meeting Link</Label>
                <Input value={editForm.meetingLink} onChange={(e) => setEditForm({ ...editForm, meetingLink: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAppt(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => { setCancelId(null); setCancelReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>The appointment will be marked as cancelled. You can reschedule it later from the list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Client asked to postpone..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelId(null); setCancelReason(''); }}>No, Keep It</Button>
            <Button variant="destructive" onClick={() => cancelId && cancelMutation.mutate({ id: cancelId, reason: cancelReason.trim() || undefined })} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={() => setRescheduleAppt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              {rescheduleAppt?.title} · currently {rescheduleAppt ? formatDate(rescheduleAppt.startTime) : ''}
              {rescheduleAppt?.status === 'cancelled' && ' (cancelled — will become scheduled again)'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Start *</Label>
                <Input type="datetime-local" value={rescheduleForm.startTime} onChange={(e) => onRescheduleStartChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New End *</Label>
                <Input type="datetime-local" value={rescheduleForm.endTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea value={rescheduleForm.reason} onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })} rows={2} placeholder="Client requested a later slot..." />
            </div>
            {rescheduleAppt?.rescheduleHistory?.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
                <div className="font-semibold uppercase tracking-wider text-[10px]">Reschedule history</div>
                {rescheduleAppt.rescheduleHistory.slice(-3).reverse().map((h: any, i: number) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular">{formatDate(h.fromStartTime)}</span>
                    <span className="text-muted-foreground/60">→</span>
                    <span className="tabular font-medium text-foreground">{formatDate(h.toStartTime)}</span>
                    {h.reason && <span className="italic">({h.reason})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? 'Saving...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
            <DialogDescription>This will permanently delete the appointment record. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
