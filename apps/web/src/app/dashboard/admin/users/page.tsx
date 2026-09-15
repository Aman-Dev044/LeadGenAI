'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Pencil, KeyRound, LogOut, UserCog, Crown, Users, LayoutGrid, List, FilterX, Building2, Activity, MoreHorizontal, ShieldCheck, Loader2, Phone,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, TablePagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Toolbar, SearchInput, ToolbarDivider, ToolbarSpacer } from '@/components/shared/toolbar';
import { ALL_ROLES, RoleBadge, StatusBadge, timeAgo } from '@/components/admin/admin-ui';
import { impersonateTenant } from '@/lib/impersonation';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, { tile: string; label: string }> = {
  SUPER_ADMIN: { tile: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', label: 'Platform owner' },
  ADMIN: { tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', label: 'Tenant admin' },
  SALESPERSON: { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', label: 'Sales representative' },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: '', phone: '' });
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ firstName: '', lastName: '', email: '', password: '' });

  // Deep link from global search: ?search=email
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('search');
    if (s) {
      setSearchInput(s);
      setSearch(s);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, limit, search, role, active],
    queryFn: () =>
      api.get<any>('/admin/users', {
        page,
        limit,
        search: search || undefined,
        role: role || undefined,
        isActive: active || undefined,
      }),
  });

  const { data: owners } = useQuery({
    queryKey: ['admin', 'super-admins'],
    queryFn: () => api.get<any>('/admin/super-admins'),
  });

  const { data: overview } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<any>('/admin/overview'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'super-admins'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      invalidate();
      setEditUser(null);
      toast.success('User updated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reset = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/admin/users/${id}/reset-password`, { newPassword: password }),
    onSuccess: () => {
      setResetUser(null);
      setNewPassword('');
      toast.success('Password reset; all previous sessions revoked');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const forceLogout = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/force-logout`),
    onSuccess: (res: any) => toast.success(`${res?.data?.revokedSessions ?? 0} session(s) revoked`),
    onError: (err: any) => toast.error(err.message),
  });

  const addOwner = useMutation({
    mutationFn: (body: any) => api.post('/admin/super-admins', body),
    onSuccess: () => {
      invalidate();
      setShowAddOwner(false);
      setOwnerForm({ firstName: '', lastName: '', email: '', password: '' });
      toast.success('Platform owner created successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const users: any[] = data?.data?.data || [];
  const meta = data?.data?.meta;
  const ownerList: any[] = owners?.data || [];
  const stats = overview?.data?.users || {};
  const totalUsers = meta?.total || stats.total || users.length || 0;
  const hasFilters = !!(role || active || search);

  const getInitials = (firstName?: string, lastName?: string) => {
    return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
  };
  const isMeUser = (u: any) => String(u._id) === String(me?._id || (me as any)?.id);

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      role: u.role,
      phone: u.phone || '',
    });
  };

  const clearFilters = () => {
    setRole('');
    setActive('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  /** Row / card action menu shared by both views. */
  const ActionMenu = ({ u }: { u: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{u.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /> Edit user</DropdownMenuItem>
        {u.role !== 'SUPER_ADMIN' && (
          <DropdownMenuItem onClick={() => impersonateTenant(u.tenantId, u._id)}><UserCog className="h-4 w-4 text-primary" /> Log in as user</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setResetUser(u)}><KeyRound className="h-4 w-4 text-amber-500" /> Reset password</DropdownMenuItem>
        <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10" onClick={() => forceLogout.mutate(u._id)}>
          <LogOut className="h-4 w-4" /> Revoke sessions
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (u: any) => {
        const style = ROLE_STYLES[u.role] || ROLE_STYLES.SALESPERSON;
        return (
          <div className="flex items-center gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', style.tile)}>
              {getInitials(u.firstName, u.lastName)}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                <span className="truncate">{u.firstName} {u.lastName}</span>
                {isMeUser(u) && <Badge variant="default" className="h-4 px-1.5 text-[9px]">You</Badge>}
                {u.role === 'SUPER_ADMIN' && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="truncate">{u.email}</span>
                {u.phone && <span className="shrink-0">· {u.phone}</span>}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tenant',
      label: 'Workspace',
      render: (u: any) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/dashboard/admin/tenants/${u.tenantId}`}
            className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{u.tenantName || 'Workspace'}</span>
            <span className="text-muted-foreground">/{u.tenantSlug}</span>
          </Link>
          {u.tenantStatus && u.tenantStatus !== 'active' && <StatusBadge status={u.tenantStatus} />}
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (u: any) => <RoleBadge role={u.role} /> },
    {
      key: 'isActive',
      label: 'Active',
      render: (u: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={!!u.isActive}
            disabled={u.role === 'SUPER_ADMIN' && isMeUser(u)}
            onCheckedChange={(v) => update.mutate({ id: u._id, body: { isActive: v } })}
          />
          <span className="text-xs text-muted-foreground">{u.isActive ? 'Active' : 'Inactive'}</span>
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      label: 'Last login',
      render: (u: any) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
          <Activity className="h-3 w-3" /> {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[56px]',
      render: (u: any) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <ActionMenu u={u} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Owner console"
        icon={ShieldCheck}
        title="All users"
        description="Every account across every tenant: owners, admins and team members."
        actions={
          <>
            <Badge variant="secondary" className="h-9 px-3 text-xs tabular">{totalUsers} accounts</Badge>
            <Button variant="gradient" onClick={() => setShowAddOwner(true)}>
              <Crown className="h-4 w-4" /> Add platform owner
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {/* Platform owners */}
        <Card className="relative overflow-hidden border-amber-500/30">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
          <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"><Crown className="h-4 w-4" /></div>
              <div>
                <CardTitle>Platform owners</CardTitle>
                <CardDescription className="mt-1">SUPER_ADMIN accounts in the owner workspace with universal rights across every tenant.</CardDescription>
              </div>
            </div>
            <Badge variant="warning" className="tabular">{ownerList.length}</Badge>
          </CardHeader>
          <CardContent className="relative flex flex-wrap gap-2.5">
            {ownerList.length === 0 && <p className="text-xs text-muted-foreground">No platform owners found.</p>}
            {ownerList.map((o) => (
              <div key={o._id} className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-card px-3 py-2 text-xs shadow-xs transition-colors hover:border-amber-500/50">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-amber-500 text-[10px]">{getInitials(o.firstName, o.lastName)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-semibold">
                    <span className="truncate">{o.firstName} {o.lastName}</span>
                    {isMeUser(o) && <span className="text-[10px] font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{o.email}</p>
                </div>
                {!o.isActive && <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">Inactive</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Toolbar */}
        <div>
          <Toolbar className="mb-0 rounded-b-none border-b-0">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search email, name or phone…"
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
            />
            <Button variant="soft" size="sm" className="h-9" onClick={applySearch}><Search className="h-4 w-4" /> Search</Button>
            <ToolbarDivider />
            <Select value={role || 'all'} onValueChange={(v) => { setRole(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={active || 'all'} onValueChange={(v) => { setActive(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Any status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="true">Active only</SelectItem>
                <SelectItem value="false">Inactive only</SelectItem>
              </SelectContent>
            </Select>
            <ToolbarSpacer />
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={cn('rounded-md p-1.5 transition-all cursor-pointer', viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn('rounded-md p-1.5 transition-all cursor-pointer', viewMode === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </Toolbar>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border border-t border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
              <button
                onClick={clearFilters}
                className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer', !role && !active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}
              >
                All ({totalUsers})
              </button>
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => { setRole(role === r ? '' : r); setPage(1); }}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer', role === r ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}
                >
                  {r.toLowerCase().replace('_', ' ')}
                </button>
              ))}
            </div>
            {hasFilters && (
              <Button variant="ghost" size="xs" onClick={clearFilters} className="text-muted-foreground">
                <FilterX className="h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={users}
            total={meta?.total || 0}
            page={page}
            limit={limit}
            totalPages={meta?.totalPages || 1}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            isLoading={isLoading}
            emptyMessage="No users match these filters"
            emptyDescription="Try clearing your filters or search query."
          />
        ) : (
          <div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No users found"
                description="Try clearing your filters or search query."
                actionLabel={hasFilters ? 'Reset filters' : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {users.map((u: any) => {
                  const style = ROLE_STYLES[u.role] || ROLE_STYLES.SALESPERSON;
                  const isMe = isMeUser(u);
                  return (
                    <Card key={u._id} className="group flex flex-col justify-between p-5 transition-colors hover:border-primary/30">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', style.tile)}>
                              {getInitials(u.firstName, u.lastName)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="flex items-center gap-1.5 truncate text-sm font-bold">
                                <span className="truncate">{u.firstName} {u.lastName}</span>
                                {isMe && <Badge variant="default" className="h-4 px-1.5 text-[9px]">You</Badge>}
                              </h3>
                              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                          <ActionMenu u={u} />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <RoleBadge role={u.role} />
                          <Badge variant={u.isActive ? 'success' : 'secondary'} dot>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                          <span className="text-[11px] text-muted-foreground">{style.label}</span>
                        </div>

                        <Link
                          href={`/dashboard/admin/tenants/${u.tenantId}`}
                          className="mt-4 flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 font-medium">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{u.tenantName || 'Workspace'}</span>
                            <span className="text-[10px] text-muted-foreground">/{u.tenantSlug}</span>
                          </span>
                          {u.tenantStatus && <StatusBadge status={u.tenantStatus} />}
                        </Link>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone ? u.phone : 'No phone'}</span>
                          <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never logged in'}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!u.isActive}
                            disabled={u.role === 'SUPER_ADMIN' && isMe}
                            onCheckedChange={(v) => update.mutate({ id: u._id, body: { isActive: v } })}
                          />
                          <span className="text-[11px] text-muted-foreground">Active</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="xs" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3 w-3" /> Edit</Button>
                          {u.role !== 'SUPER_ADMIN' && (
                            <Button size="xs" variant="outline" className="text-primary" onClick={() => impersonateTenant(u.tenantId, u._id)}>
                              <UserCog className="h-3 w-3" /> Log in
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            {meta && (
              <TablePagination
                total={meta.total || 0}
                page={page}
                limit={limit}
                totalPages={meta.totalPages || 1}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
              />
            )}
          </div>
        )}
      </div>

      {/* Edit user */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Edit user</DialogTitle>
            <DialogDescription>{editUser?.email} · {editUser?.tenantName} (/{editUser?.tenantSlug})</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: editUser._id,
                  body: {
                    firstName: editForm.firstName.trim(),
                    lastName: editForm.lastName.trim(),
                    role: editForm.role,
                    phone: editForm.phone.trim(),
                  },
                })
              }
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-amber-500" /> Reset password</DialogTitle>
            <DialogDescription>{resetUser?.email} · every active session and refresh token is revoked immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New password (min 8 characters)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button disabled={newPassword.length < 8 || reset.isPending} onClick={() => reset.mutate({ id: resetUser._id, password: newPassword })}>
              {reset.isPending ? 'Resetting…' : 'Confirm reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add platform owner */}
      <Dialog open={showAddOwner} onOpenChange={() => setShowAddOwner(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"><Crown className="h-4 w-4" /></span>
              Add platform owner
            </DialogTitle>
            <DialogDescription>Creates a full SUPER_ADMIN account in the owner workspace (slug &quot;owner&quot;).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First name *</Label>
              <Input value={ownerForm.firstName} onChange={(e) => setOwnerForm({ ...ownerForm, firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Last name *</Label>
              <Input value={ownerForm.lastName} onChange={(e) => setOwnerForm({ ...ownerForm, lastName: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Email *</Label>
              <Input type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Password * (min 8 characters)</Label>
              <Input type="password" value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOwner(false)}>Cancel</Button>
            <Button
              variant="gradient"
              disabled={addOwner.isPending || !ownerForm.email || ownerForm.password.length < 8 || !ownerForm.firstName || !ownerForm.lastName}
              onClick={() => addOwner.mutate(ownerForm)}
            >
              {addOwner.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {addOwner.isPending ? 'Creating…' : 'Create platform owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
