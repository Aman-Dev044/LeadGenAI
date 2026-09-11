'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, UserCog, Ban, CheckCircle2, Trash2, Save, Users, Bot, MessageSquare, Cpu, KeyRound, LogOut,
  Building2, Globe, Calendar, Flame, Gauge, Flag, Settings2, StickyNote, ScrollText, AlertTriangle, ShieldCheck, Loader2, Crown,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { PLANS, TENANT_STATUSES, PlanBadge, StatusBadge, RoleBadge, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { impersonateTenant } from '@/lib/impersonation';
import { formatDate, getInitials, cn } from '@/lib/utils';

const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: 'maxAgents', label: 'Max agents' },
  { key: 'maxLeads', label: 'Max leads' },
  { key: 'maxConversationsPerMonth', label: 'Conversations / month' },
  { key: 'maxKnowledgeSources', label: 'Knowledge sources' },
  { key: 'maxUsers', label: 'Max users' },
];

/** Usage meter with tone that reflects how close the tenant is to its limit. */
function UsageMeter({ label, used, limit }: { label: string; used: number; limit?: number }) {
  const unlimited = !limit || limit <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && used > limit;
  const tone = over || pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-semibold tabular', over && 'text-rose-600 dark:text-rose-400')}>
          {formatNumber(used)} <span className="font-normal text-muted-foreground">/ {unlimited ? '∞' : formatNumber(limit)}</span>
        </span>
      </div>
      <Progress value={unlimited ? 0 : pct} tone={tone} className="h-2" />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function SaveFooter({ children }: { children: React.ReactNode }) {
  return <CardFooter className="justify-end gap-2 border-t bg-muted/30 px-6 py-3">{children}</CardFooter>;
}

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => api.get<any>(`/admin/tenants/${id}`),
  });
  const d = data?.data;
  const tenant = d?.tenant;

  const [planForm, setPlanForm] = useState<any>({ plan: 'free', status: 'trial', trialEndsAt: '', limits: {} });
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [general, setGeneral] = useState({ name: '', slug: '', domain: '', allowedOrigins: '' });
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [purge, setPurge] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setPlanForm({
      plan: tenant.plan || 'free',
      status: tenant.status || 'trial',
      trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString().slice(0, 10) : '',
      limits: { ...(tenant.limits || {}) },
    });
    setFlags({ ...(tenant.featureFlags || {}) });
    setNotes(tenant.internalNotes || '');
    setGeneral({ name: tenant.name || '', slug: tenant.slug || '', domain: tenant.domain || '', allowedOrigins: (tenant.allowedOrigins || []).join(', ') });
  }, [tenant]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
  };

  const update = useMutation({
    mutationFn: (body: any) => api.patch(`/admin/tenants/${id}`, body),
    onSuccess: () => { invalidate(); toast.success('Tenant updated'); },
    onError: (err: any) => toast.error(err.message),
  });
  const suspend = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${id}/suspend`, { reason: suspendReason || undefined }),
    onSuccess: () => { invalidate(); setSuspendOpen(false); toast.success('Tenant suspended'); },
    onError: (err: any) => toast.error(err.message),
  });
  const activate = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${id}/activate`),
    onSuccess: () => { invalidate(); toast.success('Tenant activated'); },
    onError: (err: any) => toast.error(err.message),
  });
  const [deleting, setDeleting] = useState(false);
  const updateUser = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: any }) => api.patch(`/admin/users/${userId}`, body),
    onSuccess: () => { invalidate(); toast.success('User updated'); },
    onError: (err: any) => toast.error(err.message),
  });
  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => api.post(`/admin/users/${userId}/reset-password`, { newPassword: password }),
    onSuccess: () => { setResetUser(null); setNewPassword(''); toast.success('Password reset and sessions revoked'); },
    onError: (err: any) => toast.error(err.message),
  });
  const forceLogout = useMutation({
    mutationFn: (userId: string) => api.post(`/admin/users/${userId}/force-logout`),
    onSuccess: (res: any) => toast.success(`${res?.data?.revokedSessions ?? 0} session(s) revoked`),
    onError: (err: any) => toast.error(err.message),
  });

  // DELETE with a JSON body: the shared client has no body for delete, so call fetch directly
  const handleDelete = async () => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const token = localStorage.getItem('accessToken');
    setDeleting(true);
    try {
      const res = await fetch(`${base}/admin/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ confirmSlug, purge }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Delete failed');
      toast.success(purge ? 'Tenant purged permanently' : 'Tenant soft-deleted');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.push('/dashboard/admin/tenants');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || !tenant) return <Loading label="Loading tenant" />;

  const usage = d.usage || {};
  const counts = d.counts || {};
  const known: any[] = d.knownFeatureFlags || [];
  const effective: Record<string, boolean> = d.effectiveFeatureFlags || {};
  const SaveIcon = update.isPending ? Loader2 : Save;
  const saveCls = cn('h-4 w-4', update.isPending && 'animate-spin');

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => router.push('/dashboard/admin/tenants')}>
        <ArrowLeft className="h-4 w-4" /> All tenants
      </Button>

      {/* Summary header */}
      <Card className="relative overflow-hidden page-enter">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/15 via-violet-500/10 to-transparent" />
        <CardContent className="relative p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 rounded-2xl ring-4 ring-card shadow-md">
                <AvatarFallback className="rounded-2xl text-lg">{getInitials(tenant.name || 'W')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Owner console · Tenant</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
                  <PlanBadge plan={tenant.plan} />
                  <StatusBadge status={tenant.status} />
                  {tenant.isPlatformOwner && <Badge variant="warning"><Crown className="h-3 w-3" /> Owner workspace</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> /{tenant.slug}</span>
                  {tenant.domain && <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {tenant.domain}</span>}
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Created {formatDate(tenant.createdAt)}</span>
                  {tenant.trialEndsAt && tenant.status === 'trial' && (
                    <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Trial ends {formatDate(tenant.trialEndsAt)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!tenant.isPlatformOwner && (
                <Button variant="gradient" onClick={() => impersonateTenant(tenant._id)}><UserCog className="h-4 w-4" /> Log in as tenant</Button>
              )}
              {!tenant.isPlatformOwner && tenant.status !== 'suspended' && (
                <Button variant="outline" className="text-rose-600 hover:text-rose-600 hover:border-rose-500/40 hover:bg-rose-500/5" onClick={() => setSuspendOpen(true)}><Ban className="h-4 w-4" /> Suspend</Button>
              )}
              {(tenant.status === 'suspended' || tenant.status === 'cancelled') && (
                <Button variant="outline" className="text-emerald-600 hover:text-emerald-600 hover:border-emerald-500/40 hover:bg-emerald-500/5" disabled={activate.isPending} onClick={() => activate.mutate()}><CheckCircle2 className="h-4 w-4" /> Activate</Button>
              )}
            </div>
          </div>

          {tenant.status === 'suspended' && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-semibold text-rose-700 dark:text-rose-400">Suspended {tenant.suspendedAt ? formatDate(tenant.suspendedAt) : ''}</p>
                {tenant.suspendedReason && <p className="text-muted-foreground">{tenant.suspendedReason}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={counts.users || 0} icon={Users} tone="primary" description={`${counts.agents || 0} agents`} />
        <StatCard title="Leads" value={formatNumber(counts.leads)} icon={Flame} tone="success" description={`+${usage.leads || 0} this month`} />
        <StatCard title="Conversations" value={formatNumber(counts.conversations)} icon={MessageSquare} tone="violet" description={`${usage.conversations || 0} this month · ${formatNumber(counts.messages)} messages`} />
        <StatCard title="AI tokens" value={formatNumber(usage.aiTokensThisMonth)} icon={Cpu} tone="warning" description={`${formatNumber(usage.aiTokensTotal)} all time`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><Gauge className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4" /> Users <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 tabular">{d.users?.length || 0}</Badge></TabsTrigger>
          <TabsTrigger value="plan"><ShieldCheck className="h-4 w-4" /> Plan & limits</TabsTrigger>
          <TabsTrigger value="flags"><Flag className="h-4 w-4" /> Feature flags</TabsTrigger>
          <TabsTrigger value="general"><Settings2 className="h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="h-4 w-4" /> Notes & audit</TabsTrigger>
          {!tenant.isPlatformOwner && <TabsTrigger value="danger" className="text-rose-600 data-[state=active]:text-rose-600"><AlertTriangle className="h-4 w-4" /> Danger zone</TabsTrigger>}
        </TabsList>

        {/* ---------------- overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Usage vs limits</CardTitle>
                  <CardDescription>Period {usage.period}</CardDescription>
                </div>
                <PlanBadge plan={tenant.plan} />
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <UsageMeter label="Conversations this month" used={usage.conversations || 0} limit={usage.limits?.maxConversationsPerMonth} />
                <UsageMeter label="Leads (total)" used={counts.leads || 0} limit={usage.limits?.maxLeads} />
                <UsageMeter label="Users" used={counts.users || 0} limit={usage.limits?.maxUsers} />
                <UsageMeter label="Agents" used={counts.agents || 0} limit={usage.limits?.maxAgents} />
                <UsageMeter label="Knowledge sources" used={counts.knowledgeSources || 0} limit={usage.limits?.maxKnowledgeSources} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Details</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Slug">/{tenant.slug}</InfoRow>
                <InfoRow label="Domain">{tenant.domain || '—'}</InfoRow>
                <InfoRow label="Plan"><span className="capitalize">{tenant.plan || 'free'}</span></InfoRow>
                <InfoRow label="Status"><span className="capitalize">{tenant.status}</span></InfoRow>
                <InfoRow label="Trial ends">{tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : '—'}</InfoRow>
                <InfoRow label="Created">{formatDate(tenant.createdAt)}</InfoRow>
                <InfoRow label="Origins">{(tenant.allowedOrigins || []).length || 0}</InfoRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><Flame className="h-4 w-4 text-rose-500" /> Recent leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {d.recentLeads?.length ? d.recentLeads.map((l: any) => {
                  const name = [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed';
                  return (
                    <div key={l._id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.email || l.phone || '—'} · {l.source || 'unknown'} · {timeAgo(l.createdAt)}</p>
                      </div>
                      <Badge variant={l.temperature === 'hot' ? 'destructive' : l.temperature === 'warm' ? 'warning' : 'info'} className="tabular">{l.score ?? 0}</Badge>
                    </div>
                  );
                }) : <EmptyState compact icon={Flame} title="No leads yet" description="Leads captured by this tenant will show here." />}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Agents & conversations</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agents</p>
                  {d.agents?.length ? d.agents.map((a: any) => (
                    <div key={a._id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.aiConfig?.provider}/{a.aiConfig?.model}</p>
                      </div>
                      <Badge variant={a.status === 'active' ? 'success' : 'secondary'} dot>{a.status}</Badge>
                    </div>
                  )) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No agents configured.</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent conversations</p>
                  {d.recentConversations?.length ? d.recentConversations.map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                      <span className="flex items-center gap-2 text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> {timeAgo(c.createdAt)}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge variant="outline">{c.mode}</Badge>
                        <Badge variant={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge>
                        <span className="tabular text-muted-foreground">{c.messageCount || 0} msgs</span>
                      </span>
                    </div>
                  )) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No conversations yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- users */}
        <TabsContent value="users">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Team members</CardTitle>
                <CardDescription>Every account in this workspace. Toggle active state or act on a user.</CardDescription>
              </div>
              <Badge variant="secondary" className="tabular">{d.users?.length || 0}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">User</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead><TableHead>Last login</TableHead><TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.users?.map((u: any) => (
                    <TableRow key={u._id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarFallback className="text-[11px]">{getInitials(`${u.firstName || ''} ${u.lastName || ''}`.trim() || 'U')}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{u.firstName} {u.lastName}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell>
                        <Switch checked={!!u.isActive} disabled={u.role === 'SUPER_ADMIN'} onCheckedChange={(v) => updateUser.mutate({ userId: u._id, body: { isActive: v } })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end gap-1">
                          {u.role !== 'SUPER_ADMIN' && (
                            <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary" onClick={() => impersonateTenant(tenant._id, u._id)}><UserCog className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Log in as this user</TooltipContent></Tooltip>
                          )}
                          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:text-amber-600" onClick={() => setResetUser(u)}><KeyRound className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reset password</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-600" onClick={() => forceLogout.mutate(u._id)}><LogOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Force logout</TooltipContent></Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!d.users?.length && (
                    <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">No users in this workspace.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- plan & limits */}
        <TabsContent value="plan">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Plan, status & limits</CardTitle>
              <CardDescription>Changing the plan applies that plan's default limits unless you edit them below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={planForm.plan} onValueChange={(v) => setPlanForm({ ...planForm, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={planForm.status} onValueChange={(v) => setPlanForm({ ...planForm, status: v })} disabled={tenant.isPlatformOwner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TENANT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trial ends</Label>
                  <Input type="date" value={planForm.trialEndsAt} onChange={(e) => setPlanForm({ ...planForm, trialEndsAt: e.target.value })} />
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limits</p>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                  {LIMIT_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-2">
                      <Label className="text-xs">{f.label}</Label>
                      <Input type="number" min={0} className="tabular" value={planForm.limits?.[f.key] ?? ''} onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, [f.key]: Number(e.target.value) } })} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <SaveFooter>
              <Button
                disabled={update.isPending}
                onClick={() => {
                  const body: any = { plan: planForm.plan, status: planForm.status };
                  const limitsChanged = JSON.stringify(planForm.limits) !== JSON.stringify(tenant.limits || {});
                  if (limitsChanged) body.limits = planForm.limits;
                  if (planForm.trialEndsAt) body.trialEndsAt = new Date(planForm.trialEndsAt).toISOString();
                  update.mutate(body);
                }}
              >
                <SaveIcon className={saveCls} /> Save plan & limits
              </Button>
            </SaveFooter>
          </Card>
        </TabsContent>

        {/* ---------------- feature flags */}
        <TabsContent value="flags">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Feature flags</CardTitle>
              <CardDescription>Per-tenant overrides. Unset flags inherit the platform default.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {known.map((f) => {
                  const overridden = flags[f.key] !== undefined;
                  const value = overridden ? flags[f.key] : effective[f.key];
                  return (
                    <div key={f.key} className={cn('flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors', value ? 'border-primary/30 bg-primary/[0.04]' : 'bg-muted/20')}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{f.label}</p>
                          <Badge variant={overridden ? 'violet' : 'secondary'}>{overridden ? 'override' : 'inherited'}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                        {overridden && (
                          <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline cursor-pointer" onClick={() => { const n = { ...flags }; delete n[f.key]; setFlags(n); }}>Reset to platform default</button>
                        )}
                      </div>
                      <Switch checked={!!value} onCheckedChange={(v) => setFlags({ ...flags, [f.key]: v })} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <SaveFooter>
              <Button disabled={update.isPending} onClick={() => update.mutate({ featureFlags: flags })}>
                <SaveIcon className={saveCls} /> Save flags
              </Button>
            </SaveFooter>
          </Card>
        </TabsContent>

        {/* ---------------- general */}
        <TabsContent value="general">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> General</CardTitle>
              <CardDescription>Identity and network settings for this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Name</Label><Input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Slug (login identifier)</Label><Input value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value.toLowerCase() })} disabled={tenant.isPlatformOwner} /></div>
                <div className="space-y-2"><Label>Domain</Label><Input value={general.domain} onChange={(e) => setGeneral({ ...general, domain: e.target.value })} placeholder="app.example.com" /></div>
                <div className="space-y-2"><Label>Allowed origins (comma separated)</Label><Input value={general.allowedOrigins} onChange={(e) => setGeneral({ ...general, allowedOrigins: e.target.value })} placeholder="https://example.com, https://www.example.com" /></div>
              </div>
            </CardContent>
            <SaveFooter>
              <Button disabled={update.isPending} onClick={() => update.mutate({
                name: general.name.trim(),
                slug: general.slug.trim() || undefined,
                domain: general.domain.trim(),
                allowedOrigins: general.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean),
              })}>
                <SaveIcon className={saveCls} /> Save
              </Button>
            </SaveFooter>
          </Card>
        </TabsContent>

        {/* ---------------- notes & audit */}
        <TabsContent value="notes">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-amber-500" /> Internal notes</CardTitle>
                <CardDescription>Only visible in the owner console.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contract details, contact person, escalations..." />
              </CardContent>
              <SaveFooter>
                <Button disabled={update.isPending} onClick={() => update.mutate({ internalNotes: notes })}><SaveIcon className={saveCls} /> Save notes</Button>
              </SaveFooter>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /> Recent audit entries</CardTitle>
                <CardDescription>Latest actions recorded for this tenant.</CardDescription>
              </CardHeader>
              <CardContent>
                {d.recentAudit?.length ? (
                  <ol className="relative ml-2 border-l border-border/70 pl-4 space-y-4">
                    {d.recentAudit.map((a: any) => (
                      <li key={a._id} className="relative">
                        <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card', a.status === 'failure' ? 'bg-rose-500' : 'bg-emerald-500')} />
                        <p className="font-mono text-xs font-medium">{a.action}</p>
                        <p className="text-xs text-muted-foreground">{a.details?.summary || a.details?.actorEmail || ''}{a.ip ? ` · ${a.ip}` : ''} · {timeAgo(a.createdAt)}</p>
                      </li>
                    ))}
                  </ol>
                ) : <EmptyState compact icon={ScrollText} title="No audit entries" description="Actions on this tenant will be listed here." />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- danger */}
        <TabsContent value="danger">
          <Card className="border-rose-500/40 overflow-hidden">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400"><Trash2 className="h-4 w-4" /></div>
              <div>
                <CardTitle className="text-rose-600 dark:text-rose-400">Delete tenant</CardTitle>
                <CardDescription className="mt-1">Soft delete keeps the data but disables every login and agent. Purge removes every document permanently.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete "{tenant.name}"</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* dialogs */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><Ban className="h-5 w-5" /> Suspend {tenant.name}?</DialogTitle>
            <DialogDescription>All sessions are revoked immediately. Users see the reason when they try to log in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label>Reason</Label><Textarea rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Payment overdue" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={suspend.isPending} onClick={() => suspend.mutate()}>{suspend.isPending ? 'Suspending…' : 'Suspend'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><Trash2 className="h-5 w-5" /> Delete {tenant.name}</DialogTitle>
            <DialogDescription>Type the slug <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.slug}</code> to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={tenant.slug} className="font-mono" />
            <label className={cn('flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-colors', purge ? 'border-rose-500/40 bg-rose-500/10' : 'bg-muted/30')}>
              <Checkbox checked={purge} onCheckedChange={(v) => setPurge(!!v)} className="mt-0.5" />
              <span>
                <span className="font-semibold">Purge permanently</span>
                <span className="block text-xs text-muted-foreground">Users, leads, conversations, messages, knowledge base, everything. Cannot be undone.</span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmSlug !== tenant.slug || deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : purge ? 'Purge tenant' : 'Soft delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-amber-500" /> Reset password</DialogTitle>
            <DialogDescription>{resetUser?.email} will be logged out of every device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label>New password (min 8)</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button disabled={newPassword.length < 8 || resetPassword.isPending} onClick={() => resetPassword.mutate({ userId: resetUser._id, password: newPassword })}>{resetPassword.isPending ? 'Resetting…' : 'Reset password'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
