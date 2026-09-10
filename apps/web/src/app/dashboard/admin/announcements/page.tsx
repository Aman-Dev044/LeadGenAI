'use client';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Megaphone,
  Send,
  Save,
  AlertTriangle,
  Info,
  AlertCircle,
  ExternalLink,
  Users,
  Layers,
  Mail,
  Clock,
  History,
  CheckCircle2,
  Sparkles,
  Eye,
  Radio,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/shared/loading';
import { ALL_ROLES, PLANS, PlanBadge } from '@/components/admin/admin-ui';
import { formatDate, cn } from '@/lib/utils';

const LEVELS = [
  { key: 'info', label: 'Informational', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: Info },
  { key: 'warning', label: 'Warning', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', icon: AlertTriangle },
  { key: 'critical', label: 'Critical / Outage', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', icon: AlertCircle },
];

const toLocalInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 16) : '');

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

  if (isLoading) return <Loading />;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const past: any[] = history?.data || [];

  const activeLevelObj = LEVELS.find((l) => l.key === banner.level) || LEVELS[0];
  const LevelIcon = activeLevelObj.icon;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Announcements & Broadcasts</h1>
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 bg-primary/5 text-primary">
              Live Comms
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish global dashboard alert banners and dispatch instant notifications or email broadcasts to tenant users.
          </p>
        </div>
      </div>

      {/* Main Grid: Banner Config + Broadcast Studio */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Platform-wide Banner */}
        <Card className="relative overflow-hidden border shadow-xs">
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Megaphone className="h-4 w-4 text-primary" /> Platform Header Banner
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  'font-semibold text-xs capitalize',
                  banner.enabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-muted bg-muted/40 text-muted-foreground'
                )}
              >
                {banner.enabled ? 'Live on Dashboards' : 'Disabled'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Rendered at the top of every tenant dashboard for all active users.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* Live Banner Preview Box */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-primary" /> Real-time Preview
                </span>
                <span>{banner.enabled ? 'Currently Visible' : 'Hidden'}</span>
              </div>

              <div
                className={cn(
                  'flex items-center justify-between rounded-md border px-3.5 py-2.5 text-xs transition-all shadow-2xs',
                  activeLevelObj.color
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LevelIcon className="h-4 w-4 shrink-0" />
                  <span className="font-medium truncate">
                    {banner.message || 'No announcement message specified yet.'}
                  </span>
                </div>
                {banner.link && (
                  <span className="inline-flex items-center gap-1 font-semibold underline text-[11px] shrink-0 ml-2">
                    Learn more <ExternalLink className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>

            {/* Banner Toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-card/70 p-3">
              <div>
                <p className="text-xs font-bold text-foreground">Enable Platform Banner</p>
                <p className="text-[11px] text-muted-foreground">Show this banner across all tenant sessions immediately.</p>
              </div>
              <Switch checked={banner.enabled} onCheckedChange={(v) => setBanner({ ...banner, enabled: v })} />
            </div>

            {/* Message Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Banner Message *</Label>
              <Textarea
                rows={3}
                value={banner.message}
                onChange={(e) => setBanner({ ...banner, message: e.target.value })}
                placeholder="e.g. Scheduled platform maintenance on Sunday from 02:00 to 03:00 IST."
                className="text-xs"
              />
            </div>

            {/* Severity Level & Link */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Severity / Style</Label>
                <Select value={banner.level} onValueChange={(v) => setBanner({ ...banner, level: v })}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l.key} value={l.key} className="text-xs capitalize">
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Action Link (Optional)</Label>
                <Input
                  value={banner.link}
                  onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                  placeholder="https://status.example.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Time Window */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Schedule Start (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={banner.startsAt}
                  onChange={(e) => setBanner({ ...banner, startsAt: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Schedule End (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={banner.endsAt}
                  onChange={(e) => setBanner({ ...banner, endsAt: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 border-t">
              <Button
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
                className="w-full font-semibold h-9 shadow-xs"
              >
                <Save className="mr-2 h-4 w-4" /> {saveBanner.isPending ? 'Saving Banner...' : 'Save & Publish Banner'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Broadcast Studio */}
        <Card className="relative overflow-hidden border shadow-xs">
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Send className="h-4 w-4 text-primary" /> One-Off Broadcast Studio
              </CardTitle>
              <Badge variant="outline" className="font-semibold text-xs border-primary/20 bg-primary/5 text-primary">
                Multi-Channel
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Dispatches instant in-app alerts (WebSockets) and optional email delivery to targeted user cohorts.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Broadcast Title *</Label>
              <Input
                value={bc.title}
                onChange={(e) => setBc({ ...bc, title: e.target.value })}
                placeholder="e.g. Major AI Model Upgrade Available Now"
                className="h-9 text-xs"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message Body *</Label>
              <Textarea
                rows={4}
                value={bc.body}
                onChange={(e) => setBc({ ...bc, body: e.target.value })}
                placeholder="Write your announcement details here..."
                className="text-xs"
              />
            </div>

            {/* Level & Link */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority Level</Label>
                <Select value={bc.level} onValueChange={(v) => setBc({ ...bc, level: v })}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l.key} value={l.key} className="text-xs capitalize">
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">External URL (Optional)</Label>
                <Input
                  value={bc.link}
                  onChange={(e) => setBc({ ...bc, link: e.target.value })}
                  placeholder="https://docs.example.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Target Roles Filter */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <Label className="text-xs font-bold block mb-2 text-foreground">Target Roles (None = All User Roles)</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => {
                  const isChecked = bc.roles.includes(r);
                  return (
                    <label
                      key={r}
                      onClick={() => setBc({ ...bc, roles: toggle(bc.roles, r) })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors',
                        isChecked ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <Checkbox checked={isChecked} className="hidden" />
                      <span>{r}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Target Plans Filter */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <Label className="text-xs font-bold block mb-2 text-foreground">Target Subscription Plans (None = All Plans)</Label>
              <div className="flex flex-wrap gap-2">
                {PLANS.map((p) => {
                  const isChecked = bc.plans.includes(p);
                  return (
                    <label
                      key={p}
                      onClick={() => setBc({ ...bc, plans: toggle(bc.plans, p) })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer capitalize transition-colors',
                        isChecked ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <Checkbox checked={isChecked} className="hidden" />
                      <span>{p}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Email Dispatch Toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-card/70 p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">Dispatch via Email Too</p>
                  <p className="text-[11px] text-muted-foreground">Delivers an email message in addition to the real-time in-app notification.</p>
                </div>
              </div>
              <Switch checked={bc.sendEmail} onCheckedChange={(v) => setBc({ ...bc, sendEmail: !!v })} />
            </div>

            {/* Send Button */}
            <div className="pt-2 border-t">
              <Button
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
                className="w-full font-semibold h-9 shadow-xs"
              >
                <Send className="mr-2 h-4 w-4" /> {send.isPending ? 'Sending Broadcast...' : 'Dispatch Broadcast Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Broadcasts Log */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-4 w-4 text-primary" /> Broadcast History ({past.length})
            </CardTitle>
            <span className="text-xs text-muted-foreground">Historical records of all dispatched announcements</span>
          </div>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
              No historical broadcasts have been recorded on the platform yet.
            </div>
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {past.map((b) => (
                <div key={b._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-foreground">{b.details?.title}</p>
                      <Badge
                        variant={
                          b.details?.level === 'critical'
                            ? 'destructive'
                            : b.details?.level === 'warning'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[10px] capitalize font-semibold"
                      >
                        {b.details?.level || 'info'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{b.details?.body}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(b.createdAt)}</span>
                      <span>·</span>
                      <span>Dispatched by {b.details?.actorEmail}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Badge variant="outline" className="font-bold text-xs bg-muted/40">
                      {b.details?.recipients || 0} Recipients
                    </Badge>
                    {b.details?.emailsSent && (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        +{b.details.emailsSent} Emails
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
