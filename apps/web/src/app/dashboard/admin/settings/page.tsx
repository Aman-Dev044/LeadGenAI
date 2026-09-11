'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Wrench, UserPlus, Flag, Gauge, Ban, SlidersHorizontal, Palette, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { PLANS, PlanBadge } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: 'maxAgents', label: 'Agents' },
  { key: 'maxLeads', label: 'Leads' },
  { key: 'maxConversationsPerMonth', label: 'Conversations / month' },
  { key: 'maxKnowledgeSources', label: 'Knowledge sources' },
  { key: 'maxUsers', label: 'Users' },
];

function SectionHeader({ icon: Icon, title, description, tone = 'primary', badge }: { icon: any; title: string; description?: string; tone?: 'primary' | 'danger' | 'success'; badge?: React.ReactNode }) {
  const tile = tone === 'danger' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : tone === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary';
  return (
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tile)}><Icon className="h-4 w-4" /></div>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
      </div>
      {badge}
    </CardHeader>
  );
}

function SaveFooter({ children }: { children: React.ReactNode }) {
  return <CardFooter className="justify-end gap-2 border-t bg-muted/30 px-6 py-3 rounded-b-xl">{children}</CardFooter>;
}

export default function AdminPlatformSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<any>('/admin/settings') });
  const s = data?.data;

  const [general, setGeneral] = useState({ platformName: '', supportEmail: '' });
  const [access, setAccess] = useState({ maintenanceMode: false, maintenanceMessage: '', signupEnabled: true, defaultPlan: 'free', trialDays: '14' });
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, Record<string, number>>>({});
  const [reserved, setReserved] = useState('');

  useEffect(() => {
    if (!s) return;
    setGeneral({ platformName: s.platformName || '', supportEmail: s.supportEmail || '' });
    setAccess({ maintenanceMode: !!s.maintenanceMode, maintenanceMessage: s.maintenanceMessage || '', signupEnabled: s.signupEnabled !== false, defaultPlan: s.defaultPlan || 'free', trialDays: String(s.trialDays ?? 14) });
    setFlags({ ...(s.featureFlags || {}) });
    setLimits(JSON.parse(JSON.stringify(s.planLimits || {})));
    setReserved((s.reservedSlugs || []).join(', '));
  }, [s]);

  const save = useMutation({
    mutationFn: (body: any) => api.patch('/admin/settings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'status'] });
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading || !s) return <Loading label="Loading platform settings" />;
  const known: any[] = s.knownFeatureFlags || [];
  const reservedChips = reserved.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const SaveIcon = save.isPending ? Loader2 : Save;

  return (
    <div>
      <PageHeader
        eyebrow="Owner console"
        icon={SlidersHorizontal}
        title="Platform settings"
        description="Global switches that apply to every tenant"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={access.maintenanceMode ? 'destructive' : 'success'} dot>{access.maintenanceMode ? 'Maintenance ON' : 'Serving normally'}</Badge>
            <Badge variant={access.signupEnabled ? 'success' : 'secondary'} dot>{access.signupEnabled ? 'Signup open' : 'Signup closed'}</Badge>
          </div>
        }
      />

      <Tabs defaultValue="access">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="access"><ShieldCheck className="h-4 w-4" /> Access & signup</TabsTrigger>
          <TabsTrigger value="flags"><Flag className="h-4 w-4" /> Feature flags</TabsTrigger>
          <TabsTrigger value="limits"><Gauge className="h-4 w-4" /> Plan limits</TabsTrigger>
          <TabsTrigger value="general"><Palette className="h-4 w-4" /> General</TabsTrigger>
        </TabsList>

        {/* ---------------- access */}
        <TabsContent value="access" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={cn('overflow-hidden transition-colors', access.maintenanceMode && 'border-rose-500/50 shadow-[0_0_0_4px_rgb(244_63_94_/_0.08)]')}>
              <SectionHeader
                icon={Wrench}
                tone={access.maintenanceMode ? 'danger' : 'primary'}
                title="Maintenance mode"
                description="Blocks every login and API call from tenant users (503). Platform owners keep full access. The chat widget keeps working."
              />
              <CardContent className="space-y-4">
                <div className={cn('flex items-center justify-between rounded-xl border p-4 transition-colors', access.maintenanceMode ? 'border-rose-500/40 bg-rose-500/10' : 'bg-muted/30')}>
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', access.maintenanceMode ? 'bg-rose-500 text-white' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}>
                      {access.maintenanceMode ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className={cn('text-sm font-semibold', access.maintenanceMode && 'text-rose-600 dark:text-rose-400')}>
                        Maintenance mode is {access.maintenanceMode ? 'ON' : 'off'}
                      </p>
                      <p className="text-xs text-muted-foreground">{access.maintenanceMode ? 'Tenant traffic is currently blocked.' : 'All tenants are being served.'}</p>
                    </div>
                  </div>
                  <Switch checked={access.maintenanceMode} onCheckedChange={(v) => setAccess({ ...access, maintenanceMode: v })} className="data-[state=checked]:bg-rose-500" />
                </div>
                <div className="space-y-2">
                  <Label>Message shown to users</Label>
                  <Textarea rows={3} value={access.maintenanceMessage} onChange={(e) => setAccess({ ...access, maintenanceMessage: e.target.value })} placeholder="We are performing scheduled maintenance. Back shortly." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <SectionHeader icon={UserPlus} tone="success" title="Self-service signup" description="Controls the public /auth/register flow and the defaults for new workspaces." />
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                  <div>
                    <p className="text-sm font-semibold">Signup {access.signupEnabled ? 'open' : 'closed'}</p>
                    <p className="text-xs text-muted-foreground">{access.signupEnabled ? 'Anyone can create a workspace.' : 'Only owners can create workspaces.'}</p>
                  </div>
                  <Switch checked={access.signupEnabled} onCheckedChange={(v) => setAccess({ ...access, signupEnabled: v })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default plan</Label>
                    <Select value={access.defaultPlan} onValueChange={(v) => setAccess({ ...access, defaultPlan: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Trial days</Label>
                    <Input type="number" min={0} value={access.trialDays} onChange={(e) => setAccess({ ...access, trialDays: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button variant="gradient" disabled={save.isPending} onClick={() => save.mutate({ ...access, trialDays: Number(access.trialDays) || 0 })}>
              <SaveIcon className={cn('h-4 w-4', save.isPending && 'animate-spin')} /> Save access settings
            </Button>
          </div>
        </TabsContent>

        {/* ---------------- flags */}
        <TabsContent value="flags">
          <Card className="overflow-hidden">
            <SectionHeader
              icon={Flag}
              title="Global feature flags"
              description="Defaults for every tenant. A tenant's own overrides (set on its detail page) win over these."
              badge={<Badge variant="secondary" className="tabular">{known.filter((f) => flags[f.key] ?? f.default).length} / {known.length} on</Badge>}
            />
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {known.map((f) => {
                  const on = flags[f.key] ?? f.default;
                  return (
                    <div key={f.key} className={cn('flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors', on ? 'border-primary/30 bg-primary/[0.04]' : 'bg-muted/20')}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{f.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                        <code className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{f.key}</code>
                      </div>
                      <Switch checked={on} onCheckedChange={(v) => setFlags({ ...flags, [f.key]: v })} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <SaveFooter>
              <Button disabled={save.isPending} onClick={() => save.mutate({ featureFlags: flags })}>
                <SaveIcon className={cn('h-4 w-4', save.isPending && 'animate-spin')} /> Save flags
              </Button>
            </SaveFooter>
          </Card>
        </TabsContent>

        {/* ---------------- limits */}
        <TabsContent value="limits">
          <Card className="overflow-hidden">
            <SectionHeader icon={Gauge} title="Plan limits" description="Applied when a tenant is created or its plan changes. Existing tenants keep their current limits until edited." />
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Plan</th>
                      {LIMIT_FIELDS.map((f) => <th key={f.key} className="px-4 py-3">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PLANS.map((p) => (
                      <tr key={p} className="border-b last:border-0 transition-colors hover:bg-primary/[0.03]">
                        <td className="px-4 py-3"><PlanBadge plan={p} /></td>
                        {LIMIT_FIELDS.map((f) => (
                          <td key={f.key} className="px-4 py-3">
                            <Input type="number" min={0} className="h-9 w-[130px] tabular" value={limits[p]?.[f.key] ?? ''} onChange={(e) => setLimits({ ...limits, [p]: { ...(limits[p] || {}), [f.key]: Number(e.target.value) } })} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <SaveFooter>
              <Button disabled={save.isPending} onClick={() => save.mutate({ planLimits: limits })}>
                <SaveIcon className={cn('h-4 w-4', save.isPending && 'animate-spin')} /> Save limits
              </Button>
            </SaveFooter>
          </Card>
        </TabsContent>

        {/* ---------------- general */}
        <TabsContent value="general">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <SectionHeader icon={Palette} title="Branding" description="Name and support contact shown in emails and the dashboard." />
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Platform name</Label><Input value={general.platformName} onChange={(e) => setGeneral({ ...general, platformName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Support email</Label><Input type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} /></div>
              </CardContent>
              <SaveFooter>
                <Button disabled={save.isPending} onClick={() => save.mutate(general)}>
                  <SaveIcon className={cn('h-4 w-4', save.isPending && 'animate-spin')} /> Save
                </Button>
              </SaveFooter>
            </Card>
            <Card className="overflow-hidden">
              <SectionHeader icon={Ban} tone="danger" title="Reserved slugs" description="Organization slugs nobody can register (comma separated)." badge={<Badge variant="secondary" className="tabular">{reservedChips.length}</Badge>} />
              <CardContent className="space-y-3">
                <Textarea rows={4} value={reserved} onChange={(e) => setReserved(e.target.value)} placeholder="admin, api, www, owner" />
                {reservedChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reservedChips.map((c) => (
                      <span key={c} className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 font-mono text-[11px]">/{c}</span>
                    ))}
                  </div>
                )}
              </CardContent>
              <SaveFooter>
                <Button disabled={save.isPending} onClick={() => save.mutate({ reservedSlugs: reserved.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })}>
                  <SaveIcon className={cn('h-4 w-4', save.isPending && 'animate-spin')} /> Save
                </Button>
              </SaveFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
