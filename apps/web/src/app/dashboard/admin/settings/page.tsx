'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Wrench, UserPlus, Flag, Gauge, Ban } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { PLANS, PlanBadge } from '@/components/admin/admin-ui';

const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: 'maxAgents', label: 'Agents' },
  { key: 'maxLeads', label: 'Leads' },
  { key: 'maxConversationsPerMonth', label: 'Conversations / month' },
  { key: 'maxKnowledgeSources', label: 'Knowledge sources' },
  { key: 'maxUsers', label: 'Users' },
];

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

  if (isLoading || !s) return <Loading />;
  const known: any[] = s.knownFeatureFlags || [];

  return (
    <div>
      <PageHeader title="Platform settings" description="Global switches that apply to every tenant" />

      <Tabs defaultValue="access">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="access">Access & signup</TabsTrigger>
          <TabsTrigger value="flags">Feature flags</TabsTrigger>
          <TabsTrigger value="limits">Plan limits</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={access.maintenanceMode ? 'border-orange-500/60' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Maintenance mode</CardTitle>
                <CardDescription>Blocks every login and API call from tenant users (503). Platform owners keep full access. The chat widget keeps working.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm font-medium">Maintenance mode is {access.maintenanceMode ? 'ON' : 'off'}</p>
                  <Switch checked={access.maintenanceMode} onCheckedChange={(v) => setAccess({ ...access, maintenanceMode: v })} />
                </div>
                <div className="space-y-2"><Label>Message shown to users</Label><Textarea rows={3} value={access.maintenanceMessage} onChange={(e) => setAccess({ ...access, maintenanceMessage: e.target.value })} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Self-service signup</CardTitle>
                <CardDescription>Controls the public /auth/register flow and the defaults for new workspaces.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm font-medium">Signup {access.signupEnabled ? 'open' : 'closed'}</p>
                  <Switch checked={access.signupEnabled} onCheckedChange={(v) => setAccess({ ...access, signupEnabled: v })} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default plan</Label>
                    <Select value={access.defaultPlan} onValueChange={(v) => setAccess({ ...access, defaultPlan: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Trial days</Label><Input type="number" min={0} value={access.trialDays} onChange={(e) => setAccess({ ...access, trialDays: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Button className="mt-4" disabled={save.isPending} onClick={() => save.mutate({ ...access, trialDays: Number(access.trialDays) || 0 })}>
            <Save className="mr-2 h-4 w-4" /> Save access settings
          </Button>
        </TabsContent>

        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> Global feature flags</CardTitle>
              <CardDescription>Defaults for every tenant. A tenant's own overrides (set on its detail page) win over these.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {known.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-md border p-3">
                  <div><p className="text-sm font-medium">{f.label} <code className="ml-2 rounded bg-muted px-1 text-[10px]">{f.key}</code></p><p className="text-xs text-muted-foreground">{f.description}</p></div>
                  <Switch checked={flags[f.key] ?? f.default} onCheckedChange={(v) => setFlags({ ...flags, [f.key]: v })} />
                </div>
              ))}
              <Button disabled={save.isPending} onClick={() => save.mutate({ featureFlags: flags })}><Save className="mr-2 h-4 w-4" /> Save flags</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4" /> Plan limits</CardTitle>
              <CardDescription>Applied when a tenant is created or its plan changes. Existing tenants keep their current limits until edited.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Plan</th>
                      {LIMIT_FIELDS.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PLANS.map((p) => (
                      <tr key={p} className="border-b last:border-0">
                        <td className="py-2 pr-4"><PlanBadge plan={p} /></td>
                        {LIMIT_FIELDS.map((f) => (
                          <td key={f.key} className="py-2 pr-4">
                            <Input type="number" min={0} className="w-[130px]" value={limits[p]?.[f.key] ?? ''} onChange={(e) => setLimits({ ...limits, [p]: { ...(limits[p] || {}), [f.key]: Number(e.target.value) } })} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button disabled={save.isPending} onClick={() => save.mutate({ planLimits: limits })}><Save className="mr-2 h-4 w-4" /> Save limits</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Platform name</Label><Input value={general.platformName} onChange={(e) => setGeneral({ ...general, platformName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Support email</Label><Input type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} /></div>
                <Button disabled={save.isPending} onClick={() => save.mutate(general)}><Save className="mr-2 h-4 w-4" /> Save</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ban className="h-4 w-4" /> Reserved slugs</CardTitle>
                <CardDescription>Organization slugs nobody can register (comma separated).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea rows={4} value={reserved} onChange={(e) => setReserved(e.target.value)} />
                <Button disabled={save.isPending} onClick={() => save.mutate({ reservedSlugs: reserved.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })}><Save className="mr-2 h-4 w-4" /> Save</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
