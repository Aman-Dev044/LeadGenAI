'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Pencil,
  KeyRound,
  LogOut,
  UserCog,
  Plus,
  Crown,
  Users,
  LayoutGrid,
  List,
  FilterX,
  Building2,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/shared/data-table';
import { ALL_ROLES, RoleBadge, StatusBadge, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { impersonateTenant } from '@/lib/impersonation';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  SUPER_ADMIN: {
    ring: 'border-amber-500/40 group-hover:border-amber-500/80',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    label: 'Platform Owner',
  },
  ADMIN: {
    ring: 'border-rose-500/30 group-hover:border-rose-500/60',
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    label: 'Tenant Admin',
  },
  SALES_MANAGER: {
    ring: 'border-emerald-500/30 group-hover:border-emerald-500/60',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    label: 'Sales Manager',
  },
  SALESPERSON: {
    ring: 'border-blue-500/30 group-hover:border-blue-500/60',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    label: 'Sales Representative',
  },
  VIEWER: {
    ring: 'border-slate-500/30 group-hover:border-slate-500/60',
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    label: 'Read-only Viewer',
  },
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

  const getInitials = (firstName?: string, lastName?: string) => {
    return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
  };

  const columns = [
    {
      key: 'name',
      label: 'User Account',
      render: (u: any) => {
        const isMe = String(u._id) === String(me?._id || (me as any)?.id);
        const style = ROLE_STYLES[u.role] || ROLE_STYLES.VIEWER;
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-semibold text-xs',
                style.bg,
                style.text,
                style.ring
              )}
            >
              {getInitials(u.firstName, u.lastName)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-2 text-foreground">
                <span className="truncate">
                  {u.firstName} {u.lastName}
                </span>
                {isMe && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                    You
                  </span>
                )}
                {u.role === 'SUPER_ADMIN' && (
                  <span title="Platform Owner" className="inline-flex">
                    <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                <span>{u.email}</span>
                {u.phone && <span>· {u.phone}</span>}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tenant',
      label: 'Workspace / Organization',
      render: (u: any) => (
        <Link
          href={`/dashboard/admin/tenants/${u.tenantId}`}
          className="group inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Building2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
          <span className="font-semibold">{u.tenantName || 'Workspace'}</span>
          <span className="text-muted-foreground">/{u.tenantSlug}</span>
          {u.tenantStatus && u.tenantStatus !== 'active' && (
            <span className="ml-1">
              <StatusBadge status={u.tenantStatus} />
            </span>
          )}
        </Link>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (u: any) => <RoleBadge role={u.role} />,
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (u: any) => (
        <Switch
          checked={!!u.isActive}
          disabled={u.role === 'SUPER_ADMIN' && String(u._id) === String(me?._id || (me as any)?.id)}
          onCheckedChange={(v) => update.mutate({ id: u._id, body: { isActive: v } })}
        />
      ),
    },
    {
      key: 'lastLoginAt',
      label: 'Last Login',
      render: (u: any) => (
        <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
          <Activity className="h-3 w-3 text-muted-foreground" />
          {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (u: any) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setEditUser(u);
                    setEditForm({
                      firstName: u.firstName || '',
                      lastName: u.lastName || '',
                      role: u.role,
                      phone: u.phone || '',
                    });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit user</TooltipContent>
            </Tooltip>

            {u.role !== 'SUPER_ADMIN' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => impersonateTenant(u.tenantId, u._id)}
                  >
                    <UserCog className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Log in as user</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                  onClick={() => setResetUser(u)}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset password</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  onClick={() => forceLogout.mutate(u._id)}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revoke sessions</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">User Accounts</h1>
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 bg-primary/5 text-primary">
              {totalUsers} Platform Accounts
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide directory of all users, platform owners, tenant administrators, and team members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddOwner(true)} className="shadow-xs font-semibold">
            <Crown className="mr-2 h-4 w-4 text-amber-400" /> Add Platform Owner
          </Button>
        </div>
      </div>

      {/* Platform Owners Showcase Card */}
      <Card className="relative overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Crown className="h-4 w-4 text-amber-500" /> Platform Owners ({ownerList.length})
            </CardTitle>
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Full Super Admin Access
            </span>
          </div>
          <CardDescription className="text-xs">
            SUPER_ADMIN accounts. They belong to the owner workspace and hold universal administrative rights across every tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 pb-4">
          {ownerList.map((o) => (
            <div
              key={o._id}
              className="flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-card/80 px-3 py-2 text-xs shadow-2xs backdrop-blur-xs transition-all hover:border-amber-500/50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                {getInitials(o.firstName, o.lastName)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <span>
                    {o.firstName} {o.lastName}
                  </span>
                  {String(o._id) === String(me?._id || (me as any)?.id) && (
                    <span className="text-[10px] text-muted-foreground font-normal">(you)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{o.email}</p>
              </div>
              {!o.isActive && (
                <span className="rounded bg-rose-500/15 px-1 py-0.5 text-[9px] font-bold text-rose-500 border border-rose-500/30">
                  Inactive
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Control Bar: Search, Role & Status Filter, View Mode */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3.5 backdrop-blur-sm shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2 min-w-[260px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email, name, phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
              className="h-9 px-3"
            >
              Search
            </Button>
          </div>

          {/* Filters & View Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={role || 'all'}
              onValueChange={(v) => {
                setRole(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[165px] h-9 text-xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={active || 'all'}
              onValueChange={(v) => {
                setActive(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[135px] h-9 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive Only</SelectItem>
              </SelectContent>
            </Select>

            {/* View Switcher */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'table' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'grid' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid cards view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Role Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Role:</span>
            <button
              onClick={() => {
                setRole('');
                setActive('');
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
                !role && !active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
              )}
            >
              All Users ({totalUsers})
            </button>
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(role === r ? '' : r);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
                  role === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {(role || active || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRole('');
                setActive('');
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Content: Table or Grid View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={users}
          total={meta?.total || 0}
          page={page}
          limit={limit}
          totalPages={meta?.totalPages || 1}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          isLoading={isLoading}
          emptyMessage="No users match these filters"
        />
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 rounded-xl border bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-semibold">No users found</h3>
              <p className="mt-1 text-xs text-muted-foreground">Try clearing your filters or search query.</p>
              {(role || active || search) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRole('');
                    setActive('');
                    setSearch('');
                    setSearchInput('');
                    setPage(1);
                  }}
                  className="mt-4"
                >
                  Reset filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((u: any) => {
                const style = ROLE_STYLES[u.role] || ROLE_STYLES.VIEWER;
                const isMe = String(u._id) === String(me?._id || (me as any)?.id);

                return (
                  <div
                    key={u._id}
                    className={cn(
                      'group relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                      style.ring
                    )}
                  >
                    <div>
                      {/* User Avatar + Role */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-bold text-xs shadow-xs',
                              style.bg,
                              style.text,
                              style.ring
                            )}
                          >
                            {getInitials(u.firstName, u.lastName)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                              {u.firstName} {u.lastName}
                              {isMe && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                                  You
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <RoleBadge role={u.role} />
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                u.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              )}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Workspace link */}
                      <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs">
                        <Link
                          href={`/dashboard/admin/tenants/${u.tenantId}`}
                          className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors truncate"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{u.tenantName || 'Workspace'}</span>
                          <span className="text-[10px] text-muted-foreground">/{u.tenantSlug}</span>
                        </Link>
                        {u.tenantStatus && <StatusBadge status={u.tenantStatus} />}
                      </div>

                      {/* Phone & Last Login */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{u.phone ? u.phone : 'No phone set'}</span>
                        <span>Last: {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={!!u.isActive}
                          disabled={u.role === 'SUPER_ADMIN' && isMe}
                          onCheckedChange={(v) => update.mutate({ id: u._id, body: { isActive: v } })}
                        />
                        <span className="text-[11px] text-muted-foreground">Active</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditUser(u);
                            setEditForm({
                              firstName: u.firstName || '',
                              lastName: u.lastName || '',
                              role: u.role,
                              phone: u.phone || '',
                            });
                          }}
                        >
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>

                        {u.role !== 'SUPER_ADMIN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-primary"
                            onClick={() => impersonateTenant(u.tenantId, u._id)}
                          >
                            <UserCog className="mr-1 h-3 w-3" /> Log In
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grid Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t text-xs">
              <span className="text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, meta.total)} of {meta.total} users
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="font-semibold">
                  Page {page} of {meta.totalPages}
                </span>
                <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {editUser?.email}</DialogTitle>
            <DialogDescription>
              Organization: {editUser?.tenantName} (/{editUser?.tenantSlug})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
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
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetUser?.email}</DialogTitle>
            <DialogDescription>
              All currently active sessions and refresh tokens for this user will be revoked immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New Password (min 8 characters)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={newPassword.length < 8 || reset.isPending}
              onClick={() => reset.mutate({ id: resetUser._id, password: newPassword })}
            >
              {reset.isPending ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Platform Owner Dialog */}
      <Dialog open={showAddOwner} onOpenChange={() => setShowAddOwner(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" /> Add Platform Owner
            </DialogTitle>
            <DialogDescription>
              Creates a full SUPER_ADMIN account in the owner workspace (slug &quot;owner&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                value={ownerForm.firstName}
                onChange={(e) => setOwnerForm({ ...ownerForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                value={ownerForm.lastName}
                onChange={(e) => setOwnerForm({ ...ownerForm, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={ownerForm.email}
                onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Password * (min 8 characters)</Label>
              <Input
                type="password"
                value={ownerForm.password}
                onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOwner(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                addOwner.isPending ||
                !ownerForm.email ||
                ownerForm.password.length < 8 ||
                !ownerForm.firstName ||
                !ownerForm.lastName
              }
              onClick={() => addOwner.mutate(ownerForm)}
              className="font-semibold"
            >
              {addOwner.isPending ? 'Creating Owner...' : 'Create Platform Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
