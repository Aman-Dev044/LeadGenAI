'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Radio, Plus, AlertTriangle, Play, Pause, Trash2, Inbox, Flame, Clock,
  MessageSquareQuote, Wand2, Calendar, CheckCircle2, XCircle, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { formatDate, cn } from '@/lib/utils';

type IdLabel = { id: string; label: string };
type SourceInfo = {
  id: string;
  label: string;
  configured: boolean;
  requiredEnv: string[];
  setupHint: string;
};

interface CampaignForm {
  name: string;
  description: string;
  serviceTypes: string[];
  platforms: string[];
  keywords: string;
  negativeKeywords: string;
  subreddits: string;
  siteFilters: string;
  regionCodes: string[];
  strictCountry: boolean;
  maxResultsPerRun: number;
  maxAgeDays: number;
  minBodyLength: number;
  excludeSellers: boolean;
  minEngagement: number;
  aiEnabled: boolean;
  minScore: number;
  generateMessage: boolean;
  messageTone: string;
  messageLanguage: string;
  scheduleMode: 'manual' | 'daily' | 'weekly';
  autoImport: boolean;
}

const emptyForm: CampaignForm = {
  name: '',
  description: '',
  serviceTypes: ['website', 'mobile_app'],
  // Hacker News needs no key at all, so a new campaign can always run.
  platforms: ['hackernews'],
  keywords: '',
  negativeKeywords: 'free, student project, unpaid, portfolio',
  subreddits: '',
  siteFilters: '',
  regionCodes: ['IN'],
  strictCountry: false,
  maxResultsPerRun: 60,
  maxAgeDays: 7,
  minBodyLength: 40,
  excludeSellers: true,
  minEngagement: 0,
  aiEnabled: true,
  minScore: 50,
  generateMessage: true,
  messageTone: 'helpful',
  messageLanguage: 'auto',
  scheduleMode: 'manual',
  autoImport: false,
};

const splitList = (value: string) =>
  value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);

