'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Download,
  Eye,
  UserCog,
  Ban,
  CheckCircle2,
  Building2,
  Users,
  MessageSquare,
  Bot,
  FilterX,
  LayoutGrid,
  List,
  Sparkles,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  TrendingUp,
  Globe,
  Activity,
  Layers,
  MoreHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
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

const PLAN_THEMES: Record<string, { ring: string; bg: string; text: string; gradient: string }> = {
  free: {
    ring: 'border-blue-500/30 group-hover:border-blue-500/60',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    gradient: 'from-blue-500/10 via-background to-background',
  },
  starter: {
    ring: 'border-teal-500/30 group-hover:border-teal-500/60',
    bg: 'bg-teal-500/10',
    text: 'text-teal-500',
    gradient: 'from-teal-500/10 via-background to-background',
  },
  professional: {
    ring: 'border-purple-500/30 group-hover:border-purple-500/60',
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    gradient: 'from-purple-500/10 via-background to-background',
  },
  enterprise: {
    ring: 'border-amber-500/40 group-hover:border-amber-500/80',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    gradient: 'from-amber-500/15 via-background to-background',
  },
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
  });
  const { data: overview } = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<any>('/admin/overview') });

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

  const columns = [
    {
      key: 'name',
      label: 'Workspace / Organization',
      render: (t: any) => {
        const theme = PLAN_THEMES[t.plan || 'free'] || PLAN_THEMES.free;
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-semibold text-xs transition-transform group-hover:scale-105',
                theme.bg,
                theme.text,
                theme.ring
              )}
            >
              {getInitials(t.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-2 text-foreground">
                <span className="truncate">{t.name}</span>
                {t.isPlatformOwner && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Owner
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                <span>/{t.slug}</span>
                {t.domain && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center text-[11px]">
                      <Globe className="mr-0.5 h-2.5 w-2.5" />
                      {t.domain}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'plan',
      label: 'Plan Tier',
      render: (t: any) => <PlanBadge plan={t.plan} />,
    },
    {
      key: 'status',
      label: 'Health & Status',
      render: (t: any) => (
        <div>
          <StatusBadge status={t.status} />
          {t.status === 'trial' && t.trialEndsAt && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> ends {formatDate(t.trialEndsAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stats',
      label: 'Team / Agents',
      render: (t: any) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {t.stats?.users || 0}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            {t.stats?.agents || 0}
          </span>
        </div>
      ),
    },
    {
      key: 'leads',
      label: 'Leads / Convs',
      render: (t: any) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums text-foreground">{formatNumber(t.stats?.leads)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground tabular-nums">{formatNumber(t.stats?.conversations)}</span>
        </div>
      ),
    },
    {
      key: 'last',
      label: 'Last Active',
      render: (t: any) => (
        <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
          <Activity className="h-3 w-3 text-muted-foreground" />
          {timeAgo(t.stats?.lastConversationAt)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (t: any) => <span className="text-xs text-muted-foreground tabular-nums">{formatDate(t.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (t: any) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View details</TooltipContent>
            </Tooltip>

            {!t.isPlatformOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => impersonateTenant(t._id)}
                  >
                    <UserCog className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Impersonate workspace</TooltipContent>
              </Tooltip>
            )}

            {!t.isPlatformOwner && t.status !== 'suspended' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={() => setSuspendTarget(t)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Suspend workspace</TooltipContent>
              </Tooltip>
            )}

            {t.status === 'suspended' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => activateMutation.mutate(t._id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-activate workspace</TooltipContent>
              </Tooltip>
            )}
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspaces</h1>
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 bg-primary/5 text-primary">
              {totalTenants} Total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide directory, tenant management, subscription tiers, and session administration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="shadow-xs">
            <Download className="mr-2 h-4 w-4" /> {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="shadow-xs font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Workspace
          </Button>
        </div>
      </div>

      {/* Interactive KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tenants */}
        <div
          onClick={() => {
            setStatus('');
            setPlan('');
            setPage(1);
          }}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md',
            !status && !plan && 'border-primary ring-1 ring-primary/30 shadow-xs'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Workspaces</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{formatNumber(totalTenants)}</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +{stats.last30d || 0} this month
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{payingPct}%</span> paying conversion
          </p>
        </div>

        {/* Active Workspaces */}
        <div
          onClick={() => {
            setStatus(status === 'active' ? '' : 'active');
            setPage(1);
          }}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-emerald-500/50 hover:shadow-md',
            status === 'active' && 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-xs'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active & Healthy</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{formatNumber(activeCount)}</span>
            <span className="text-xs text-muted-foreground">
              {totalTenants ? Math.round((activeCount / totalTenants) * 100) : 0}% of platform
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Fully operational
          </p>
        </div>

        {/* In Trial */}
        <div
          onClick={() => {
            setStatus(status === 'trial' ? '' : 'trial');
            setPage(1);
          }}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-amber-500/50 hover:shadow-md',
            status === 'trial' && 'border-amber-500 ring-1 ring-amber-500/30 shadow-xs'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evaluating / Trial</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{formatNumber(trialCount)}</span>
            <span className="text-xs text-muted-foreground">
              {totalTenants ? Math.round((trialCount / totalTenants) * 100) : 0}% pipeline
            </span>
          </div>
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> High conversion potential
          </p>
        </div>

        {/* Suspended */}
        <div
          onClick={() => {
            setStatus(status === 'suspended' ? '' : 'suspended');
            setPage(1);
          }}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-rose-500/50 hover:shadow-md',
            status === 'suspended' && 'border-rose-500 ring-1 ring-rose-500/30 shadow-xs'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suspended / Risk</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{formatNumber(suspendedCount)}</span>
            <span className="text-xs text-muted-foreground">Requires review</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            {suspendedCount === 0 ? 'No suspended tenants' : 'Sessions revoked'}
          </p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, View Modes */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3.5 backdrop-blur-sm shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex flex-1 items-center gap-2 min-w-[260px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, slug, custom domain..."
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
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[145px] h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {TENANT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={plan || 'all'}
              onValueChange={(v) => {
                setPlan(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Mode Switcher */}
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

        {/* Quick Filter Pills & Active Filter Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Quick filter:</span>
            <button
              onClick={() => {
                setStatus('');
                setPlan('');
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
                !status && !plan ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
              )}
            >
              All ({totalTenants})
            </button>
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPlan(plan === p ? '' : p);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors capitalize',
                  plan === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                )}
              >
                {p} ({stats.byPlan?.[p] || 0})
              </button>
            ))}
          </div>

          {(status || plan || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('');
                setPlan('');
                setSearch('');
                setSearchInput('');
                setPage(1);
                router.push('/dashboard/admin/tenants');
              }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content: Table or Grid View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={tenants}
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
          onRowClick={(t: any) => router.push(`/dashboard/admin/tenants/${t._id}`)}
          emptyMessage="No workspaces match your active search and filter criteria."
        />
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 rounded-xl border bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-semibold">No workspaces found</h3>
              <p className="mt-1 text-xs text-muted-foreground">Try clearing your filters or search query.</p>
              {(status || plan || search) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatus('');
                    setPlan('');
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
              {tenants.map((t: any) => {
                const theme = PLAN_THEMES[t.plan || 'free'] || PLAN_THEMES.free;
                return (
                  <div
                    key={t._id}
                    onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}
                    className={cn(
                      'group relative flex flex-col justify-between rounded-xl border bg-gradient-to-b p-4.5 transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5',
                      theme.gradient,
                      theme.ring
                    )}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-bold text-sm shadow-xs',
                              theme.bg,
                              theme.text,
                              theme.ring
                            )}
                          >
                            {getInitials(t.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                              {t.name}
                              {t.isPlatformOwner && (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  Owner
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">/{t.slug}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <PlanBadge plan={t.plan} />
                          <StatusBadge status={t.status} />
                        </div>
                      </div>

                      {/* Domain pill if exists */}
                      {t.domain && (
                        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-0.5 w-fit">
                          <Globe className="h-3 w-3" />
                          <span className="truncate">{t.domain}</span>
                        </div>
                      )}

                      {/* Live Usage Metrics */}
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-card/60 p-2.5 text-xs">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Leads captured</p>
                          <p className="mt-0.5 font-bold tabular-nums text-foreground">{formatNumber(t.stats?.leads || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Conversations</p>
                          <p className="mt-0.5 font-bold tabular-nums text-foreground">{formatNumber(t.stats?.conversations || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Users / Agents</p>
                          <p className="mt-0.5 font-medium tabular-nums text-foreground">
                            {t.stats?.users || 0} <span className="text-muted-foreground">/</span> {t.stats?.agents || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Last active</p>
                          <p className="mt-0.5 font-medium text-muted-foreground truncate">{timeAgo(t.stats?.lastConversationAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-muted-foreground">Joined {formatDate(t.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        {!t.isPlatformOwner && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            title="Impersonate workspace"
                            onClick={() => impersonateTenant(t._id)}
                          >
                            <UserCog className="mr-1 h-3 w-3" /> Log In
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-primary"
                          onClick={() => router.push(`/dashboard/admin/tenants/${t._id}`)}
                        >
                          Manage <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
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
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, meta.total)} of {meta.total} workspaces
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

      {/* Create Tenant Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Create New Workspace
            </DialogTitle>
            <DialogDescription>
              Provisions a fresh isolated tenant workspace and its primary ADMIN owner account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Organization Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acme Technologies Inc."
              />
            </div>
            <div className="space-y-2">
              <Label>Workspace Slug (optional)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="acme"
              />
            </div>
            <div className="space-y-2">
              <Label>Custom Domain (optional)</Label>
              <Input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="app.acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Plan Tier</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['trial', 'active'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.status === 'trial' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Trial Duration (Days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Internal Administrative Notes</Label>
              <Textarea
                rows={2}
                value={form.internalNotes}
                onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                placeholder="Deal size, SLA level, primary stakeholder..."
              />
            </div>

            <div className="md:col-span-2 border-t pt-4">
              <p className="text-sm font-bold mb-3 flex items-center gap-1.5 text-foreground">
                <Users className="h-4 w-4 text-primary" /> Primary Workspace Administrator
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={form.adminFirstName}
                    onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={form.adminLastName}
                    onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email *</Label>
                  <Input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Password * (min 8 chars)</Label>
                  <Input
                    type="password"
                    value={form.adminPassword}
                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="font-semibold">
              {createMutation.isPending ? 'Creating Workspace...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Tenant Modal */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" /> Suspend {suspendTarget?.name}?
            </DialogTitle>
            <DialogDescription>
              All active user sessions for this workspace will be immediately revoked. Users will not be able to log in until re-activated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Suspension Reason (displayed to tenant users on login attempt)</Label>
            <Textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Subscription payment overdue, terms violation..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={suspendMutation.isPending}
              onClick={() =>
                suspendMutation.mutate({
                  id: suspendTarget._id,
                  reason: suspendReason || undefined,
                })
              }
            >
              {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

