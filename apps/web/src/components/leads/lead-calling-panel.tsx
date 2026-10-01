'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bot, PhoneCall, PhoneOutgoing, StickyNote, ChevronDown, Sparkles, Flame, CalendarClock, Clock, CheckCircle2, AlertTriangle,
  ListChecks, Plus, XCircle, Loader2, Target, MessageSquare, Mail, CalendarDays, Ban,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { cn, formatDate } from '@/lib/utils';
import {
  CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, CALL_TYPE_LABELS, LIVE_CALL_STATUSES, TASK_OUTCOMES, TASK_TYPE_LABELS, formatDuration, relativeTime, statusLabel,
} from '@/lib/pipeline';
import { CallDetailDialog, CallTypeIcon, OutcomeBadge } from '@/components/calls/call-detail';
import type { CallLog, CallingReadiness, FollowUpTask, Lead } from '@/types';

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Log a call (own phone) ───────────────────────────────────────────

export function LogCallDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState('interested');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [callbackAt, setCallbackAt] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/calling/leads/${leadId}/log`, {
        outcome,
        notes: notes.trim() || undefined,
        durationSeconds: duration ? Math.round(Number(duration) * 60) : undefined,
        callbackAt: callbackAt ? new Date(callbackAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      ['lead', 'lead-calls', 'lead-tasks', 'lead-activities', 'calls', 'follow-up-tasks', 'follow-up-task-stats', 'leads'].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      );
      toast.success('Call logged — the AI planned the next step');
      onOpenChange(false);
      setNotes(''); setDuration(''); setCallbackAt('');
    },
    onError: (err: any) => toast.error(err.message || 'Could not log the call'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>Called from your own phone? Tell the AI what happened and it will update the lead and schedule the follow-up.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['interested', 'callback', 'meeting_booked', 'not_interested', 'no_answer', 'busy', 'voicemail', 'wrong_number', 'won', 'lost'].map((o) => (
                    <SelectItem key={o} value={o}>{CALL_OUTCOME_LABELS[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration <span className="text-xs text-muted-foreground">(minutes)</span></Label>
              <Input type="number" min={0} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5" />
            </div>
          </div>
          {(outcome === 'callback' || outcome === 'meeting_booked') && (
            <div className="space-y-1.5">
              <Label>{outcome === 'callback' ? 'Call back at' : 'Meeting at'}</Label>
              <Input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} min={toLocalInput(new Date())} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>What happened? <span className="text-xs text-muted-foreground">(the AI reads this)</span></Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wants a website for their clinic, budget around 50k, decision by month end, asked me to send a proposal on WhatsApp…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {mutation.isPending ? 'Analysing…' : 'Save & plan next step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task dialogs ─────────────────────────────────────────────────────

export function TaskDialog({ leadId, open, onOpenChange, users, defaultAssignee }: { leadId: string; open: boolean; onOpenChange: (o: boolean) => void; users?: any[]; defaultAssignee?: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('call');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState(toLocalInput(new Date(Date.now() + 24 * 3_600_000)));
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || '');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/follow-up-tasks', {
        leadId, title: title.trim(), type, priority, description: description.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(), assignedTo: assignedTo || undefined,
      }),
    onSuccess: () => {
      ['lead', 'lead-tasks', 'lead-activities', 'follow-up-tasks', 'follow-up-task-stats', 'leads', 'leads-pipeline'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Follow-up scheduled');
      onOpenChange(false);
      setTitle(''); setDescription('');
    },
    onError: (err: any) => toast.error(err.message || 'Could not create the task'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a follow-up</DialogTitle>
          <DialogDescription>The assignee is nudged when it comes due; admins are alerted if it slips.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="space-y-1.5">
            <Label>What</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call to confirm the proposal" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'normal', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          {users && users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Lead owner" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!title.trim() || !dueAt || mutation.isPending}><Plus className="h-4 w-4" /> Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteTaskDialog({ task, open, onOpenChange }: { task: FollowUpTask | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState('reached');
  const [note, setNote] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDueAt, setNextDueAt] = useState(toLocalInput(new Date(Date.now() + 2 * 86_400_000)));
  const [nextTitle, setNextTitle] = useState('');

  const mutation = useMutation({
    mutationFn: (skipped: boolean) =>
      api.post(`/follow-up-tasks/${task!._id}/complete`, {
        outcome: skipped ? undefined : outcome,
        note: note.trim() || undefined,
        skipped,
        nextDueAt: !skipped && scheduleNext && nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        nextTitle: !skipped && scheduleNext && nextTitle.trim() ? nextTitle.trim() : undefined,
      }),
    onSuccess: () => {
      ['lead', 'lead-tasks', 'lead-activities', 'follow-up-tasks', 'follow-up-task-stats', 'leads', 'leads-pipeline'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Follow-up updated');
      onOpenChange(false);
      setNote(''); setScheduleNext(false); setNextTitle('');
    },
    onError: (err: any) => toast.error(err.message || 'Could not update the task'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete follow-up</DialogTitle>
          <DialogDescription>{task?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="space-y-1.5">
            <Label>Result</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sent the proposal, waiting for their manager's approval" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border-input" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
            Schedule the next follow-up now
          </label>
          {scheduleNext && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="space-y-1.5 col-span-2">
                <Label>What</Label>
                <Input value={nextTitle} onChange={(e) => setNextTitle(e.target.value)} placeholder="Check if the proposal was approved" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>When</Label>
                <Input type="datetime-local" value={nextDueAt} onChange={(e) => setNextDueAt(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}><Ban className="h-4 w-4" /> Skip</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate(false)} disabled={mutation.isPending}><CheckCircle2 className="h-4 w-4" /> Mark done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Call actions (header buttons) ────────────────────────────────────

export function LeadCallActions({ lead, canCall }: { lead: Lead; canCall: boolean }) {
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [fromPhone, setFromPhone] = useState('');

  const { data: readinessData } = useQuery({
    queryKey: ['calling-readiness'],
    queryFn: () => api.get<any>('/calling/readiness'),
    staleTime: 60_000,
    enabled: canCall,
  });
  const readiness: CallingReadiness | undefined = readinessData?.data;

  const invalidate = () => ['lead', 'lead-calls', 'lead-activities', 'calls', 'leads', 'leads-pipeline'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const aiCall = useMutation({
    mutationFn: () => api.post(`/calling/leads/${lead._id}/ai-call`, {}),
    onSuccess: () => { invalidate(); toast.success('AI is calling the lead now'); },
    onError: (err: any) => toast.error(err.message || 'Could not start the AI call'),
  });
  const bridge = useMutation({
    mutationFn: () => api.post<any>(`/calling/leads/${lead._id}/click-to-call`, { fromPhone: fromPhone.trim() || undefined }),
    onSuccess: (res: any) => { invalidate(); setShowBridge(false); toast.success(res?.data?.message || 'Your phone will ring now'); },
    onError: (err: any) => toast.error(err.message || 'Could not start the call'),
  });

  if (!lead.phone) return null;
  const busy = lead.aiCallStatus === 'calling' || lead.aiCallStatus === 'queued';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="gradient" size="sm" disabled={!canCall}>
            <PhoneCall className="h-4 w-4" /> Call <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => aiCall.mutate()} disabled={aiCall.isPending || busy || (readiness && !readiness.aiCalling.configured)}>
            <Bot className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span>{busy ? (lead.aiCallStatus === 'calling' ? 'AI is on the call…' : 'AI call queued') : 'AI calls the lead now'}</span>
              <span className="text-[11px] text-muted-foreground">{readiness && !readiness.aiCalling.configured ? 'Vapi not configured' : 'Qualifies and books the next step'}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowBridge(true)} disabled={readiness && !readiness.humanCalling.configured}>
            <PhoneOutgoing className="h-4 w-4 text-emerald-600" />
            <div className="flex flex-col">
              <span>Call via LeadBells</span>
              <span className="text-[11px] text-muted-foreground">{readiness && !readiness.humanCalling.configured ? 'Twilio not configured' : 'Rings you first, records & transcribes'}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={`tel:${lead.phone}`}>
              <PhoneCall className="h-4 w-4" />
              <div className="flex flex-col">
                <span>Dial from my phone</span>
                <span className="text-[11px] text-muted-foreground">{lead.phone}</span>
              </div>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowLog(true)}>
            <StickyNote className="h-4 w-4 text-amber-500" />
            <div className="flex flex-col">
              <span>Log a call</span>
              <span className="text-[11px] text-muted-foreground">AI plans the follow-up from your notes</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LogCallDialog leadId={lead._id} open={showLog} onOpenChange={setShowLog} />

      <Dialog open={showBridge} onOpenChange={setShowBridge}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Call via LeadBells</DialogTitle>
            <DialogDescription>We ring your phone first. When you answer, you are connected to {lead.firstName || 'the lead'} and the call is recorded and transcribed for the AI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>Your phone <span className="text-xs text-muted-foreground">(leave empty to use your profile number)</span></Label>
            <Input value={fromPhone} onChange={(e) => setFromPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBridge(false)}>Cancel</Button>
            <Button onClick={() => bridge.mutate()} disabled={bridge.isPending}>{bridge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />} Ring me</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── AI intelligence card ─────────────────────────────────────────────

/** "How should the AI talk to THIS lead" - saved on the lead, read on every call. */
function LeadCallBrief({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const cf = (lead.customFields || {}) as Record<string, any>;
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<string>(cf.aiCallBrief || '');
  const [language, setLanguage] = useState<string>(cf.preferredLanguage || 'default');
  const [requirement, setRequirement] = useState<string>(cf.requirement || '');

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/leads/${lead._id}`, {
        customFields: {
          ...cf,
          aiCallBrief: brief.trim() || undefined,
          preferredLanguage: language === 'default' ? undefined : language,
          requirement: requirement.trim() || undefined,
        },
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead'] }); toast.success('Saved — the AI will use this on the next call'); setOpen(false); },
    onError: (err: any) => toast.error(err.message || 'Could not save'),
  });

  const hasBrief = !!(cf.aiCallBrief || cf.requirement || cf.preferredLanguage);
  if (!open) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed p-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> How the AI talks to this lead</p>
          {hasBrief ? (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {cf.requirement && <><strong>Needs:</strong> {cf.requirement} </>}
              {cf.aiCallBrief && <><strong>Brief:</strong> {cf.aiCallBrief} </>}
              {cf.preferredLanguage && <><strong>Language:</strong> {cf.preferredLanguage}</>}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Adapts automatically to stage, history and description. Add a brief to steer this call specifically.</p>
          )}
        </div>
        {canEdit && <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>{hasBrief ? 'Edit' : 'Add brief'}</Button>}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">What they need <span className="text-muted-foreground">(description)</span></Label>
        <Input value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="Website for a dental clinic, budget ~50k" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Instructions for the AI on this lead</Label>
        <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Very price-sensitive; don't quote numbers, push for a Thursday demo. Speaks Punjabi-Hindi, keep it casual. Mention Rahul spoke to them last week." />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Language for this lead</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Workspace default</SelectItem>
              <SelectItem value="hi-en">Hinglish</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save</Button>
        </div>
      </div>
    </div>
  );
}

