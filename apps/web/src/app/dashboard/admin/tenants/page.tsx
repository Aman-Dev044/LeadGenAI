'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Search, Download, Eye, UserCog, Ban, CheckCircle2, Building2, Users, Bot, FilterX, LayoutGrid, List,
  ArrowUpRight, Clock, Globe, Activity, MoreHorizontal, Sparkles, ShieldCheck, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, TablePagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Toolbar, SearchInput, ToolbarDivider, ToolbarSpacer } from '@/components/shared/toolbar';
import { PLANS, TENANT_STATUSES, PlanBadge, StatusBadge, downloadAuthenticated, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { impersonateTenant } from '@/lib/impersonation';
import { formatDate, cn } from '@/lib/utils';

const emptyForm = {
  name: '',
  slug: '',
  plan: 'free',
  status: 'trial',
  trialDays: '14',
  domain: '',
  internalNotes: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

const PLAN_THEMES: Record<string, { tile: string; ring: string }> = {
  free: { tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', ring: 'hover:border-sky-500/40' },
  starter: { tile: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', ring: 'hover:border-teal-500/40' },
  professional: { tile: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', ring: 'hover:border-violet-500/40' },
  enterprise: { tile: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', ring: 'hover:border-amber-500/50' },
};

export default function AdminTenantsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams?.get('status') || '');
  const [plan, setPlan] = useState(searchParams?.get('plan') || '');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const urlPlan = searchParams?.get('plan');
    const urlStatus = searchParams?.get('status');
    if (urlPlan !== null && urlPlan !== undefined) setPlan(urlPlan);
    if (urlStatus !== null && urlStatus !== undefined) setStatus(urlStatus);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenants', page, limit, search, status, plan],
    queryFn: () =>
      api.get<any>('/admin/tenants', {
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
        plan: plan || undefined,
      }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: overview } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<any>('/admin/overview'),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/admin/tenants', body),
    onSuccess: (res: any) => {
      invalidate();
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast.success(`Workspace "${res?.data?.tenant?.name}" created successfully`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.post(`/admin/tenants/${id}/suspend`, { reason }),
    onSuccess: () => {
      invalidate();
      setSuspendTarget(null);
      setSuspendReason('');
      toast.success('Tenant suspended; all active sessions revoked');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/tenants/${id}/activate`),
    onSuccess: () => {
      invalidate();
      toast.success('Workspace activated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const tenants: any[] = data?.data?.data || [];
  const meta = data?.data?.meta;
  const stats = overview?.data?.tenants || {};
  const totalTenants = stats.total || 0;
  const activeCount = stats.byStatus?.active || 0;
  const trialCount = stats.byStatus?.trial || 0;
  const suspendedCount = stats.byStatus?.suspended || 0;
  const payingCount = (stats.byPlan?.starter || 0) + (stats.byPlan?.professional || 0) + (stats.byPlan?.enterprise || 0);
  const payingPct = totalTenants ? Math.round((payingCount / totalTenants) * 100) : 0;
  const hasFilters = !!(status || plan || search);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadAuthenticated('/admin/tenants/export.csv', `tenants-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Tenants CSV exported successfully');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error('Organization name is required');
    if (!form.adminFirstName.trim() || !form.adminLastName.trim()) return toast.error('Admin name is required');
    if (!form.adminEmail.trim()) return toast.error('Admin email is required');
    if (form.adminPassword.length < 8) return toast.error('Admin password must be at least 8 characters');
    createMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      plan: form.plan,
      status: form.status,
      trialDays: Number(form.trialDays) || 0,
      domain: form.domain.trim() || undefined,
      internalNotes: form.internalNotes.trim() || undefined,
      admin: {
        firstName: form.adminFirstName.trim(),
        lastName: form.adminLastName.trim(),
        email: form.adminEmail.trim(),
        password: form.adminPassword,
      },
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'W';
  };

  const clearFilters = () => {
    setStatus('');
    setPlan('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  /** Row / card action menu - shared between table and grid views. */
  const ActionMenu = ({ t }: { t: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{t.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}>
          <Eye className="h-4 w-4" /> View details
        </DropdownMenuItem>
        {!t.isPlatformOwner && (
          <DropdownMenuItem onClick={() => impersonateTenant(t._id)}>
            <UserCog className="h-4 w-4 text-primary" /> Log in as tenant
          </DropdownMenuItem>
        )}
        {(!t.isPlatformOwner && t.status !== 'suspended') || t.status === 'suspended' ? <DropdownMenuSeparator /> : null}
        {!t.isPlatformOwner && t.status !== 'suspended' && (
          <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10" onClick={() => setSuspendTarget(t)}>
            <Ban className="h-4 w-4" /> Suspend workspace
          </DropdownMenuItem>
        )}
        {t.status === 'suspended' && (
          <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10" onClick={() => activateMutation.mutate(t._id)}>
            <CheckCircle2 className="h-4 w-4" /> Re-activate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns = [
    {
      key: 'name',
      label: 'Workspace',
      render: (t: any) => {
        const theme = PLAN_THEMES[t.plan || 'free'] || PLAN_THEMES.free;
        return (
          <div className="flex items-center gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', theme.tile)}>
              {getInitials(t.name)}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                <span className="truncate">{t.name}</span>
                {t.isPlatformOwner && <Badge variant="warning" className="h-4 px-1.5 text-[9px]">Owner</Badge>}
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span>/{t.slug}</span>
                {t.domain && (
                  <span className="inline-flex items-center gap-0.5 truncate"><span>·</span><Globe className="h-3 w-3" /> {t.domain}</span>
                )}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: 'plan', label: 'Plan', render: (t: any) => <PlanBadge plan={t.plan} /> },
    {
      key: 'status',
      label: 'Status',
      render: (t: any) => (
        <div>
          <StatusBadge status={t.status} />
          {t.status === 'trial' && t.trialEndsAt && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" /> ends {formatDate(t.trialEndsAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stats',
      label: 'Team / agents',
      render: (t: any) => (
        <div className="flex items-center gap-1.5 text-xs tabular">
          <span className="inline-flex items-center gap-1 font-semibold"><Users className="h-3.5 w-3.5 text-muted-foreground" /> {t.stats?.users || 0}</span>
          <span className="text-muted-foreground">/</span>
          <span className="inline-flex items-center gap-1 font-semibold"><Bot className="h-3.5 w-3.5 text-muted-foreground" /> {t.stats?.agents || 0}</span>
        </div>
      ),
    },
    {
      key: 'leads',
      label: 'Leads / convs',
      render: (t: any) => (
        <div className="text-xs tabular">
          <span className="font-semibold">{formatNumber(t.stats?.leads)}</span>
          <span className="text-muted-foreground"> / {formatNumber(t.stats?.conversations)}</span>
        </div>
      ),
    },
    {
      key: 'last',
      label: 'Last active',
      render: (t: any) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
          <Activity className="h-3 w-3" /> {timeAgo(t.stats?.lastConversationAt)}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Created', render: (t: any) => <span className="text-xs text-muted-foreground tabular">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      className: 'w-[56px]',
      render: (t: any) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <ActionMenu t={t} />
        </div>
      ),
    },
  ];

  const kpiActive = (on: boolean, cls: string) => cn(on && cls);

  return (
    <div>
      <PageHeader
        eyebrow="Owner console"
        icon={Building2}
        title="Tenants"
        description="Platform-wide directory: subscriptions, health, sessions and impersonation."
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New tenant
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {/* KPI ribbon (click to filter) */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total workspaces"
            value={formatNumber(totalTenants)}
            icon={Building2}
            tone="primary"
            description={`${payingPct}% on a paid plan`}
            trend={{ value: stats.last30d || 0, isPositive: true, label: 'this month' }}
            onClick={() => { setStatus(''); setPlan(''); setPage(1); }}
            className={kpiActive(!status && !plan, 'ring-2 ring-primary/40 border-primary/50')}
          />
          <StatCard
            title="Active"
            value={formatNumber(activeCount)}
            icon={CheckCircle2}
            tone="success"
            description={`${totalTenants ? Math.round((activeCount / totalTenants) * 100) : 0}% of platform · fully operational`}
            onClick={() => { setStatus(status === 'active' ? '' : 'active'); setPage(1); }}
            className={kpiActive(status === 'active', 'ring-2 ring-emerald-500/40 border-emerald-500/50')}
          />
          <StatCard
            title="In trial"
            value={formatNumber(trialCount)}
            icon={Clock}
            tone="warning"
            description={`${totalTenants ? Math.round((trialCount / totalTenants) * 100) : 0}% evaluating`}
            onClick={() => { setStatus(status === 'trial' ? '' : 'trial'); setPage(1); }}
            className={kpiActive(status === 'trial', 'ring-2 ring-amber-500/40 border-amber-500/50')}
          />
          <StatCard
            title="Suspended"
            value={formatNumber(suspendedCount)}
            icon={Ban}
            tone="danger"
            description={suspendedCount === 0 ? 'No suspended tenants' : 'Sessions revoked · needs review'}
            onClick={() => { setStatus(status === 'suspended' ? '' : 'suspended'); setPage(1); }}
            className={kpiActive(status === 'suspended', 'ring-2 ring-rose-500/40 border-rose-500/50')}
          />
        </div>

        {/* Toolbar */}
        <div>
          <Toolbar className="mb-0 rounded-b-none border-b-0">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search name, slug or domain…"
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
            />
            <Button variant="soft" size="sm" className="h-9" onClick={applySearch}><Search className="h-4 w-4" /> Search</Button>
            <ToolbarDivider />
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TENANT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={plan || 'all'} onValueChange={(v) => { setPlan(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All plans" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
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
          {/* Quick plan chips */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border border-t border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plan</span>
              <button
                onClick={clearFilters}
                className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer', !status && !plan ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}
              >
                All ({totalTenants})
              </button>
              {PLANS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPlan(plan === p ? '' : p); setPage(1); }}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors cursor-pointer', plan === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}
                >
                  {p} ({stats.byPlan?.[p] || 0})
                </button>
              ))}
            </div>
            {hasFilters && (
              <Button variant="ghost" size="xs" onClick={() => { clearFilters(); router.push('/dashboard/admin/tenants'); }} className="text-muted-foreground">
                <FilterX className="h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={tenants}
            total={meta?.total || 0}
            page={page}
            limit={limit}
            totalPages={meta?.totalPages || 1}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            isLoading={isLoading}
            onRowClick={(t: any) => router.push(`/dashboard/admin/tenants/${t._id}`)}
            emptyMessage="No workspaces found"
            emptyDescription="Try clearing your filters or search query."
          />
        ) : (
          <div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
              </div>
            ) : tenants.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No workspaces found"
                description="Try clearing your filters or search query."
                actionLabel={hasFilters ? 'Reset filters' : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tenants.map((t: any) => {
                  const theme = PLAN_THEMES[t.plan || 'free'] || PLAN_THEMES.free;
                  return (
                    <Card
                      key={t._id}
                      interactive
                      onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}
                      className={cn('group flex flex-col justify-between p-5', theme.ring)}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', theme.tile)}>
                              {getInitials(t.name)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="flex items-center gap-1.5 truncate text-sm font-bold">
                                <span className="truncate">{t.name}</span>
                                {t.isPlatformOwner && <Badge variant="warning" className="h-4 px-1.5 text-[9px]">Owner</Badge>}
                              </h3>
                              <p className="truncate text-xs text-muted-foreground">/{t.slug}</p>
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}><ActionMenu t={t} /></div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <PlanBadge plan={t.plan} />
                          <StatusBadge status={t.status} />
                          {t.domain && (
                            <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{t.domain}</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border/60 text-xs">
                          {[
                            { label: 'Leads', value: formatNumber(t.stats?.leads || 0) },
                            { label: 'Conversations', value: formatNumber(t.stats?.conversations || 0) },
                            { label: 'Users / agents', value: `${t.stats?.users || 0} / ${t.stats?.agents || 0}` },
                            { label: 'Last active', value: timeAgo(t.stats?.lastConversationAt) },
                          ].map((m) => (
                            <div key={m.label} className="bg-card p-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                              <p className="mt-0.5 truncate font-semibold tabular">{m.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t pt-3" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-muted-foreground">Joined {formatDate(t.createdAt)}</span>
                        <div className="flex items-center gap-1">
                          {!t.isPlatformOwner && (
                            <Button size="xs" variant="outline" onClick={() => impersonateTenant(t._id)}>
                              <UserCog className="h-3 w-3" /> Log in
                            </Button>
                          )}
                          <Button size="xs" variant="ghost" className="text-primary" onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}>
                            Manage <ArrowUpRight className="h-3 w-3" />
                          </Button>
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

      {/* Create tenant */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
              Create new workspace
            </DialogTitle>
            <DialogDescription>Provisions an isolated tenant workspace together with its first ADMIN account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> Workspace</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Organization name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Technologies Inc." />
                </div>
                <div className="space-y-2">
                  <Label>Slug (optional)</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="acme" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Custom domain (optional)</Label>
                  <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="app.acme.com" />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Initial status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['trial', 'active'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.status === 'trial' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Trial duration (days)</Label>
                    <Input type="number" min={0} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Internal notes</Label>
                  <Textarea rows={2} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} placeholder="Deal size, SLA level, primary stakeholder..." />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Primary administrator</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First name *</Label>
                  <Input value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last name *</Label>
                  <Input value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Admin email *</Label>
                  <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Initial password * (min 8)</Label>
                  <Input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createMutation.isPending ? 'Creating…' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend tenant */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Ban className="h-5 w-5" /> Suspend {suspendTarget?.name}?
            </DialogTitle>
            <DialogDescription>
              All active sessions for this workspace are revoked immediately. Users cannot log in until it is re-activated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to tenant users on login)</Label>
            <Textarea rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Subscription payment overdue, terms violation..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={suspendMutation.isPending}
              onClick={() => suspendMutation.mutate({ id: suspendTarget._id, reason: suspendReason || undefined })}
            >
              {suspendMutation.isPending ? 'Suspending…' : 'Confirm suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
