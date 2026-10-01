'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Radio, Play, ExternalLink, Copy, RefreshCw, Check, X, Flame,
  Clock, AlertTriangle, Inbox, MessageSquareQuote, Send, ChevronDown, ChevronUp, Globe2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { formatDate, cn } from '@/lib/utils';

const INTENTS = ['buying', 'researching', 'hiring', 'complaining', 'offering', 'irrelevant'];

/** "2 hours ago" / "~3 days ago" - the "~" marks a date the platform only hinted at. */
function relativeAge(date?: string, confidence?: string): string {
  if (!date) return 'unknown date';
  const ms = Date.now() - new Date(date).getTime();
  if (isNaN(ms)) return 'unknown date';
  const prefix = confidence === 'approx' ? '~' : '';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${prefix}${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${prefix}${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${prefix}${days}d ago`;
  return `${prefix}${Math.round(days / 30)}mo ago`;
}

function scoreTone(score: number) {
  if (score >= 70) return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (score >= 40) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300';
}

export default function LeadsScrapAiCampaignPage() {
  const params = useParams();
  const campaignId = String(params?.id || '');
  const queryClient = useQueryClient();
  const needsWorkspace = useWorkspaceRequired();

  const [status, setStatus] = useState('new');
  const [source, setSource] = useState('all');
  const [intent, setIntent] = useState('all');
  const [minScore, setMinScore] = useState('0');
  const [country, setCountry] = useState('all');
  const [sortBy, setSortBy] = useState('postedAt');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-posts', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-campaign-stats', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-stats'] });
  };

  const { data: campaignData } = useQuery({
    queryKey: ['leads-scrap-ai-campaign', campaignId],
    queryFn: () => api.get<any>(`/social-prospecting/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
  const campaign = campaignData?.data || campaignData || {};

  const { data: runsData } = useQuery({
    queryKey: ['leads-scrap-ai-runs', campaignId],
    queryFn: () => api.get<any>(`/social-prospecting/campaigns/${campaignId}/runs`),
    enabled: !!campaignId,
    // A run is fire-and-forget on the server; poll while one is in flight.
    refetchInterval: (query) => {
      const rows: any[] = (query.state.data as any)?.data || (query.state.data as any) || [];
      return rows.some((r: any) => r.status === 'running') ? 5000 : false;
    },
  });
  const runs: any[] = runsData?.data || runsData || [];
  const activeRun = runs.find((r) => r.status === 'running');

  const { data: statsData } = useQuery({
    queryKey: ['leads-scrap-ai-campaign-stats', campaignId],
    queryFn: () => api.get<any>('/social-prospecting/posts/stats', { campaignId }),
    enabled: !!campaignId,
  });
  const stats = statsData?.data || statsData || {};

  const { data: postsData, isLoading } = useQuery({
    queryKey: [
      'leads-scrap-ai-posts', campaignId, status, source, intent, minScore, country, sortBy,
    ],
    queryFn: () =>
      api.get<any>('/social-prospecting/posts', {
        campaignId,
        limit: 50,
        sortBy,
        ...(status !== 'all' ? { status } : {}),
        ...(source !== 'all' ? { source } : {}),
        ...(intent !== 'all' ? { intent } : {}),
        ...(Number(minScore) > 0 ? { minScore: Number(minScore) } : {}),
        ...(country !== 'all' ? { country } : {}),
      }),
    enabled: !!campaignId,
  });
  const posts: any[] = postsData?.data?.data || postsData?.data || [];

  const runMutation = useMutation({
    mutationFn: () => api.post(`/social-prospecting/campaigns/${campaignId}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-runs', campaignId] });
      toast.success('Run started');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not start run'),
  });

  const importMutation = useMutation({
    mutationFn: (ids: string[]) => api.post<any>('/social-prospecting/posts/import', { ids }),
    onSuccess: (res: any) => {
      const imported = res?.data?.imported ?? res?.imported ?? 0;
      const skipped = res?.data?.skipped ?? res?.skipped ?? 0;
      setSelected([]);
      invalidate();
      toast.success(`${imported} imported${skipped ? `, ${skipped} skipped` : ''}`);
    },
    onError: (err: any) => toast.error(err?.message || 'Import failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/social-prospecting/posts/reject', { ids }),
    onSuccess: () => {
      setSelected([]);
      invalidate();
      toast.success('Rejected');
    },
    onError: (err: any) => toast.error(err?.message || 'Reject failed'),
  });

  const regenerateMutation = useMutation({
    mutationFn: ({ id, tone }: { id: string; tone?: string }) =>
      api.post<any>(`/social-prospecting/posts/${id}/generate-message`, tone ? { tone } : {}),
    onSuccess: (res: any, vars) => {
      const doc = res?.data || res;
      setDrafts((d) => ({ ...d, [vars.id]: doc?.outreach?.message || '' }));
      invalidate();
      toast.success('New draft written');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not draft a message'),
  });

  const saveDraftMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch(`/social-prospecting/posts/${id}/message`, { body }),
    onSuccess: () => toast.success('Draft saved'),
    onError: (err: any) => toast.error(err?.message || 'Save failed'),
  });

  const markSentMutation = useMutation({
    mutationFn: (id: string) => api.post(`/social-prospecting/posts/${id}/mark-sent`, {}),
    onSuccess: () => {
      invalidate();
      toast.success('Marked as sent');
    },
    onError: (err: any) => toast.error(err?.message || 'Update failed'),
  });

  const allSelected = posts.length > 0 && selected.length === posts.length;
  const toggleAll = () => setSelected(allSelected ? [] : posts.map((p) => p._id));
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleExpanded = (id: string) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied — paste it in the thread');
    } catch {
      toast.error('Clipboard blocked by the browser');
    }
  };

  const platforms: string[] = useMemo(() => campaign.platforms || [], [campaign]);

  /**
   * Countries actually present in this campaign's results, plus the ones it
   * targets - so the filter still offers a country whose prospects were all
   * imported already.
   */
  const countryOptions: string[] = useMemo(() => {
    const found = Object.keys(stats.byCountry || {});
    const targeted: string[] = campaign.regionCodes || [];
    return Array.from(new Set([...targeted, ...found])).sort();
  }, [stats, campaign]);

  return (
    <div>
      <Link
        href="/dashboard/leads-scrap-ai"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All campaigns
      </Link>

      <PageHeader
        icon={Radio}
        eyebrow="Leads Scrap AI"
        title={campaign.name || 'Campaign'}
        description={
          campaign.description ||
          (campaign.keywords || []).slice(0, 4).join(' · ') ||
          'Buying-intent prospecting'
        }
        actions={
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !!activeRun || needsWorkspace}
          >
            <Play className="mr-2 h-4 w-4" />
            {activeRun ? 'Running…' : 'Run now'}
          </Button>
        }
      />

      {needsWorkspace && <WorkspaceRequiredNotice feature="Leads Scrap AI" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Prospects" value={stats.total ?? 0} icon={Radio} tone="primary" />
        <StatCard title="Awaiting review" value={stats.pending ?? 0} icon={Inbox} tone="warning" />
        <StatCard title="Hot intent" value={stats.hot ?? 0} icon={Flame} tone="danger" />
        <StatCard
          title="Drafts ready"
          value={stats.withMessage ?? 0}
          icon={MessageSquareQuote}
          tone="violet"
        />
      </div>

      {/* Run history */}
      {runs.length > 0 && (
        <Card className="mb-6 p-5">
          <p className="mb-3 text-sm font-semibold">Recent runs</p>
          <div className="space-y-2">
            {runs.slice(0, 5).map((run) => (
              <div key={run._id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        run.status === 'completed'
                          ? 'success'
                          : run.status === 'failed'
                            ? 'destructive'
                            : 'info'
                      }
                      dot
                    >
                      {run.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(run.startedAt || run.createdAt)} · {run.trigger}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{run.stats?.fetched ?? 0} fetched</span>
                    <span>{run.stats?.qualified ?? 0} qualified</span>
                    <span className="font-medium text-foreground">{run.stats?.saved ?? 0} saved</span>
                    <span>{run.stats?.messagesGenerated ?? 0} drafts</span>
                    <span>{run.stats?.apiCalls ?? 0} API calls</span>
                  </div>
                </div>

                {(run.perPlatform || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {run.perPlatform.map((p: any) => (
                      <Badge key={p.platform} variant={p.error ? 'destructive' : 'outline'}>
                        {p.platform}: {p.saved ?? 0}
                        {p.error ? ' · failed' : ''}
                      </Badge>
                    ))}
                  </div>
                )}

                {run.error && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {run.error}
                  </p>
                )}

                {(run.warnings || []).length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {run.warnings.slice(0, 4).map((w: string, i: number) => (
                      <li key={i} className="text-[11px] text-amber-600 dark:text-amber-400">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[130px]">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">To review</SelectItem>
              <SelectItem value="imported">Imported</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Label className="text-xs">Platform</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Label className="text-xs">Intent</Label>
          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any intent</SelectItem>
              {INTENTS.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {countryOptions.length > 0 && (
          <div className="min-w-[130px]">
            <Label className="text-xs">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any country</SelectItem>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                    {stats.byCountry?.[c] ? ` (${stats.byCountry[c]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[120px]">
          <Label className="text-xs">Min score</Label>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any</SelectItem>
              <SelectItem value="40">40+</SelectItem>
              <SelectItem value="60">60+</SelectItem>
              <SelectItem value="70">70+ (hot)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs">Sort</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="postedAt">Newest post first</SelectItem>
              <SelectItem value="score">Highest score first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk bar */}
      {posts.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            {selected.length > 0 ? `${selected.length} selected` : 'Select all'}
          </label>
          {selected.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => importMutation.mutate(selected)}
                disabled={importMutation.isPending}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Import {selected.length} to Leads
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate(selected)}
                disabled={rejectMutation.isPending}
              >
                <X className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here yet"
          description={
            activeRun
              ? 'A run is in progress — prospects appear as the AI finishes reading them.'
              : 'Run the campaign to sweep the selected platforms for buying-intent posts.'
          }
          actionLabel={activeRun ? undefined : 'Run now'}
          onAction={activeRun ? undefined : () => runMutation.mutate()}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isOpen = expanded.includes(post._id);
            const draft = drafts[post._id] ?? post.outreach?.editedBody ?? post.outreach?.message ?? '';
            const score = post.ai?.score ?? 0;

            return (
              <Card key={post._id} className="p-5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.includes(post._id)}
                    onCheckedChange={() => toggleOne(post._id)}
                    className="mt-1"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{post.source}</Badge>
                      {post.communityName && (
                        <span className="truncate text-xs text-muted-foreground">
                          {post.communityName}
                        </span>
                      )}
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title={
                          post.dateConfidence === 'approx'
                            ? 'This platform only exposes an approximate date'
                            : formatDate(post.postedAt)
                        }
                      >
                        <Clock className="h-3 w-3" />
                        {relativeAge(post.postedAt, post.dateConfidence)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          scoreTone(score),
                        )}
                      >
                        {score}
                      </span>
                      {post.ai?.intent && <Badge variant="violet">{post.ai.intent}</Badge>}
                      {post.country && (
                        <Badge
                          variant="outline"
                          className="gap-1"
                          title={post.locationText || `AI placed this author in ${post.country}`}
                        >
                          <Globe2 className="h-3 w-3" />
                          {post.country}
                        </Badge>
                      )}
                      {post.ai?.urgency === 'high' && <Badge variant="destructive">urgent</Badge>}
                      {post.status !== 'new' && <Badge variant="secondary">{post.status}</Badge>}
                      {post.outreach?.sendStatus === 'sent' && <Badge variant="success">sent</Badge>}
                    </div>

                    {/* Post */}
                    {post.title && <p className="mt-2 font-semibold leading-snug">{post.title}</p>}
                    <p
                      className={cn(
                        'mt-1 whitespace-pre-wrap text-sm text-muted-foreground',
                        !isOpen && 'line-clamp-3',
                      )}
                    >
                      {post.body}
                    </p>
                    {(post.body || '').length > 220 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(post._id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isOpen ? 'Show less' : 'Show full post'}
                      </button>
                    )}

                    <p className="mt-2 text-xs text-muted-foreground">
                      by{' '}
                      {post.authorProfileUrl ? (
                        <a
                          href={post.authorProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline"
                        >
                          {post.authorHandle || 'unknown'}
                        </a>
                      ) : (
                        post.authorHandle || 'unknown'
                      )}
                      {post.engagement?.upvotes ? ` · ${post.engagement.upvotes} upvotes` : ''}
                      {post.engagement?.comments ? ` · ${post.engagement.comments} comments` : ''}
                    </p>

                    {/* AI verdict */}
                    {post.ai?.needSummary && (
                      <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          What the AI read
                        </p>
                        <p className="mt-1 text-sm">{post.ai.needSummary}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {post.ai.recommendedService && (
                            <Badge variant="info">pitch: {post.ai.recommendedService}</Badge>
                          )}
                          {post.ai.budgetHint && (
                            <Badge variant="success">budget: {post.ai.budgetHint}</Badge>
                          )}
                          {(post.ai.painPoints || []).map((p: string) => (
                            <Badge key={p} variant="outline">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Draft */}
                    <div className="mt-3">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-xs">
                          Suggested {String(post.outreach?.channel || 'reply').replace(/_/g, ' ')}
                        </Label>
                        <div className="flex items-center gap-1">
                          <Select
                            onValueChange={(tone) =>
                              regenerateMutation.mutate({ id: post._id, tone })
                            }
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue placeholder="Tone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="helpful">Helpful</SelectItem>
                              <SelectItem value="direct">Direct</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="formal">Formal</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => regenerateMutation.mutate({ id: post._id })}
                            disabled={regenerateMutation.isPending}
                            title="Rewrite"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <Textarea
                        rows={3}
                        value={draft}
                        placeholder="No draft yet — use Rewrite to generate one."
                        onChange={(e) => setDrafts((d) => ({ ...d, [post._id]: e.target.value }))}
                        onBlur={() => {
                          const current = drafts[post._id];
                          if (current !== undefined && current !== (post.outreach?.editedBody ?? post.outreach?.message)) {
                            saveDraftMutation.mutate({ id: post._id, body: current });
                          }
                        }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                      <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open thread
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyMessage(draft)}
                        disabled={!draft}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markSentMutation.mutate(post._id)}
                        disabled={post.outreach?.sendStatus === 'sent'}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Mark sent
                      </Button>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => importMutation.mutate([post._id])}
                          disabled={post.status === 'imported' || importMutation.isPending}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          {post.status === 'imported' ? 'Imported' : 'Import to Leads'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectMutation.mutate([post._id])}
                          disabled={post.status === 'rejected'}
                        >
                          <X className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
