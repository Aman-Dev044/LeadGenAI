'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  UserCog,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Toolbar, SearchInput, ToolbarSpacer } from '@/components/shared/toolbar';
import { formatDate, getInitials, cn } from '@/lib/utils';

const ROLES = ['ADMIN', 'SALESPERSON'];

const roleColors: Record<string, 'violet' | 'info' | 'secondary' | 'outline'> = {
  ADMIN: 'violet', SALESPERSON: 'secondary', SALES_MANAGER: 'info', VIEWER: 'outline',
};

const roleLabel = (r: string) => (r || '').toLowerCase().replace(/_/g, ' ');

const emptyForm = { firstName: '', lastName: '', email: '', password: '', role: 'SALESPERSON', phone: '' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'members' | 'deletion_requests'>('members');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Edit
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: '', phone: '' });

  // Delete
  const [deleteUser, setDeleteUser] = useState<any>(null);

  // Staff Deletion Requests review state
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const activeTenantId = useAuthStore((s) => s.activeTenantId);

  const { data, isLoading } = useQuery({
    queryKey: ['users', activeTenantId, page, limit, search],
    queryFn: () => api.get<any>('/users', { page, limit, search: search || undefined }),
  });

  const {
    data: staffRequestsRaw,
    isLoading: isLoadingStaffRequests,
    refetch: refetchStaffRequests,
    isFetching: isFetchingStaffRequests,
  } = useQuery({
    queryKey: ['staff-deletion-requests'],
    queryFn: async () => {
      const res = await api.get<any>('/account-deletion/staff/requests');
      return (res as any)?.data || res;
    },
    enabled: !!isAdmin,
  });

  const approveStaffMutation = useMutation({
    mutationFn: (id: string) => api.post(`/account-deletion/staff/requests/${id}/approve`),
    onSuccess: () => {
      toast.success('Staff account deletion approved. User has been removed.');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['staff-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to approve request'),
  });

  const rejectStaffMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/account-deletion/staff/requests/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Staff deletion request rejected.');
      setRejectTarget(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['staff-deletion-requests'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reject request'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/users', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast.success('User created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      toast.success('User updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUser(null);
      toast.success('User deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const allUsers = (data as any)?.data?.data || (data as any)?.data || [];
  const meta = (data as any)?.data?.meta;
  const total = meta?.total ?? (data as any)?.data?.total ?? allUsers.length;
  const totalPages = meta?.totalPages ?? (data as any)?.data?.totalPages ?? 1;

  // Client-side role filter
  const users = roleFilter ? allUsers.filter((u: any) => u.role === roleFilter) : allUsers;

  const activeCount = allUsers.filter((u: any) => u.isActive).length;
  const inactiveCount = allUsers.filter((u: any) => !u.isActive).length;

  const handleCreate = () => {
    const payload: Record<string, any> = {};
    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.password) payload.password = form.password;
    if (form.phone.trim()) payload.phone = form.phone.trim();
    payload.role = form.role;

    if (!payload.firstName) { toast.error('First name is required'); return; }
    if (!payload.lastName) { toast.error('Last name is required'); return; }
    if (!payload.email) { toast.error('Email is required'); return; }
    if (!payload.password || payload.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    createMutation.mutate(payload);
  };

  const handleEdit = (user: any) => {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'SALESPERSON',
      phone: user.phone || '',
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    const payload: Record<string, any> = {};
    if (editForm.firstName.trim() !== (editUser.firstName || '')) payload.firstName = editForm.firstName.trim();
    if (editForm.lastName.trim() !== (editUser.lastName || '')) payload.lastName = editForm.lastName.trim();
    if (editForm.role !== editUser.role) payload.role = editForm.role;
    if (editForm.phone.trim() !== (editUser.phone || '')) payload.phone = editForm.phone.trim();

    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditUser(null); return; }
    updateMutation.mutate({ id: editUser._id, body: payload });
  };

  const handleToggleActive = (user: any) => {
    if (user.isActive) {
      deactivateMutation.mutate(user._id);
    } else {
      activateMutation.mutate(user._id);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      key: 'name', label: 'Member', render: (u: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{getInitials(`${u.firstName || ''} ${u.lastName || ''}`) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold truncate">{u.firstName} {u.lastName}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" /> {u.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone', label: 'Phone', render: (u: any) => u.phone
        ? <span className="text-sm flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{u.phone}</span>
        : <span className="text-muted-foreground/60 text-xs">—</span>,
    },
    { key: 'role', label: 'Role', render: (u: any) => <Badge variant={roleColors[u.role] || 'secondary'}>{roleLabel(u.role)}</Badge> },
    {
      key: 'isActive', label: 'Status', render: (u: any) => (
        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={u.isActive ?? true}
            onCheckedChange={() => handleToggleActive(u)}
          />
          <Badge variant={u.isActive ? 'success' : 'secondary'} dot>{u.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      ),
    },
    {
      key: 'lastLoginAt', label: 'Last Login', render: (u: any) => u.lastLoginAt
        ? <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatDate(u.lastLoginAt)}</span>
        : <span className="text-muted-foreground/60 text-xs">Never</span>,
    },
    {
      key: 'actions', label: '', className: 'w-[90px]', render: (u: any) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(u); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-600 hover:bg-rose-500/10" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setDeleteUser(u); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const staffPayload = staffRequestsRaw || {};
  const staffRequests: any[] = Array.isArray(staffPayload?.requests)
    ? staffPayload.requests
    : Array.isArray(staffPayload)
    ? staffPayload
    : [];
  const pendingStaffRequests = staffRequests.filter((r) => r.status === 'pending');
  const pendingStaffCount = staffPayload?.pendingCount ?? pendingStaffRequests.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCog}
        title="Users"
        description="Invite teammates, assign roles and control who can access the workspace."
        actions={
          <Button variant="gradient" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      />

      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
          <TabsList>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span>Team Members</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deletion_requests" className="gap-2">
              <UserX className="h-4 w-4" />
              <span>Staff Deletion Requests</span>
              {pendingStaffCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                  {pendingStaffCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Users" value={total} icon={Users} tone="primary" description="in this workspace" />
              <StatCard title="Active" value={activeCount} icon={UserCheck} tone="success" description="can sign in" />
              <StatCard title="Inactive" value={inactiveCount} icon={UserX} tone="warning" description="access paused" />
              <StatCard title="Admins" value={allUsers.filter((u: any) => u.role === 'ADMIN').length} icon={ShieldCheck} tone="violet" description="full permissions" />
            </div>

            <Toolbar>
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search by name or email…"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <Button variant="soft" size="sm" onClick={handleSearch}>Search</Button>
              <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              <ToolbarSpacer />
              <span className="text-xs text-muted-foreground tabular pr-1">{users.length} shown</span>
            </Toolbar>

            <DataTable
              columns={columns}
              data={users}
              total={total}
              page={page}
              limit={limit}
              totalPages={totalPages}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
              isLoading={isLoading}
              emptyMessage="No users found"
              emptyDescription="Try a different search or invite a new teammate."
            />
          </TabsContent>

          <TabsContent value="deletion_requests" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Staff Account Deletion Requests</h3>
                <p className="text-xs text-muted-foreground">
                  Review account deletion requests submitted by your staff. Approving a request deactivates their account in real-time.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStaffRequests()}
                disabled={isFetchingStaffRequests}
                className="gap-1.5"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetchingStaffRequests && 'animate-spin')} />
                Refresh
              </Button>
            </div>

            {isLoadingStaffRequests ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Loading deletion requests...</p>
              </div>
            ) : staffRequests.length === 0 ? (
              <EmptyState
                icon={UserX}
                title="No staff deletion requests"
                description="No team members have submitted account deletion requests."
              />
            ) : (
              <div className="space-y-4">
                {staffRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <Card
                      key={req._id}
                      className={cn(
                        'transition-all border',
                        isPending ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'opacity-85'
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-base">{req.userName}</span>
                              <Badge variant="secondary" className="text-[11px] uppercase tracking-wider font-semibold">
                                {roleLabel(req.userRole)}
                              </Badge>
                              <Badge
                                variant={
                                  req.status === 'pending'
                                    ? 'warning'
                                    : req.status === 'approved'
                                    ? 'destructive'
                                    : req.status === 'rejected'
                                    ? 'outline'
                                    : 'secondary'
                                }
                                className="capitalize text-[11px]"
                              >
                                {req.status === 'pending' ? 'Pending Review' : req.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 font-mono">
                                <Mail className="h-3 w-3" /> {req.userEmail}
                              </span>
                              <span>&bull;</span>
                              <span>Requested {formatDate(req.createdAt)}</span>
                            </div>
                          </div>

                          {/* Action buttons for pending requests */}
                          {isPending && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setApproveTarget(req)}
                                className="gap-1.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Approve & Delete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectTarget(req);
                                  setRejectionReason('');
                                }}
                                className="gap-1.5"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 pt-0">
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">Reason:</span>
                            <Badge variant="outline" className="text-xs font-medium">
                              {req.reason}
                            </Badge>
                          </div>
                          {req.description && (
                            <div className="space-y-1 mt-1">
                              <span className="text-[11px] font-semibold text-muted-foreground">Feedback & Description (Required):</span>
                              <div className="text-xs text-foreground/90 pl-2 italic border-l-2 border-primary/40">
                                &ldquo;{req.description}&rdquo;
                              </div>
                            </div>
                          )}
                        </div>

                        {!isPending && req.reviewedAt && (
                          <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1 border-t">
                            <span>Reviewed on {formatDate(req.reviewedAt)}</span>
                            {req.rejectionReason && (
                              <span>&bull; Note: <em>{req.rejectionReason}</em></span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <StatCard title="Total Users" value={total} icon={Users} tone="primary" description="in this workspace" />
            <StatCard title="Active" value={activeCount} icon={UserCheck} tone="success" description="can sign in" />
            <StatCard title="Inactive" value={inactiveCount} icon={UserX} tone="warning" description="access paused" />
            <StatCard title="Admins" value={allUsers.filter((u: any) => u.role === 'ADMIN').length} icon={ShieldCheck} tone="violet" description="full permissions" />
          </div>

          <Toolbar>
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search by name or email…"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <Button variant="soft" size="sm" onClick={handleSearch}>Search</Button>
            <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>)}
              </SelectContent>
            </Select>
            <ToolbarSpacer />
            <span className="text-xs text-muted-foreground tabular pr-1">{users.length} shown</span>
          </Toolbar>

          <DataTable
            columns={columns}
            data={users}
            total={total}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            isLoading={isLoading}
            emptyMessage="No users found"
            emptyDescription="Try a different search or invite a new teammate."
          />
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create an account for a teammate. They can sign in right away with this password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password * <span className="text-muted-foreground font-normal">(min 8 characters)</span></Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="********" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the member's details and role.</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(`${editUser.firstName || ''} ${editUser.lastName || ''}`) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{editUser.firstName} {editUser.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{editUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1234567890" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteUser?.firstName} {deleteUser?.lastName}</strong> ({deleteUser?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteUser && deleteMutation.mutate(deleteUser._id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Staff Deletion Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>Confirm Staff Account Deletion</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-left">
              Are you sure you want to approve the deletion request for <strong>{approveTarget?.userName}</strong> ({approveTarget?.userEmail})?
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">⚡ Real-Time Deletion Effect:</p>
              <p>
                The user account will be deactivated immediately. Their active dashboard session will be revoked in real-time, and a confirmation email will be sent.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveStaffMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => approveStaffMutation.mutate(approveTarget._id)}
              disabled={approveStaffMutation.isPending}
              className="gap-1.5"
            >
              {approveStaffMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Staff Deletion Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Staff Deletion Request</DialogTitle>
            <DialogDescription>
              Provide an optional explanation to <strong>{rejectTarget?.userName}</strong>. They will receive an email update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rejection Reason / Note</Label>
              <Textarea
                placeholder="e.g. Please wrap up pending lead handoffs before leaving the workspace."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectStaffMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                rejectStaffMutation.mutate({
                  id: rejectTarget._id,
                  reason: rejectionReason,
                })
              }
              disabled={rejectStaffMutation.isPending}
              className="gap-1.5"
            >
              {rejectStaffMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
