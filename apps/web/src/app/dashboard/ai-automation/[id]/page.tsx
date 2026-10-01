'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Radar, ArrowLeft, Play, ExternalLink, Search, Sparkles, Phone, Globe2,
  MapPin, Star, CheckCircle2, XCircle, Download, History, AlertTriangle,
  MessageSquareQuote, Loader2, Store, Copy,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton, TablePagination } from '@/components/shared/data-table';
import { formatDate, cn } from '@/lib/utils';

const scoreTone = (score: number) =>
  score >= 70
    ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 40
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground';

const tempVariant: Record<string, 'destructive' | 'warning' | 'info'> = {
  hot: 'destructive',
  warm: 'warning',
  cold: 'info',
};

/** Opens the exact page the data came from, so a prospect can be verified before outreach. */
function SeeOriginal({ url, label = 'See original' }: { url?: string; label?: string }) {
  if (!url) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = String(params?.id || '');

  const [status, setStatus] = useState('new');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('0');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [pollRuns, setPollRuns] = useState(false);

  const { data: campaignData } = useQuery({
    queryKey: ['ai-automation-campaign', campaignId],
    queryFn: () => api.get<any>(`/lead-automation/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
  const campaign = campaignData?.data || campaignData || {};

  const { data: statsData } = useQuery({
    queryKey: ['ai-automation-campaign-stats', campaignId],
    queryFn: () => api.get<any>('/lead-automation/prospects/stats', { campaignId }),
    enabled: !!campaignId,
  });
  const stats = statsData?.data || statsData || {};

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ai-automation-prospects', campaignId, status, search, minScore, page, limit],
    queryFn: () =>
      api.get<any>('/lead-automation/prospects', {
        campaignId,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        minScore: Number(minScore) || undefined,
        page,
        limit,
      }),
    enabled: !!campaignId,
  });
  const prospects: any[] = data?.data?.data || data?.data || [];
  const meta = data?.data?.meta || data?.meta || { total: 0, totalPages: 1 };

  const { data: runsData } = useQuery({
    queryKey: ['ai-automation-runs', campaignId],
    queryFn: () => api.get<any>(`/lead-automation/campaigns/${campaignId}/runs`),
    enabled: !!campaignId,
    refetchInterval: pollRuns ? 4000 : false,
  });
  const runs: any[] = runsData?.data || [];
  const activeRun = runs.find((r) => r.status === 'running');

  // Follow a run until it settles, then refresh the results table.
  useEffect(() => {
    if (activeRun && !pollRuns) setPollRuns(true);
    if (!activeRun && pollRuns) {
      setPollRuns(false);
      queryClient.invalidateQueries({ queryKey: ['ai-automation-prospects', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaign-stats', campaignId] });
      const latest = runs[0];
      if (latest?.status === 'completed') {
        toast.success(`Run finished — ${latest.stats?.saved ?? 0} new prospects`);
      } else if (latest?.status === 'failed') {
        toast.error(latest.error || 'Run failed');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun, pollRuns]);

  const runMutation = useMutation({
    mutationFn: () => api.post(`/lead-automation/campaigns/${campaignId}/run`, {}),
    onSuccess: () => {
      setPollRuns(true);
      queryClient.invalidateQueries({ queryKey: ['ai-automation-runs', campaignId] });
      toast.success('Run started — collecting prospects');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not start the run'),
  });

  const importMutation = useMutation({
    mutationFn: (ids: string[]) => api.post<any>('/lead-automation/prospects/import', { ids }),
    onSuccess: (res: any) => {
      const imported = res?.data?.imported ?? res?.imported ?? 0;
      const skipped = res?.data?.skipped ?? res?.skipped ?? 0;
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['ai-automation-prospects', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaign-stats', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-pending'] });
      toast.success(
        skipped ? `${imported} imported, ${skipped} skipped` : `${imported} imported into Leads`,
      );
    },
    onError: (err: any) => toast.error(err?.message || 'Import failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/lead-automation/prospects/reject', { ids }),
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['ai-automation-prospects', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaign-stats', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-pending'] });
      toast.success('Marked as rejected');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not reject'),
  });

  const allSelected = useMemo(
    () => prospects.length > 0 && selected.length === prospects.length,
    [prospects, selected],
  );

  const toggleAll = () => setSelected(allSelected ? [] : prospects.map((p) => p._id));
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const copyOutreach = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success('Outreach message copied'),
      () => toast.error('Copy failed'),
    );
  };

  return (
    <div>
      <PageHeader
        icon={Radar}
        eyebrow="AI Automation"
        title={campaign.name || 'Campaign'}
        description={
          campaign.description ||
          'Prospects collected from Google Maps. Open the original listing to verify each one before reaching out.'
        }
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/dashboard/ai-automation')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" onClick={() => setShowRuns(true)}>
              <History className="mr-2 h-4 w-4" />
              Runs
            </Button>
            <Button onClick={() => runMutation.mutate()} disabled={!!activeRun || runMutation.isPending}>
              {activeRun ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run now
                </>
              )}
            </Button>
          </>
        }
      />

      {activeRun && (
        <Card className="mb-6 flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="text-sm">
            <p className="font-semibold">Sweeping Google Maps…</p>
            <p className="text-muted-foreground">
              {activeRun.queries?.length
                ? `${activeRun.queries.length} queries in flight. Results appear here as soon as the run ends.`
                : 'Building search queries.'}
            </p>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total ?? 0, tone: '' },
          { label: 'To review', value: stats.pending ?? 0, tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Newly listed', value: stats.newListings ?? 0, tone: 'text-violet-600 dark:text-violet-400' },
          { label: 'Imported', value: stats.imported ?? 0, tone: 'text-emerald-600 dark:text-emerald-400' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('mt-1 text-2xl font-bold tabular', s.tone)}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
            setSelected([]);
          }}
        >
          <TabsList>
            <TabsTrigger value="new">To review</TabsTrigger>
            <TabsTrigger value="imported">Imported</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Business, city, category"
              className="w-56 pl-8"
            />
          </div>
          <Select
            value={minScore}
            onValueChange={(v) => {
              setMinScore(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any score</SelectItem>
              <SelectItem value="40">Score 40+</SelectItem>
              <SelectItem value="70">Score 70+ (hot)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{selected.length} selected</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectMutation.mutate(selected)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => importMutation.mutate(selected)}
              disabled={importMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {importMutation.isPending ? 'Importing…' : `Import ${selected.length} to Leads`}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : prospects.length === 0 ? (
        <EmptyState
          icon={Store}
          title={status === 'new' ? 'Nothing waiting for review' : 'No prospects here'}
          description={
            status === 'new'
              ? 'Hit "Run now" to sweep Google Maps for newly listed businesses matching this campaign.'
              : 'Try another tab or loosen the filters.'
          }
          actionLabel={status === 'new' && !activeRun ? 'Run now' : undefined}
          onAction={status === 'new' && !activeRun ? () => runMutation.mutate() : undefined}
        />
      ) : (
        <Card className={cn('overflow-hidden', isFetching && 'opacity-70')}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead className="w-24">AI score</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-32">Verify</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer"
                    onClick={() => setDetail(p)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(p._id)}
                        onCheckedChange={() => toggleOne(p._id)}
                        aria-label={`Select ${p.businessName}`}
                      />
                    </TableCell>

                    <TableCell>
                      <p className="font-medium">{p.businessName}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[p.category, p.city].filter(Boolean).join(' · ') || p.address}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-lg font-bold tabular', scoreTone(p.ai?.score || 0))}>
                          {p.ai?.score ?? '—'}
                        </span>
                        {p.ai?.temperature && (
                          <Badge variant={tempVariant[p.ai.temperature] || 'info'}>
                            {p.ai.temperature}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.isNewListing && (
                          <Badge variant="violet" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            New listing
                          </Badge>
                        )}
                        {!p.website && (
                          <Badge variant="success" className="gap-1">
                            <Globe2 className="h-3 w-3" />
                            No website
                          </Badge>
                        )}
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3" />
                          {p.rating || '—'} ({p.reviewCount || 0})
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      {p.phone ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {p.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No phone</span>
                      )}
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <SeeOriginal url={p.sourceUrl} />
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {p.status === 'imported' ? (
                        p.importedLeadId ? (
                          <Link href={`/dashboard/leads/${p.importedLeadId}`}>
                            <Button variant="ghost" size="sm">
                              <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-500" />
                              Lead
                            </Button>
                          </Link>
                        ) : (
                          <Badge variant="success">Imported</Badge>
                        )
                      ) : p.status === 'rejected' ? (
                        <Badge variant="secondary">Rejected</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => importMutation.mutate([p._id])}
                          disabled={importMutation.isPending}
                        >
                          Import
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            total={meta.total || 0}
            page={page}
            limit={limit}
            totalPages={meta.totalPages || 1}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </Card>
      )}

      {/* Prospect detail */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.businessName}</DialogTitle>
            <DialogDescription>
              {[detail?.category, detail?.address].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tempVariant[detail.ai?.temperature] || 'info'}>
                  Score {detail.ai?.score ?? 0} · {detail.ai?.temperature || 'cold'}
                </Badge>
                {detail.isNewListing && (
                  <Badge variant="violet" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Newly listed
                  </Badge>
                )}
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Google Maps listing
                </a>
              </div>

              {detail.newListingSignals?.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Why this looks new
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.newListingSignals.map((s: string) => (
                      <Badge key={s} variant="outline" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {detail.ai?.fitReason && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI assessment
                  </p>
                  <p className="text-sm">{detail.ai.fitReason}</p>
                  {detail.ai.recommendedService && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Pitch first: </span>
                      <span className="font-medium">{detail.ai.recommendedService}</span>
                    </p>
                  )}
                  {detail.ai.painPoints?.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      {detail.ai.painPoints.map((pp: string) => (
                        <li key={pp}>{pp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {detail.ai?.outreachMessage && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Suggested first message
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => copyOutreach(detail.ai.outreachMessage)}>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm">{detail.ai.outreachMessage}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{detail.phone || 'Not listed'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Website</p>
                  {detail.website ? (
                    <a
                      href={detail.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline break-all"
                    >
                      {detail.website}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      None — good fit for web work
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="text-sm font-medium">
                    {detail.rating || '—'} from {detail.reviewCount || 0} reviews
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Oldest review</p>
                  <p className="text-sm font-medium">
                    {detail.oldestReviewAt ? formatDate(detail.oldestReviewAt) : 'Unknown'}
                  </p>
                </div>
              </div>

              {detail.reviewSamples?.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    What customers wrote
                  </p>
                  <div className="space-y-2">
                    {detail.reviewSamples.slice(0, 5).map((r: any, i: number) => (
                      <div key={i} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">
                            {r.author || 'Anonymous'}
                            {r.rating ? ` · ${r.rating}★` : ''}
                            {r.publishedAt ? ` · ${formatDate(r.publishedAt)}` : ''}
                          </p>
                          <SeeOriginal url={r.url} label="Open review" />
                        </div>
                        {r.text && <p className="mt-1.5 text-sm text-muted-foreground">{r.text}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detail?.status === 'new' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    rejectMutation.mutate([detail._id]);
                    setDetail(null);
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    importMutation.mutate([detail._id]);
                    setDetail(null);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Import to Leads
                </Button>
              </>
            )}
            {detail?.status !== 'new' && (
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run history */}
      <Dialog open={showRuns} onOpenChange={setShowRuns}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Run history</DialogTitle>
            <DialogDescription>Every sweep this campaign has made, with what it cost.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {runs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
            )}
            {runs.map((run) => (
              <div key={run._id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        run.status === 'completed'
                          ? 'success'
                          : run.status === 'failed'
                            ? 'destructive'
                            : 'warning'
                      }
                      dot
                    >
                      {run.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(run.startedAt || run.createdAt)} · {run.trigger}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular">
                    {run.stats?.apiCalls ?? 0} API calls
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                  {[
                    ['Fetched', run.stats?.fetched],
                    ['Duplicates', run.stats?.duplicates],
                    ['Filtered', run.stats?.filteredOut],
                    ['Saved', run.stats?.saved],
                    ['New listings', run.stats?.newListings],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-sm font-bold tabular">{(value as number) ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {run.error && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {run.error}
                  </p>
                )}
                {run.warnings?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {run.warnings.length} warning{run.warnings.length === 1 ? '' : 's'}
                    </summary>
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {run.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
