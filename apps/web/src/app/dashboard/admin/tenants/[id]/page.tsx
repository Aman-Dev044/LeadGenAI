'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, UserCog, Ban, CheckCircle2, Trash2, Save, Users, Bot, MessageSquare, Cpu, KeyRound, LogOut } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { PLANS, TENANT_STATUSES, PlanBadge, StatusBadge, RoleBadge, UsageBar, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { impersonateTenant } from '@/lib/impersonation';
import { formatDate } from '@/lib/utils';

const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: 'maxAgents', label: 'Max agents' },
  { key: 'maxLeads', label: 'Max leads' },
  { key: 'maxConversationsPerMonth', label: 'Conversations / month' },
  { key: 'maxKnowledgeSources', label: 'Knowledge sources' },
  { key: 'maxUsers', label: 'Max users' },
];

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

  if (isLoading || !tenant) return <Loading />;

  const usage = d.usage || {};
  const counts = d.counts || {};
  const known: any[] = d.knownFeatureFlags || [];
  const effective: Record<string, boolean> = d.effectiveFeatureFlags || {};

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push('/dashboard/admin/tenants')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> All tenants
      </Button>
      <PageHeader
        title={tenant.name}
        description={`/${tenant.slug}${tenant.domain ? ` · ${tenant.domain}` : ''} · created ${formatDate(tenant.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PlanBadge plan={tenant.plan} />
            <StatusBadge status={tenant.status} />
            {tenant.isPlatformOwner && <Badge variant="warning">Owner workspace</Badge>}
            {!tenant.isPlatformOwner && (
              <Button variant="outline" onClick={() => impersonateTenant(tenant._id)}><UserCog className="mr-2 h-4 w-4" /> Log in as tenant</Button>
            )}
            {!tenant.isPlatformOwner && tenant.status !== 'suspended' && (
              <Button variant="outline" className="text-destructive" onClick={() => setSuspendOpen(true)}><Ban className="mr-2 h-4 w-4" /> Suspend</Button>
            )}
            {(tenant.status === 'suspended' || tenant.status === 'cancelled') && (
              <Button variant="outline" className="text-emerald-600" onClick={() => activate.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" /> Activate</Button>
            )}
          </div>
        }
      />

      {tenant.status === 'suspended' && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Suspended {tenant.suspendedAt ? formatDate(tenant.suspendedAt) : ''}{tenant.suspendedReason ? ` — ${tenant.suspendedReason}` : ''}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Users" value={counts.users || 0} icon={Users} description={`${counts.agents || 0} agents`} />
        <StatCard title="Leads" value={formatNumber(counts.leads)} icon={Users} description={`+${usage.leads || 0} this month`} />
        <StatCard title="Conversations" value={formatNumber(counts.conversations)} icon={MessageSquare} description={`${usage.conversations || 0} this month · ${formatNumber(counts.messages)} messages`} />
        <StatCard title="AI tokens" value={formatNumber(usage.aiTokensThisMonth)} icon={Cpu} description={`${formatNumber(usage.aiTokensTotal)} all time`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users ({d.users?.length || 0})</TabsTrigger>
          <TabsTrigger value="plan">Plan & limits</TabsTrigger>
          <TabsTrigger value="flags">Feature flags</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notes">Notes & audit</TabsTrigger>
          {!tenant.isPlatformOwner && <TabsTrigger value="danger" className="text-destructive">Danger zone</TabsTrigger>}
        </TabsList>

        {/* ---------------- overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Usage vs limits</CardTitle><CardDescription>Period {usage.period}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <UsageBar label="Conversations this month" used={usage.conversations || 0} limit={usage.limits?.maxConversationsPerMonth} />
                <UsageBar label="Leads (total)" used={counts.leads || 0} limit={usage.limits?.maxLeads} />
                <UsageBar label="Users" used={counts.users || 0} limit={usage.limits?.maxUsers} />
                <UsageBar label="Agents" used={counts.agents || 0} limit={usage.limits?.maxAgents} />
                <UsageBar label="Knowledge sources" used={counts.knowledgeSources || 0} limit={usage.limits?.maxKnowledgeSources} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent leads</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.recentLeads?.length ? d.recentLeads.map((l: any) => (
                  <div key={l._id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{[l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed'}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.email || l.phone || '—'} · {l.source || 'unknown'} · {timeAgo(l.createdAt)}</p>
                    </div>
                    <Badge variant={l.temperature === 'hot' ? 'destructive' : l.temperature === 'warm' ? 'warning' : 'secondary'}>{l.score ?? 0}</Badge>
                  </div>
                )) : <p className="text-muted-foreground">No leads yet.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Agents & conversations</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {d.agents?.length ? d.agents.map((a: any) => (
                  <div key={a._id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> {a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.aiConfig?.provider}/{a.aiConfig?.model} · <Badge variant={a.status === 'active' ? 'success' : 'secondary'}>{a.status}</Badge></span>
                  </div>
                )) : <p className="text-muted-foreground">No agents configured.</p>}
                <div className="border-t pt-3 space-y-1">
                  {d.recentConversations?.map((c: any) => (
                    <p key={c._id} className="text-xs text-muted-foreground">{timeAgo(c.createdAt)} · {c.status} · {c.mode} · {c.messageCount || 0} msgs</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- users */}
        <TabsContent value="users">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead><TableHead>Last login</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.users?.map((u: any) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell>
                        <Switch checked={!!u.isActive} disabled={u.role === 'SUPER_ADMIN'} onCheckedChange={(v) => updateUser.mutate({ userId: u._id, body: { isActive: v } })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {u.role !== 'SUPER_ADMIN' && <Button size="sm" variant="outline" title="Log in as this user" onClick={() => impersonateTenant(tenant._id, u._id)}><UserCog className="h-3 w-3" /></Button>}
                          <Button size="sm" variant="outline" title="Reset password" onClick={() => setResetUser(u)}><KeyRound className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" title="Force logout" onClick={() => forceLogout.mutate(u._id)}><LogOut className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- plan & limits */}
        <TabsContent value="plan">
          <Card>
            <CardHeader><CardTitle>Plan, status & limits</CardTitle><CardDescription>Changing the plan applies that plan's default limits unless you edit them below.</CardDescription></CardHeader>
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
              <div className="grid gap-4 md:grid-cols-5">
                {LIMIT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label className="text-xs">{f.label}</Label>
                    <Input type="number" min={0} value={planForm.limits?.[f.key] ?? ''} onChange={(e) => setPlanForm({ ...planForm, limits: { ...planForm.limits, [f.key]: Number(e.target.value) } })} />
                  </div>
                ))}
              </div>
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
                <Save className="mr-2 h-4 w-4" /> Save plan & limits
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- feature flags */}
        <TabsContent value="flags">
          <Card>
            <CardHeader><CardTitle>Feature flags</CardTitle><CardDescription>Per-tenant overrides. Unset flags inherit the platform default (shown in grey).</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {known.map((f) => {
                const overridden = flags[f.key] !== undefined;
                const value = overridden ? flags[f.key] : effective[f.key];
                return (
                  <div key={f.key} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium text-sm">{f.label} {!overridden && <span className="ml-2 text-[10px] uppercase text-muted-foreground">inherited</span>}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {overridden && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const n = { ...flags }; delete n[f.key]; setFlags(n); }}>reset</Button>
                      )}
                      <Switch checked={!!value} onCheckedChange={(v) => setFlags({ ...flags, [f.key]: v })} />
                    </div>
                  </div>
                );
              })}
              <Button disabled={update.isPending} onClick={() => update.mutate({ featureFlags: flags })}>
                <Save className="mr-2 h-4 w-4" /> Save flags
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- general */}
        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Name</Label><Input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Slug (login identifier)</Label><Input value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value.toLowerCase() })} disabled={tenant.isPlatformOwner} /></div>
                <div className="space-y-2"><Label>Domain</Label><Input value={general.domain} onChange={(e) => setGeneral({ ...general, domain: e.target.value })} /></div>
                <div className="space-y-2"><Label>Allowed origins (comma separated)</Label><Input value={general.allowedOrigins} onChange={(e) => setGeneral({ ...general, allowedOrigins: e.target.value })} /></div>
              </div>
              <Button disabled={update.isPending} onClick={() => update.mutate({
                name: general.name.trim(),
                slug: general.slug.trim() || undefined,
                domain: general.domain.trim(),
                allowedOrigins: general.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean),
              })}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- notes & audit */}
        <TabsContent value="notes">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Internal notes</CardTitle><CardDescription>Only visible in the owner console.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contract details, contact person, escalations..." />
                <Button disabled={update.isPending} onClick={() => update.mutate({ internalNotes: notes })}><Save className="mr-2 h-4 w-4" /> Save notes</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent audit entries</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.recentAudit?.length ? d.recentAudit.map((a: any) => (
                  <div key={a._id} className="border-b pb-2 last:border-0">
                    <p className="font-mono text-xs">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.details?.summary || a.details?.actorEmail || ''} · {a.ip || ''} · {timeAgo(a.createdAt)} · <span className={a.status === 'failure' ? 'text-destructive' : ''}>{a.status}</span></p>
                  </div>
                )) : <p className="text-muted-foreground">No audit entries.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- danger */}
        <TabsContent value="danger">
          <Card className="border-destructive/40">
            <CardHeader><CardTitle className="text-destructive">Delete tenant</CardTitle><CardDescription>Soft delete keeps the data but disables every login and agent. Purge removes every document permanently.</CardDescription></CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete "{tenant.name}"</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* dialogs */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspend {tenant.name}?</DialogTitle><DialogDescription>All sessions are revoked immediately.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>Reason</Label><Textarea rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={suspend.isPending} onClick={() => suspend.mutate()}>Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {tenant.name}</DialogTitle>
            <DialogDescription>Type the slug <code className="rounded bg-muted px-1">{tenant.slug}</code> to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={tenant.slug} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={purge} onCheckedChange={(v) => setPurge(!!v)} />
              Purge permanently (users, leads, conversations, messages, knowledge base, everything). Cannot be undone.
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmSlug !== tenant.slug || deleting} onClick={handleDelete}>
              {purge ? 'Purge tenant' : 'Soft delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password for {resetUser?.email}</DialogTitle><DialogDescription>The user is logged out of every device.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>New password (min 8)</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button disabled={newPassword.length < 8 || resetPassword.isPending} onClick={() => resetPassword.mutate({ userId: resetUser._id, password: newPassword })}>Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
