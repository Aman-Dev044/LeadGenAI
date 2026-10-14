'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  Award,
  BrainCircuit,
  Check,
  CircleHelp,
  FlaskConical,
  Gauge,
  Mail,
  Quote,
  RefreshCw,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDate } from '@/lib/utils';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const FIELD_LABEL: Record<string, string> = {
  greeting: 'Opening line',
  pitch: 'What we sell',
  goal: 'Instructions',
};

const METRIC_LABEL: Record<string, string> = {
  meetings: 'Meetings booked',
  interested: 'Leads interested',
  interest_score: 'Average interest',
};

/** A delta rendered the way a manager reads it: up is good, down is not. */
function Delta({ value, suffix = ' pts' }: { value: number; suffix?: string }) {
  if (!value) return <span className="text-muted-foreground">no change</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

function Bar({ percent, tone = 'brand' }: { percent: number; tone?: 'brand' | 'good' | 'bad' }) {
  const colour =
    tone === 'good' ? 'bg-emerald-500' : tone === 'bad' ? 'bg-rose-500' : 'bg-brand-gradient';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export default function RevenueBrainPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState('30');
  const [newExperiment, setNewExperiment] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-brain', 'overview', days],
    queryFn: () => api.get<any>('/revenue-brain/overview', { days }),
  });

  const { data: experiments } = useQuery({
    queryKey: ['revenue-brain', 'experiments'],
    queryFn: () => api.get<any>('/revenue-brain/experiments'),
  });

  const { data: digest } = useQuery({
    queryKey: ['revenue-brain', 'digest'],
    queryFn: () => api.get<any>('/revenue-brain/digest/preview', { days: 7 }),
  });

  const gradeNow = useMutation({
    mutationFn: () => api.post<any>('/revenue-brain/grade-now'),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      toast.success(r?.graded ? `Graded ${r.graded} call${r.graded === 1 ? '' : 's'}` : 'Everything is already graded');
      qc.invalidateQueries({ queryKey: ['revenue-brain'] });
    },
    onError: () => toast.error('Could not grade the calls just now'),
  });

  const sendDigest = useMutation({
    mutationFn: () => api.post<any>('/revenue-brain/digest/send'),
    onSuccess: (res: any) => toast.success(res?.data?.message || res?.message || 'Digest sent'),
    onError: () => toast.error('Could not send the digest'),
  });

  // api.get returns the whole { success, data } envelope, not the payload
  const o = (data as any)?.data || {};
  const expList: any[] = (experiments as any)?.data || [];
  const dg: any = (digest as any)?.data || null;
  const h = o.headline || {};
  const delta = h.delta || {};

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BrainCircuit}
        eyebrow="Gets better every week"
        title="Revenue Brain"
        description="Every call graded against a rubric, every lost deal explained, and the script tested until it wins."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => gradeNow.mutate()} disabled={gradeNow.isPending}>
              <RefreshCw className={`h-4 w-4 ${gradeNow.isPending ? 'animate-spin' : ''}`} /> Grade now
            </Button>
          </div>
        }
      />

      {/* The one line worth reading first */}
      {!!o.biggestLeak && (
        <Card className="border-primary/30 bg-primary/5 p-5">
          <p className="text-xs font-bold tracking-wider text-primary uppercase">The headline</p>
          <p className="mt-1 text-lg font-semibold">
            Your biggest leak is <span className="text-primary">{o.biggestLeak.toLowerCase()}</span>
            {o.weakestSkill ? (
              <>
                , and the agent is weakest at <span className="text-primary">{o.weakestSkill.toLowerCase()}</span>
              </>
            ) : null}
            .
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Calls reviewed"
          value={h.reviewed ?? 0}
          icon={Activity}
          description={`${h.connected ?? 0} actually connected`}
        />
        <StatCard
          title="Call quality"
          value={`${h.avgScore ?? 0}/100`}
          icon={Gauge}
          tone="info"
          footer={delta.comparable ? <Delta value={delta.avgScore || 0} /> : <span className="text-muted-foreground">first reading</span>}
        />
        <StatCard
          title="Meetings booked"
          value={`${h.meetingRate ?? 0}%`}
          icon={Target}
          tone="success"
          footer={delta.comparable ? <Delta value={delta.meetingRate || 0} /> : <span className="text-muted-foreground">first reading</span>}
        />
        <StatCard
          title="Agent talk time"
          value={h.agentTalkRatio ? `${h.agentTalkRatio}%` : '—'}
          icon={Swords}
          tone={h.agentTalkRatio > 70 ? 'warning' : 'neutral'}
          description={h.agentTalkRatio > 70 ? 'It is monologuing' : 'of the words spoken'}
        />
      </div>

      <Tabs defaultValue="leaks">
        <TabsList className="flex-wrap">
          <TabsTrigger value="leaks">Why deals leak</TabsTrigger>
          <TabsTrigger value="rubric">What it does well</TabsTrigger>
          <TabsTrigger value="gaps">Gaps &amp; competitors</TabsTrigger>
          <TabsTrigger value="experiments">Script tests</TabsTrigger>
          <TabsTrigger value="digest">Weekly digest</TabsTrigger>
        </TabsList>

        {/* ── Loss reasons ───────────────────────────────────────── */}
        <TabsContent value="leaks" className="space-y-4">
          <Card className="p-5">
            <p className="font-semibold">Why deals did not move</p>
            <p className="text-sm text-muted-foreground">Counted from what the leads actually said on the calls.</p>
            <div className="mt-4 space-y-3">
              {(o.lossReasons || []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Reading the calls…' : 'No reviewed calls in this period yet.'}
                </p>
              )}
              {(o.lossReasons || []).map((r: any) => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={`font-medium ${r.key === 'none' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {r.label}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.share}%</span> · {r.count} calls
                    </span>
                  </div>
                  <Bar percent={r.share} tone={r.key === 'none' ? 'good' : 'bad'} />
                  {!!r.quote && (
                    <p className="flex items-start gap-1.5 pt-0.5 text-xs text-muted-foreground italic">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0" /> {r.quote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!!(o.worstCalls || []).length && (
            <Card className="p-5">
              <p className="font-semibold">Fix these first</p>
              <p className="text-sm text-muted-foreground">The lowest-scoring calls, and the one change each needs.</p>
              <div className="mt-4 space-y-3">
                {o.worstCalls.map((c: any) => (
                  <div key={c.callId} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {c.leadName}
                        {c.company ? <span className="font-normal text-muted-foreground"> · {c.company}</span> : null}
                      </p>
                      <Badge variant={c.score < 40 ? 'destructive' : 'warning'}>{c.score}/100</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.coaching}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.lossLabel} · {formatDate(c.callEndedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Rubric ─────────────────────────────────────────────── */}
        <TabsContent value="rubric" className="space-y-4">
          <Card className="p-5">
            <p className="font-semibold">The rubric</p>
            <p className="text-sm text-muted-foreground">
              What a sales manager would check on every call. Best at the top, worst at the bottom.
            </p>
            <div className="mt-4 space-y-3">
              {(o.rubric || []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No graded calls in this period yet.</p>
              )}
              {(o.rubric || []).map((r: any) => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{r.label}</span>
                    <span className="shrink-0">
                      <span className={`font-semibold ${r.passRate < 50 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                        {r.passRate}%
                      </span>
                      <span className="text-muted-foreground"> of {r.total}</span>
                    </span>
                  </div>
                  <Bar percent={r.passRate} tone={r.passRate >= 70 ? 'good' : r.passRate < 40 ? 'bad' : 'brand'} />
                  {!!r.example && r.passRate < 70 && (
                    <p className="pt-0.5 text-xs text-muted-foreground">{r.example}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!!(o.bestLines || []).length && (
            <Card className="p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Award className="h-4 w-4 text-primary" /> Lines that worked
              </p>
              <p className="text-sm text-muted-foreground">Worth promoting into the script.</p>
              <div className="mt-3 space-y-2">
                {o.bestLines.map((b: any) => (
                  <p key={b.callId} className="rounded-xl border bg-muted/40 p-3 text-sm italic">
                    &ldquo;{b.line}&rdquo;
                  </p>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Gaps ───────────────────────────────────────────────── */}
        <TabsContent value="gaps" className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold">
              <CircleHelp className="h-4 w-4 text-primary" /> Questions it could not answer
            </p>
            <p className="text-sm text-muted-foreground">Add these to the knowledge base and they stop recurring.</p>
            <div className="mt-3 space-y-2">
              {(o.unansweredQuestions || []).length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">Nothing went unanswered. Good.</p>
              )}
              {(o.unansweredQuestions || []).map((q: any) => (
                <div key={q.question} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                  <p className="text-sm">{q.question}</p>
                  <Badge variant="secondary">{q.count}&times;</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Swords className="h-4 w-4 text-primary" /> Who they mentioned
            </p>
            <p className="text-sm text-muted-foreground">Competitors your leads brought up, unprompted.</p>
            <div className="mt-3 space-y-2">
              {(o.competitors || []).length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No competitor came up in this period.</p>
              )}
              {(o.competitors || []).map((c: any) => (
                <div key={c.name} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <p className="text-sm font-medium">{c.name}</p>
                  <Badge variant="secondary">{c.count}&times;</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── Experiments ────────────────────────────────────────── */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Script tests</p>
              <p className="text-sm text-muted-foreground">
                Two openings, split across your calls. The one that books more meetings goes live by itself.
              </p>
            </div>
            <Button variant="gradient" onClick={() => setNewExperiment(true)}>
              <FlaskConical className="h-4 w-4" /> New test
            </Button>
          </div>

          {(expList || []).length === 0 && (
            <Card className="p-10 text-center">
              <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">No script test yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Write a second opening line and let the calls decide which one is better. Nothing changes until one of
                them wins.
              </p>
            </Card>
          )}

          {(expList || []).map((e: any) => (
            <ExperimentCard key={e.id} experiment={e} />
          ))}
        </TabsContent>

        {/* ── Digest ─────────────────────────────────────────────── */}
        <TabsContent value="digest">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">This week&rsquo;s digest</p>
                <p className="text-sm text-muted-foreground">
                  Sent to every admin and sales manager on Monday morning. This is what it says right now.
                </p>
              </div>
              <Button variant="outline" onClick={() => sendDigest.mutate()} disabled={sendDigest.isPending}>
                <Mail className="h-4 w-4" /> Send it now
              </Button>
            </div>

            {dg ? (
              <div className="mt-5 space-y-3 rounded-2xl border bg-muted/30 p-5">
                <p className="text-sm font-semibold">{dg.subject}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Calls reviewed', dg.headline?.reviewed ?? 0],
                    ['Meetings booked', `${dg.headline?.meetingRate ?? 0}%`],
                    ['Call quality', `${dg.headline?.avgScore ?? 0}/100`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-background p-3 text-center">
                      <p className="text-xl font-black">{String(value)}</p>
                      <p className="text-[11px] text-muted-foreground">{String(label)}</p>
                    </div>
                  ))}
                </div>
                {dg.biggestLeak && (
                  <p className="text-sm">
                    <span className="font-semibold">Biggest leak:</span> {dg.biggestLeak.label} —{' '}
                    {dg.biggestLeak.share}% of calls
                  </p>
                )}
                {dg.weakest && (
                  <p className="text-sm">
                    <span className="font-semibold">Weakest skill:</span> {dg.weakest.label.toLowerCase()} on
                    only {dg.weakest.passRate}% of calls
                  </p>
                )}
                {!dg.worthSending && (
                  <p className="text-sm text-muted-foreground">
                    No calls were reviewed this week, so nothing would be sent.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">Building the preview…</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <NewExperimentDialog open={newExperiment} onOpenChange={setNewExperiment} />
    </div>
  );
}

/** One A/B test: the two scripts, their numbers, and who is winning. */
function ExperimentCard({ experiment: e }: { experiment: any }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['revenue-brain'] });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/revenue-brain/experiments/${e.id}`, { status }),
    onSuccess: () => {
      toast.success('Updated');
      invalidate();
    },
  });
  const revert = useMutation({
    mutationFn: () => api.post(`/revenue-brain/experiments/${e.id}/revert`),
    onSuccess: () => {
      toast.success('Script put back to what it was');
      invalidate();
    },
  });

  const tone =
    e.status === 'running' ? 'info' : e.status === 'promoted' ? 'success' : ('secondary' as const);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            {e.name}
            <Badge variant={tone as any} className="capitalize">
              {e.status}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            Testing the <strong>{FIELD_LABEL[e.field] || e.field}</strong> · winner is the one with more{' '}
            <strong>{(METRIC_LABEL[e.metric] || e.metric).toLowerCase()}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {e.status === 'running' && (
            <Button variant="outline" size="sm" onClick={() => setStatus.mutate('stopped')}>
              Stop
            </Button>
          )}
          {e.status === 'stopped' && (
            <Button variant="outline" size="sm" onClick={() => setStatus.mutate('running')}>
              Resume
            </Button>
          )}
          {e.status === 'promoted' && (
            <Button variant="outline" size="sm" onClick={() => revert.mutate()}>
              Undo
            </Button>
          )}
        </div>
      </div>

      {e.status === 'promoted' && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Trophy className="h-4 w-4 shrink-0" />
          Variant {e.winnerKey?.toUpperCase()} won by {e.winnerLiftPoints} points and is now your live script.
        </p>
      )}
      {e.status === 'running' && e.callsToGo > 0 && (
        <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {e.callsToGo} more answered calls before a winner can be called. Below that, a lead means nothing.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(e.variants || []).map((v: any) => {
          const leading = e.leadingKey === v.key;
          const won = e.winnerKey === v.key && e.status === 'promoted';
          return (
            <div
              key={v.key}
              className={`rounded-xl border p-4 ${won || leading ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {v.label}
                  {won && <Trophy className="ml-1.5 inline h-3.5 w-3.5 text-primary" />}
                  {leading && !won && <span className="ml-1.5 text-[11px] font-bold text-primary">LEADING</span>}
                </p>
                <span className="text-lg font-black">{v.score}%</span>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground italic">&ldquo;{v.text}&rdquo;</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                {[
                  ['Calls', v.calls],
                  ['Answered', v.answered],
                  ['Meetings', v.meetings],
                ].map(([l, n]) => (
                  <div key={String(l)} className="rounded-lg bg-muted/60 py-1.5">
                    <p className="text-sm font-bold">{String(n)}</p>
                    <p className="text-muted-foreground">{String(l)}</p>
                  </div>
                ))}
              </div>
              {v.remaining > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">{v.remaining} more answered calls needed</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function NewExperimentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('Opening line test');
  const [field, setField] = useState('greeting');
  const [metric, setMetric] = useState('meetings');
  const [minAnswered, setMinAnswered] = useState('25');
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post('/revenue-brain/experiments', {
        name,
        field,
        metric,
        minAnsweredPerVariant: Number(minAnswered) || 25,
        autoPromote: true,
        variants: [
          { label: 'Variant A', text: a },
          { label: 'Variant B', text: b },
        ],
      }),
    onSuccess: () => {
      toast.success('Test started. Your calls are now split between the two.');
      qc.invalidateQueries({ queryKey: ['revenue-brain'] });
      onOpenChange(false);
      setA('');
      setB('');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not start the test'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New script test</DialogTitle>
          <DialogDescription>
            Your calls are split evenly between the two versions. Once each side has enough answered calls, the better
            one is written into your settings automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>What to test</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Winner is decided by</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Answered calls needed per side</Label>
              <Input
                type="number"
                min={5}
                value={minAnswered}
                onChange={(e) => setMinAnswered(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Below about 20, a winner is usually just luck.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Variant A</Label>
            <Textarea
              rows={3}
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder="Hi {{leadName}}, this is {{agentName}} from {{companyName}}…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Variant B</Label>
            <Textarea
              rows={3}
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="Write the version you think might do better"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={() => create.mutate()}
            disabled={!a.trim() || !b.trim() || create.isPending}
          >
            <Check className="h-4 w-4" /> Start the test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