export default function LeadsScrapAiPage() {
  const queryClient = useQueryClient();
  const needsWorkspace = useWorkspaceRequired();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CampaignForm>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [preview, setPreview] = useState<any[] | null>(null);

  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: sourcesData } = useQuery({
    queryKey: ['leads-scrap-ai-sources'],
    queryFn: () => api.get<any>('/social-prospecting/sources'),
  });
  const meta = sourcesData?.data || sourcesData || {};
  const sources: SourceInfo[] = meta.sources || [];
  const serviceTypes: IdLabel[] = meta.serviceTypes || [];
  const subredditPresets: { id: string; label: string; subreddits: string[] }[] =
    meta.subredditPresets || [];
  const sitePresets: { id: string; label: string; sites: string[] }[] = meta.sitePresets || [];
  const countries: { code: string; name: string }[] = meta.countries || [];

  const unconfigured = sources.filter((s) => !s.configured);
  // A campaign is runnable as long as one of its chosen platforms has its keys.
  const selectedRunnable = form.platforms.some(
    (p) => sources.find((s) => s.id === p)?.configured,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['leads-scrap-ai-campaigns'],
    queryFn: () => api.get<any>('/social-prospecting/campaigns', { page: 1, limit: 50 }),
  });
  const campaigns: any[] = data?.data?.data || data?.data || [];

  const { data: statsData } = useQuery({
    queryKey: ['leads-scrap-ai-stats'],
    queryFn: () => api.get<any>('/social-prospecting/posts/stats'),
  });
  const stats = statsData?.data || statsData || {};

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/social-prospecting/campaigns', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-campaigns'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      setPreview(null);
      toast.success('Campaign created');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not create campaign'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/social-prospecting/campaigns/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-campaigns'] }),
    onError: (err: any) => toast.error(err?.message || 'Update failed'),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => api.post(`/social-prospecting/campaigns/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-campaigns'] });
      toast.success('Run started - results appear as they are found');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not start run'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/social-prospecting/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-campaigns'] });
      setDeleteTarget(null);
      toast.success('Campaign deleted');
    },
    onError: (err: any) => toast.error(err?.message || 'Delete failed'),
  });

  const previewMutation = useMutation({
    mutationFn: (body: any) => api.post<any>('/social-prospecting/preview-queries', body),
    onSuccess: (res: any) => setPreview(res?.data?.perPlatform || res?.perPlatform || []),
    onError: (err: any) => toast.error(err?.message || 'Preview failed'),
  });

  const suggestMutation = useMutation({
    mutationFn: (body: any) => api.post<any>('/social-prospecting/suggest-keywords', body),
    onSuccess: (res: any) => {
      const keywords: string[] = res?.data?.keywords || res?.keywords || [];
      if (!keywords.length) {
        toast.error('No suggestions came back');
        return;
      }
      set('keywords', keywords.join(', '));
      toast.success(`${keywords.length} phrases suggested`);
    },
    onError: (err: any) => toast.error(err?.message || 'Suggestion failed'),
  });

  const canSubmit = useMemo(
    () => form.name.trim().length > 1 && form.platforms.length > 0 && selectedRunnable,
    [form, selectedRunnable],
  );

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    serviceTypes: form.serviceTypes,
    platforms: form.platforms,
    keywords: splitList(form.keywords),
    negativeKeywords: splitList(form.negativeKeywords),
    subreddits: splitList(form.subreddits),
    siteFilters: splitList(form.siteFilters),
    regionCodes: form.regionCodes,
    maxResultsPerRun: Number(form.maxResultsPerRun) || 60,
    autoImport: form.autoImport,
    filters: {
      maxAgeDays: Number(form.maxAgeDays) || 7,
      minBodyLength: Number(form.minBodyLength) || 0,
      excludeSellers: form.excludeSellers,
      minEngagement: Number(form.minEngagement) || 0,
      strictCountry: form.strictCountry,
    },
    ai: {
      enabled: form.aiEnabled,
      minScore: Number(form.minScore) || 0,
      generateMessage: form.generateMessage,
      messageTone: form.messageTone,
      messageLanguage: form.messageLanguage,
    },
    schedule: { mode: form.scheduleMode },
  });

  const toggleCountry = (code: string) =>
    setForm((f) => ({
      ...f,
      regionCodes: f.regionCodes.includes(code)
        ? f.regionCodes.filter((c) => c !== code)
        : [...f.regionCodes, code],
    }));

  const toggleIn = (key: 'serviceTypes' | 'platforms', id: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((s) => s !== id) : [...f[key], id],
    }));

  const appendList = (key: 'subreddits' | 'siteFilters', values: string[]) =>
    setForm((f) => {
      const existing = splitList(f[key]);
      const merged = Array.from(new Set([...existing, ...values]));
      return { ...f, [key]: merged.join(', ') };
    });

  return (
    <div>
      <PageHeader
        icon={Radio}
        eyebrow="Admin only"
        title="Leads Scrap AI"
        description="Find people on Reddit, Hacker News, Quora and the open web who are actively asking for a website, app, CRM or chatbot. AI reads each post, decides whether it is real buying intent, and drafts a personal reply."
        actions={
          <Button onClick={() => setShowCreate(true)} disabled={needsWorkspace}>
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Button>
        }
      />

      {needsWorkspace && <WorkspaceRequiredNotice feature="Leads Scrap AI" />}

      {/* Source health: which platforms can actually run right now. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {sources.map((s) => (
          <span
            key={s.id}
            title={s.configured ? `${s.label} is ready` : s.setupHint}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              s.configured
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {s.configured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {s.label}
          </span>
        ))}
      </div>

      {unconfigured.length > 0 && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold">
              {unconfigured.length} source{unconfigured.length > 1 ? 's' : ''} not configured
            </p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              {unconfigured.map((s) => (
                <li key={s.id}>
                  <strong className="text-foreground">{s.label}</strong> — {s.setupHint}
                  {s.requiredEnv.length > 0 && (
                    <span className="ml-1">
                      Set{' '}
                      {s.requiredEnv.map((e, i) => (
                        <span key={e}>
                          {i > 0 && ', '}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">{e}</code>
                        </span>
                      ))}{' '}
                      in <code className="rounded bg-muted px-1 py-0.5 text-xs">apps/api/.env</code> and restart
                      the API.
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Hacker News needs no key, so you can run a full campaign for free while the others are set up.
            </p>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Prospects found" value={stats.total ?? 0} icon={Radio} tone="primary" />
        <StatCard
          title="Awaiting review"
          value={stats.pending ?? 0}
          icon={Inbox}
          tone="warning"
          description="Read the post, then import"
        />
        <StatCard
          title="Hot intent"
          value={stats.hot ?? 0}
          icon={Flame}
          tone="danger"
          description="AI score 70+"
        />
        <StatCard
          title="Posted today"
          value={stats.postedToday ?? 0}
          icon={Clock}
          tone="success"
          description="Still looking right now"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No campaigns yet"
          description="A campaign is a set of buying-intent phrases swept across the platforms you pick. Start with Hacker News — it is free and needs no API key."
          actionLabel={needsWorkspace ? undefined : 'Create campaign'}
          onAction={needsWorkspace ? undefined : () => setShowCreate(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign._id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/leads-scrap-ai/${campaign._id}`}
                    className="block truncate font-semibold hover:text-primary"
                  >
                    {campaign.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {campaign.description ||
                      (campaign.keywords || []).slice(0, 3).join(', ') ||
                      'AI-picked buying-intent phrases'}
                  </p>
                </div>
                <Badge variant={campaign.status === 'active' ? 'success' : 'secondary'} dot>
                  {campaign.status}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(campaign.platforms || []).map((p: string) => (
                  <Badge key={p} variant="outline">
                    {sources.find((s) => s.id === p)?.label || p}
                  </Badge>
                ))}
                {campaign.schedule?.mode !== 'manual' && (
                  <Badge variant="info" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {campaign.schedule?.mode}
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                <div>
                  <p className="tabular text-lg font-bold">{campaign.stats?.totalQualified ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qualified</p>
                </div>
                <div>
                  <p className="tabular text-lg font-bold text-amber-600 dark:text-amber-400">
                    {campaign.pendingCount ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">To review</p>
                </div>
                <div>
                  <p className="tabular text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {campaign.stats?.totalImported ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Imported</p>
                </div>
              </div>

              {campaign.lastError && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {campaign.lastError}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-[11px] text-muted-foreground">
                  {campaign.stats?.lastRunAt
                    ? `Last run ${formatDate(campaign.stats.lastRunAt)}`
                    : 'Never run'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runMutation.mutate(campaign._id)}
                    disabled={runMutation.isPending || needsWorkspace}
                    title="Run now"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleMutation.mutate({
                        id: campaign._id,
                        status: campaign.status === 'active' ? 'paused' : 'active',
                      })
                    }
                    title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                  >
                    {campaign.status === 'active' ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(campaign)} title="Delete">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create campaign */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Leads Scrap AI campaign</DialogTitle>
            <DialogDescription>
              Pick what you sell, where to look, and how strict the AI should be. Preview the searches
              before anything is spent.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="sell" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sell">1. What you sell</TabsTrigger>
              <TabsTrigger value="where">2. Where to look</TabsTrigger>
              <TabsTrigger value="ai">3. Filters &amp; AI</TabsTrigger>
            </TabsList>

            <TabsContent value="sell" className="space-y-4 pt-4">
              {/* The direction of this feature is easy to read backwards, so spell it out. */}
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed">
                <p className="font-semibold text-foreground">How this works</p>
                <p className="mt-1 text-muted-foreground">
                  You are <strong className="text-foreground">not hiring anyone</strong>. This campaign hunts for
                  people who are publicly asking for the work you already do — your team delivers it.
                </p>
                <p className="mt-2 text-muted-foreground">
                  A bakery owner posts{' '}
                  <span className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                    &quot;need a website for my bakery&quot;
                  </span>{' '}
                  on Reddit → the AI confirms it is real buying intent → they land in your review queue with a
                  reply already drafted → you import them as a lead.
                </p>
              </div>

              <div>
                <Label htmlFor="scrap-name">Campaign name</Label>
                <Input
                  id="scrap-name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Website buyers - India"
                />
              </div>
              <div>
                <Label htmlFor="scrap-desc">Description (optional)</Label>
                <Textarea
                  id="scrap-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Small business owners asking for a first website"
                />
              </div>
              <div>
                <Label>Services you sell</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {serviceTypes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleIn('serviceTypes', s.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        form.serviceTypes.includes(s.id)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'hover:bg-accent',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="scrap-keywords">What your customers write when they need you</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => suggestMutation.mutate({ serviceTypes: form.serviceTypes })}
                    disabled={suggestMutation.isPending}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    {suggestMutation.isPending ? 'Thinking…' : 'Suggest with AI'}
                  </Button>
                </div>
                <Textarea
                  id="scrap-keywords"
                  rows={3}
                  value={form.keywords}
                  onChange={(e) => set('keywords', e.target.value)}
                  placeholder="need a website, looking for a web developer, website banwani hai"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  These are the words <strong className="text-foreground">other people</strong> post — not
                  something you are looking for. Anyone who writes one of these becomes a lead for your team.
                  Comma or newline separated; leave it empty and proven phrases for your selected services are used.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="where" className="space-y-4 pt-4">
              <div>
                <Label>Platforms</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleIn('platforms', s.id)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                        form.platforms.includes(s.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.configured ? 'Ready to run' : 'Not configured'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {!selectedRunnable && form.platforms.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    None of the selected platforms is configured. Add Hacker News to run for free.
                  </p>
                )}
              </div>

              {form.platforms.includes('reddit') && (
                <div>
                  <Label htmlFor="scrap-subs">Subreddits</Label>
                  <div className="mb-2 mt-2 flex flex-wrap gap-1.5">
                    {subredditPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => appendList('subreddits', p.subreddits)}
                        className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-accent"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    id="scrap-subs"
                    rows={2}
                    value={form.subreddits}
                    onChange={(e) => set('subreddits', e.target.value)}
                    placeholder="forhire, smallbusiness, Entrepreneur"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave empty to search all of Reddit. Each subreddit costs one API call per phrase.
                  </p>
                </div>
              )}

              {form.platforms.includes('web') && (
                <div>
                  <Label htmlFor="scrap-sites">Sites to sweep</Label>
                  <div className="mb-2 mt-2 flex flex-wrap gap-1.5">
                    {sitePresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => appendList('siteFilters', p.sites)}
                        className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-accent"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    id="scrap-sites"
                    rows={2}
                    value={form.siteFilters}
                    onChange={(e) => set('siteFilters', e.target.value)}
                    placeholder="indiehackers.com, linkedin.com/posts"
                  />
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Countries to target</Label>
                  <div className="flex items-center gap-2">
                    {form.regionCodes.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {form.regionCodes.length} selected
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => set('regionCodes', [])}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Anywhere
                    </button>
                  </div>
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {countries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCountry(c.code)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          form.regionCodes.includes(c.code)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'hover:bg-accent',
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {form.regionCodes.length === 0
                    ? 'No country selected - prospects from anywhere are kept.'
                    : 'Quora and Web run one search per country, so each extra country costs SERP quota. Reddit and Hacker News have no country filter of their own, so for those the AI reads the location out of the post instead.'}
                </p>
              </div>

              <div>
                <Label htmlFor="scrap-max">Max prospects per run</Label>
                <Input
                  id="scrap-max"
                  type="number"
                  min={5}
                  max={300}
                  value={form.maxResultsPerRun}
                  onChange={(e) => set('maxResultsPerRun', Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="scrap-negative">Never match these words</Label>
                <Input
                  id="scrap-negative"
                  value={form.negativeKeywords}
                  onChange={(e) => set('negativeKeywords', e.target.value)}
                  placeholder="free, student project, unpaid"
                />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="scrap-age">Only posts newer than (days)</Label>
                  <Input
                    id="scrap-age"
                    type="number"
                    min={1}
                    max={365}
                    value={form.maxAgeDays}
                    onChange={(e) => set('maxAgeDays', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="scrap-minbody">Minimum post length</Label>
                  <Input
                    id="scrap-minbody"
                    type="number"
                    min={0}
                    max={2000}
                    value={form.minBodyLength}
                    onChange={(e) => set('minBodyLength', Number(e.target.value))}
                  />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium">Skip sellers</p>
                  <p className="text-xs text-muted-foreground">
                    Drops &quot;[FOR HIRE]&quot; and portfolio posts — they are competitors, not buyers.
                  </p>
                </div>
                <Switch
                  checked={form.excludeSellers}
                  onCheckedChange={(v) => set('excludeSellers', v)}
                />
              </label>

              {form.regionCodes.length > 0 && (
                <label className="flex items-center justify-between rounded-lg border p-3">
                  <div className="pr-4">
                    <p className="text-sm font-medium">Only keep posts placed in those countries</p>
                    <p className="text-xs text-muted-foreground">
                      Most posts never say where the author is. Off: keep those too, they are still
                      leads. On: drop anything the AI could not place.
                    </p>
                  </div>
                  <Switch
                    checked={form.strictCountry}
                    onCheckedChange={(v) => set('strictCountry', v)}
                  />
                </label>
              )}

              <label className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium">AI qualification</p>
                  <p className="text-xs text-muted-foreground">
                    Reads each post and decides whether it is really someone wanting to buy.
                  </p>
                </div>
                <Switch checked={form.aiEnabled} onCheckedChange={(v) => set('aiEnabled', v)} />
              </label>

              {form.aiEnabled && (
                <>
                  <div>
                    <Label htmlFor="scrap-minscore">Minimum AI score to keep ({form.minScore})</Label>
                    <Input
                      id="scrap-minscore"
                      type="number"
                      min={0}
                      max={100}
                      value={form.minScore}
                      onChange={(e) => set('minScore', Number(e.target.value))}
                    />
                  </div>

                  <label className="flex items-center justify-between rounded-lg border p-3">
                    <div className="pr-4">
                      <p className="text-sm font-medium">Draft a reply for each prospect</p>
                      <p className="text-xs text-muted-foreground">
                        Written for you to review, edit and post yourself — nothing is sent automatically.
                      </p>
                    </div>
                    <Switch
                      checked={form.generateMessage}
                      onCheckedChange={(v) => set('generateMessage', v)}
                    />
                  </label>

                  {form.generateMessage && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Message tone</Label>
                        <Select value={form.messageTone} onValueChange={(v) => set('messageTone', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="helpful">Helpful</SelectItem>
                            <SelectItem value="direct">Direct</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Message language</Label>
                        <Select
                          value={form.messageLanguage}
                          onValueChange={(v) => set('messageLanguage', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Match the post</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="hi">Hindi</SelectItem>
                            <SelectItem value="hinglish">Hinglish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Schedule</Label>
                <Select
                  value={form.scheduleMode}
                  onValueChange={(v) => set('scheduleMode', v as CampaignForm['scheduleMode'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium">Auto-import high scorers</p>
                  <p className="text-xs text-muted-foreground">
                    Off by default. Reviewing first is safer — the AI does occasionally get it wrong.
                  </p>
                </div>
                <Switch checked={form.autoImport} onCheckedChange={(v) => set('autoImport', v)} />
              </label>
            </TabsContent>
          </Tabs>

          {preview && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What will be searched
              </p>
              <div className="max-h-52 space-y-3 overflow-y-auto">
                {preview.map((p: any) => (
                  <div key={p.platform}>
                    <p className="text-xs font-medium">
                      {p.label || p.platform}{' '}
                      <span className="text-muted-foreground">
                        · {p.searches} search{p.searches === 1 ? '' : 'es'}
                        {p.budget && p.searches > p.budget && ` (only ${p.willRun} will run)`}
                        {(p.geo || []).length > 0 && ` · ${p.geo.join(', ')}`}
                        {!p.configured && ' · not configured'}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {(p.samples || []).slice(0, 6).map((q: string) => (
                        <li key={q} className="truncate font-mono text-[11px] text-muted-foreground">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                previewMutation.mutate({
                  serviceTypes: form.serviceTypes,
                  platforms: form.platforms,
                  keywords: splitList(form.keywords),
                  subreddits: splitList(form.subreddits),
                  siteFilters: splitList(form.siteFilters),
                  maxAgeDays: Number(form.maxAgeDays) || 7,
                  regionCodes: form.regionCodes,
                })
              }
              disabled={previewMutation.isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Preview searches
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(buildPayload())}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create campaign'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; will stop running. Prospects it already found stay in the
              review queue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget._id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
