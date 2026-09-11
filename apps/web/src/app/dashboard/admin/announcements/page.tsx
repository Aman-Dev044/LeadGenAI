'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Megaphone, Send, Save, AlertTriangle, Info, AlertCircle, ExternalLink, Users, Mail, Clock, History, Eye, Layers, ShieldAlert, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/shared/loading';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ALL_ROLES, PLANS } from '@/components/admin/admin-ui';
import { formatDate, cn } from '@/lib/utils';

/** Level styles: chip colour for pickers + the exact gradient strip the real PlatformBanner uses. */
const LEVELS = [
  { key: 'info', label: 'Informational', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30', strip: 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white', icon: Info },
  { key: 'warning', label: 'Warning', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', strip: 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900', icon: AlertTriangle },
  { key: 'critical', label: 'Critical / Outage', chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30', strip: 'bg-gradient-to-r from-rose-600 to-red-600 text-white', icon: ShieldAlert },
];

const toLocalInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 16) : '');

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all cursor-pointer',
        active ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<any>('/admin/settings'),
  });
  const { data: history } = useQuery({
    queryKey: ['admin', 'broadcasts'],
    queryFn: () => api.get<any>('/admin/broadcasts'),
  });

  const [banner, setBanner] = useState({
    enabled: false,
    message: '',
    level: 'info',
    link: '',
    startsAt: '',
    endsAt: '',
  });

  const [bc, setBc] = useState({
    title: '',
    body: '',
    level: 'info',
    link: '',
    roles: [] as string[],
    plans: [] as string[],
    sendEmail: false,
  });

  useEffect(() => {
    const a = data?.data?.announcement;
    if (a) {
      setBanner({
        enabled: !!a.enabled,
        message: a.message || '',
        level: a.level || 'info',
        link: a.link || '',
        startsAt: toLocalInput(a.startsAt),
        endsAt: toLocalInput(a.endsAt),
      });
    }
  }, [data]);

  const saveBanner = useMutation({
    mutationFn: (body: any) => api.patch('/admin/settings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'status'] });
      toast.success('Platform banner updated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const send = useMutation({
    mutationFn: (body: any) => api.post('/admin/broadcasts', body),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      setBc({ title: '', body: '', level: 'info', link: '', roles: [], plans: [], sendEmail: false });
      toast.success(
        `Broadcast sent to ${res?.data?.recipients ?? 0} users across ${res?.data?.tenants ?? 0} workspaces${
          res?.data?.emails ? ` (+${res.data.emails} emails dispatched)` : ''
        }`
      );
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <Loading label="Loading announcements" />;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const past: any[] = history?.data || [];

  const activeLevelObj = LEVELS.find((l) => l.key === banner.level) || LEVELS[0];
  const LevelIcon = activeLevelObj.icon;
  const bcLevelObj = LEVELS.find((l) => l.key === bc.level) || LEVELS[0];

  const audience = [
    bc.roles.length ? `${bc.roles.length} role${bc.roles.length > 1 ? 's' : ''}` : 'all roles',
    bc.plans.length ? `${bc.plans.length} plan${bc.plans.length > 1 ? 's' : ''}` : 'all plans',
  ].join(' · ');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner console"
        icon={Megaphone}
        title="Announcements"
        description="Publish a global dashboard banner and dispatch in-app or email broadcasts to tenant users."
        actions={<Badge variant={banner.enabled ? 'success' : 'secondary'} dot className="h-8 px-3">{banner.enabled ? 'Banner live' : 'Banner off'}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Banner editor */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></div>
              <div>
                <CardTitle>Platform banner</CardTitle>
                <CardDescription className="mt-1">Rendered above the header of every tenant dashboard.</CardDescription>
              </div>
            </div>
            <Badge variant={banner.enabled ? 'success' : 'secondary'} dot>{banner.enabled ? 'Live' : 'Disabled'}</Badge>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Live preview - same styling as the real strip */}
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-primary" /> Live preview</span>
                <span>{banner.enabled ? 'Visible to tenants' : 'Hidden'}</span>
              </div>
              <div className={cn('flex items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-sm transition-all', activeLevelObj.strip, !banner.enabled && 'opacity-50 grayscale-[30%]')}>
                <LevelIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{banner.message || 'Your announcement message will appear here.'}</span>
                {banner.link && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs underline underline-offset-2">
                    <Info className="h-3 w-3" /> Learn more
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">Enable banner</p>
                <p className="text-xs text-muted-foreground">Show across all tenant sessions immediately.</p>
              </div>
              <Switch checked={banner.enabled} onCheckedChange={(v) => setBanner({ ...banner, enabled: v })} />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                rows={3}
                value={banner.message}
                onChange={(e) => setBanner({ ...banner, message: e.target.value })}
                placeholder="e.g. Scheduled platform maintenance on Sunday from 02:00 to 03:00 IST."
              />
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((l) => {
                  const Icon = l.icon;
                  const active = banner.level === l.key;
                  return (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => setBanner({ ...banner, level: l.key })}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer',
                        active ? cn(l.chip, 'shadow-sm') : 'bg-card text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{l.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Action link (optional)</Label>
                <Input value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} placeholder="https://status.example.com" />
              </div>
              <div className="space-y-2">
                <Label>Schedule start (optional)</Label>
                <Input type="datetime-local" value={banner.startsAt} onChange={(e) => setBanner({ ...banner, startsAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Schedule end (optional)</Label>
                <Input type="datetime-local" value={banner.endsAt} onChange={(e) => setBanner({ ...banner, endsAt: e.target.value })} />
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-end border-t bg-muted/30 px-6 py-3">
            <Button
              variant="gradient"
              disabled={saveBanner.isPending}
              onClick={() =>
                saveBanner.mutate({
                  announcement: {
                    enabled: banner.enabled,
                    message: banner.message,
                    level: banner.level,
                    link: banner.link,
                    ...(banner.startsAt ? { startsAt: new Date(banner.startsAt).toISOString() } : {}),
                    ...(banner.endsAt ? { endsAt: new Date(banner.endsAt).toISOString() } : {}),
                  },
                })
              }
            >
              {saveBanner.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveBanner.isPending ? 'Saving…' : 'Save & publish banner'}
            </Button>
          </CardFooter>
        </Card>

        {/* Broadcast */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><Send className="h-4 w-4" /></div>
              <div>
                <CardTitle>One-off broadcast</CardTitle>
                <CardDescription className="mt-1">Instant in-app notification, with optional email delivery, to a targeted audience.</CardDescription>
              </div>
            </div>
            <Badge variant="violet">Multi-channel</Badge>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} placeholder="e.g. Major AI model upgrade available now" />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea rows={4} value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} placeholder="Write your announcement details here…" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={bc.level} onValueChange={(v) => setBc({ ...bc, level: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>External URL (optional)</Label>
                <Input value={bc.link} onChange={(e) => setBc({ ...bc, link: e.target.value })} placeholder="https://docs.example.com" />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" /> Audience</p>
                <Badge variant="secondary">{audience}</Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Roles <span className="font-normal">(none = all)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => {
                    const isChecked = bc.roles.includes(r);
                    return (
                      <ChipToggle key={r} active={isChecked} onClick={() => setBc({ ...bc, roles: toggle(bc.roles, r) })}>
                        <Checkbox checked={isChecked} className="hidden" />
                        {r.toLowerCase().replace('_', ' ')}
                      </ChipToggle>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Plans <span className="font-normal">(none = all)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {PLANS.map((p) => {
                    const isChecked = bc.plans.includes(p);
                    return (
                      <ChipToggle key={p} active={isChecked} onClick={() => setBc({ ...bc, plans: toggle(bc.plans, p) })}>
                        <Checkbox checked={isChecked} className="hidden" />
                        {p}
                      </ChipToggle>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-semibold">Also send by email</p>
                  <p className="text-xs text-muted-foreground">Delivers an email in addition to the in-app notification.</p>
                </div>
              </div>
              <Switch checked={bc.sendEmail} onCheckedChange={(v) => setBc({ ...bc, sendEmail: !!v })} />
            </div>
          </CardContent>

          <CardFooter className="items-center justify-between border-t bg-muted/30 px-6 py-3">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', bcLevelObj.chip)}>
              <bcLevelObj.icon className="h-3 w-3" /> {bcLevelObj.label}
            </span>
            <Button
              variant="gradient"
              disabled={send.isPending || !bc.title.trim() || !bc.body.trim()}
              onClick={() =>
                send.mutate({
                  title: bc.title.trim(),
                  body: bc.body.trim(),
                  level: bc.level,
                  link: bc.link || undefined,
                  roles: bc.roles.length ? bc.roles : undefined,
                  plans: bc.plans.length ? bc.plans : undefined,
                  sendEmail: bc.sendEmail,
                })
              }
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {send.isPending ? 'Sending…' : 'Dispatch broadcast'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Broadcast history</CardTitle>
            <CardDescription>Every announcement dispatched from the owner console.</CardDescription>
          </div>
          <Badge variant="secondary" className="tabular">{past.length}</Badge>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <EmptyState compact icon={Megaphone} title="No broadcasts yet" description="Dispatch your first announcement from the studio above." />
          ) : (
            <div className="divide-y rounded-xl border">
              {past.map((b) => {
                const lvl = LEVELS.find((l) => l.key === (b.details?.level || 'info')) || LEVELS[0];
                const Icon = lvl.icon;
                return (
                  <div key={b._id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-primary/[0.03] sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', lvl.chip)}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{b.details?.title}</p>
                          <Badge variant={b.details?.level === 'critical' ? 'destructive' : b.details?.level === 'warning' ? 'warning' : 'info'}>{b.details?.level || 'info'}</Badge>
                        </div>
                        <p className="max-w-2xl text-xs text-muted-foreground line-clamp-2">{b.details?.body}</p>
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {formatDate(b.createdAt)} · by {b.details?.actorEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      <Badge variant="outline" className="tabular"><Users className="h-3 w-3" /> {b.details?.recipients || 0}</Badge>
                      {b.details?.emailsSent && <Badge variant="default" className="tabular"><Mail className="h-3 w-3" /> +{b.details.emailsSent}</Badge>}
                      {b.details?.link && (
                        <a href={b.details.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