export function AiCallInsightsCard({ lead, nextTask, canEdit = true }: { lead: Lead; nextTask?: FollowUpTask | null; canEdit?: boolean }) {
  const i = lead.aiCallInsights;
  const ai = lead.aiCallStatus;
  const overdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary"><Bot className="h-4 w-4" /></div>
          <CardTitle className="text-base font-semibold">AI follow-up engine</CardTitle>
          {ai === 'calling' && <Badge variant="success" dot className="animate-pulse">On the phone</Badge>}
          {ai === 'queued' && <Badge variant="info" dot>Call queued</Badge>}
          {ai === 'failed' && <Badge variant="destructive" dot>Call failed</Badge>}
        </div>
        <CardDescription>What the AI learned on the phone and what happens next.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <LeadCallBrief lead={lead} canEdit={canEdit} />
        <div className={cn('flex items-start gap-3 rounded-xl border p-3', overdue ? 'border-rose-500/40 bg-rose-500/[0.06]' : lead.nextFollowUpAt ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'bg-muted/30')}>
          {overdue ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
          <div className="min-w-0 text-sm">
            {lead.nextFollowUpAt ? (
              <>
                <p className="font-medium">{overdue ? 'Overdue' : 'Next'}: {nextTask?.title || 'Follow-up'} · {relativeTime(lead.nextFollowUpAt)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(lead.nextFollowUpAt)}{nextTask?.description ? ` · ${nextTask.description}` : ''}</p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {ai === 'queued' ? 'The AI will call as soon as the line is free (within calling hours).'
                  : ai === 'calling' ? 'Call in progress — results appear here in a minute.'
                  : lead.status === 'won' || lead.status === 'lost' ? `Lead is ${statusLabel(lead.status)} — automation stopped.`
                  : 'No follow-up scheduled. Trigger an AI call or log one to plan the next step.'}
              </p>
            )}
          </div>
        </div>

        {i?.summary ? (
          <>
            <div className="flex flex-wrap gap-2">
              {typeof i.interestLevel === 'number' && <Badge variant={i.interestLevel >= 70 ? 'destructive' : i.interestLevel >= 40 ? 'warning' : 'info'}><Flame className="h-3 w-3" /> Interest {i.interestLevel}/100</Badge>}
              {i.outcome && <Badge variant="secondary">{CALL_OUTCOME_LABELS[i.outcome] || i.outcome}</Badge>}
              {(lead.callAttempts || 0) > 0 && <Badge variant="outline">{lead.callAttempts} call{lead.callAttempts === 1 ? '' : 's'}</Badge>}
              {i.analysedAt && <span className="text-xs text-muted-foreground self-center">analysed {relativeTime(i.analysedAt)}</span>}
            </div>
            <p className="text-sm leading-relaxed">{i.summary}</p>
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              {i.requirement && <div className="rounded-lg border bg-background/60 p-2"><p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Requirement</p><p className="mt-0.5">{i.requirement}</p></div>}
              {i.budget && <div className="rounded-lg border bg-background/60 p-2"><p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Budget</p><p className="mt-0.5">{i.budget}</p></div>}
              {i.timeline && <div className="rounded-lg border bg-background/60 p-2"><p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Timeline</p><p className="mt-0.5">{i.timeline}</p></div>}
            </div>
            {!!i.objections?.length && <p className="text-xs text-amber-700 dark:text-amber-300"><strong>Objections:</strong> {i.objections.join(' · ')}</p>}
            {i.nextAction && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5 text-emerald-600" /> AI suggested: <span className="font-medium text-foreground">{i.nextAction}</span>{i.nextActionReason ? ` — ${i.nextActionReason}` : ''}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {lead.lastCallOutcome ? `Last call: ${CALL_OUTCOME_LABELS[lead.lastCallOutcome] || lead.lastCallOutcome}${lead.callAttempts ? ` (${lead.callAttempts} attempt${lead.callAttempts === 1 ? '' : 's'})` : ''}.` : 'No call analysed yet.'}
            {lead.reengageAttempts ? ` Re-engaged ${lead.reengageAttempts}×.` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────

export function LeadCallsTab({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CallLog | null>(null);
  const { data } = useQuery({
    queryKey: ['lead-calls', leadId],
    queryFn: () => api.get<any>(`/calling/leads/${leadId}/calls`),
    refetchInterval: (q: any) => ((q.state.data?.data || []).some((c: any) => LIVE_CALL_STATUSES.has(c.status)) ? 4_000 : 20_000),
  });
  const calls: CallLog[] = data?.data || [];
  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/calling/calls/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead-calls'] }); queryClient.invalidateQueries({ queryKey: ['lead'] }); toast.success('Call cancelled'); },
    onError: (err: any) => toast.error(err.message),
  });

  if (calls.length === 0) {
    return <EmptyState compact icon={PhoneCall} title="No calls yet" description="AI calls, bridged calls and logged calls for this lead show up here with recordings and transcripts." />;
  }
  return (
    <>
      <div className="space-y-2">
        {calls.map((c) => {
          const live = LIVE_CALL_STATUSES.has(c.status);
          return (
            <button
              key={c._id}
              type="button"
              onClick={() => !live && setSelected(c)}
              className={cn('group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all', live ? 'cursor-default border-primary/30' : 'hover:border-primary/40 hover:bg-primary/[0.03] cursor-pointer')}
            >
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', c.type.startsWith('ai') ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600')}>
                <CallTypeIcon type={c.type} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{CALL_TYPE_LABELS[c.type] || c.type}</span>
                  <OutcomeBadge outcome={c.outcome} status={c.status} />
                  {live && c.status !== 'in_progress' && c.scheduledAt && <span className="text-xs text-muted-foreground">{c.status === 'scheduled' ? `at ${formatDate(c.scheduledAt)}` : CALL_STATUS_LABELS[c.status]}</span>}
                  {!!c.durationSeconds && <span className="text-xs text-muted-foreground">{formatDuration(c.durationSeconds)}</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.summary || c.notes || c.errorMessage || (live ? (c.status === 'in_progress' ? 'On the call…' : 'Waiting to dial') : 'No summary')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(c.startedAt || c.createdAt)}</span>
                {live && (c.status === 'queued' || c.status === 'scheduled') && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={(e) => { e.stopPropagation(); cancel.mutate(c._id); }}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <CallDetailDialog call={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

const TASK_ICON: Record<string, any> = { call: PhoneCall, whatsapp: MessageSquare, email: Mail, meeting: CalendarDays, other: ListChecks };

export function LeadTasksTab({ leadId, canEdit, users, defaultAssignee }: { leadId: string; canEdit: boolean; users?: any[]; defaultAssignee?: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [completing, setCompleting] = useState<FollowUpTask | null>(null);
  const { data } = useQuery({ queryKey: ['lead-tasks', leadId], queryFn: () => api.get<any>(`/follow-up-tasks/lead/${leadId}`) });
  const tasks: FollowUpTask[] = data?.data || [];
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status !== 'pending');
  const nameOf = (id?: string) => { const u = users?.find((x: any) => x._id === id); return u ? `${u.firstName} ${u.lastName}` : undefined; };

  const Row = ({ t }: { t: FollowUpTask }) => {
    const Icon = TASK_ICON[t.type] || ListChecks;
    const overdue = t.status === 'pending' && new Date(t.dueAt).getTime() < Date.now();
    return (
      <div className={cn('flex items-center gap-3 rounded-xl border bg-card p-3', overdue && 'border-rose-500/40', t.status !== 'pending' && 'opacity-70')}>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', overdue ? 'bg-rose-500/10 text-rose-600' : t.status === 'done' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-violet-500/10 text-violet-600')}>
          {t.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', t.status !== 'pending' && 'line-through')}>{t.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {t.status === 'pending' ? <span className={overdue ? 'font-medium text-rose-600' : ''}>{overdue ? 'Overdue' : 'Due'} {relativeTime(t.dueAt)} · {formatDate(t.dueAt)}</span> : <span className="capitalize">{t.status}{t.outcome ? ` · ${t.outcome.replace(/_/g, ' ')}` : ''}{t.completedAt ? ` · ${formatDate(t.completedAt)}` : ''}</span>}
            {nameOf(t.assignedTo) && <span>· {nameOf(t.assignedTo)}</span>}
            {(t.source === 'ai' || t.source === 'human_call') && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary"><Bot className="h-3 w-3" /> AI</span>
            )}
          </p>
          {(t.description || t.outcomeNote) && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground" title={t.description || t.outcomeNote}>
              {t.description}{t.description && t.outcomeNote ? ' · ' : ''}{t.outcomeNote}
            </p>
          )}
        </div>
        {t.status === 'pending' && canEdit && <Button size="sm" variant="soft" className="h-8" onClick={() => setCompleting(t)}><CheckCircle2 className="h-3.5 w-3.5" /> Done</Button>}
        {t.priority === 'high' || t.priority === 'urgent' ? <Badge variant="warning" className="capitalize">{t.priority}</Badge> : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Schedule follow-up</Button></div>}
      {tasks.length === 0 ? (
        <EmptyState compact icon={ListChecks} title="No follow-ups" description="The AI schedules follow-ups after every call. You can add one by hand too." />
      ) : (
        <>
          {pending.length > 0 && <div className="space-y-2">{pending.map((t) => <Row key={t._id} t={t} />)}</div>}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Clock className="h-3.5 w-3.5" /> History</p>
              {done.map((t) => <Row key={t._id} t={t} />)}
            </div>
          )}
        </>
      )}
      <TaskDialog leadId={leadId} open={showCreate} onOpenChange={setShowCreate} users={users} defaultAssignee={defaultAssignee} />
      <CompleteTaskDialog task={completing} open={!!completing} onOpenChange={(o) => !o && setCompleting(null)} />
    </div>
  );
}
