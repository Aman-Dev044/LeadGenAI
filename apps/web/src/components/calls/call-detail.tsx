'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bot, PhoneCall, Clock, Flame, Target, CalendarClock, MessageSquareText, AlertCircle, Sparkles, Mic, StickyNote, User,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import {
  CALL_OUTCOME_LABELS, CALL_OUTCOME_TONES, CALL_STATUS_LABELS, CALL_STATUS_TONES, CALL_TYPE_LABELS, formatDuration, statusLabel,
} from '@/lib/pipeline';
import type { CallLog } from '@/types';

export function CallTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type === 'ai_outbound' || type === 'ai_reengage' ? Bot : type === 'manual' ? StickyNote : PhoneCall;
  return <Icon className={className || 'h-4 w-4'} />;
}

export function OutcomeBadge({ outcome, status }: { outcome?: string; status?: string }) {
  if (outcome) return <Badge variant={CALL_OUTCOME_TONES[outcome] || 'secondary'} dot>{CALL_OUTCOME_LABELS[outcome] || outcome}</Badge>;
  if (status) return <Badge variant={CALL_STATUS_TONES[status] || 'secondary'} dot>{CALL_STATUS_LABELS[status] || status}</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

/** Transcript rendered as a chat, or the plain text when only that exists. */
function Transcript({ call }: { call: CallLog }) {
  if (call.transcriptSegments?.length) {
    return (
      <div className="space-y-2">
        {call.transcriptSegments.map((seg, i) => {
          const ai = seg.role !== 'lead';
          return (
            <div key={i} className={cn('flex gap-2', ai ? '' : 'flex-row-reverse')}>
              <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ai ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600')}>
                {ai ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed', ai ? 'bg-muted/60 rounded-tl-sm' : 'bg-emerald-500/10 rounded-tr-sm')}>
                {seg.text}
                {typeof seg.at === 'number' && <span className="ml-2 text-[10px] text-muted-foreground tabular">{formatDuration(seg.at)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (call.transcript) {
    return <pre className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 font-sans text-sm leading-relaxed">{call.transcript}</pre>;
  }
  return <p className="text-sm text-muted-foreground">No transcript for this call{call.errorMessage ? ` — ${call.errorMessage}` : '.'}</p>;
}

function NotesForm({ call, onDone }: { call: CallLog; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(call.notes || '');
  const [outcome, setOutcome] = useState(call.outcome || '');
  const mutation = useMutation({
    mutationFn: () => api.post(`/calling/calls/${call._id}/notes`, { notes, outcome: outcome || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['lead-calls'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['lead-tasks'] });
      toast.success('Notes saved — the AI planned the next step');
      onDone();
    },
    onError: (err: any) => toast.error(err.message || 'Could not save notes'),
  });
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3">
      <p className="text-sm font-medium flex items-center gap-1.5"><StickyNote className="h-4 w-4 text-amber-500" /> How did the call go?</p>
      <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interested in the premium plan, asked for a quote by Friday, wants a demo next week…" />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Let the AI decide" /></SelectTrigger>
            <SelectContent>
              {Object.entries(CALL_OUTCOME_LABELS).filter(([k]) => k !== 'unknown').map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!notes.trim() || mutation.isPending}>
          <Sparkles className="h-4 w-4" /> {mutation.isPending ? 'Analysing…' : 'Save & plan next step'}
        </Button>
      </div>
    </div>
  );
}

export function CallDetail({ call, showLead }: { call: CallLog; showLead?: boolean }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const a = call.analysis || {};
  const leadName = call.lead ? [call.lead.firstName, call.lead.lastName].filter(Boolean).join(' ') || call.lead.phone : undefined;
  const needsNotes = call.provider === 'twilio' && call.status === 'completed' && !call.transcript && !call.notes;

  return (
    <div className="space-y-5">
      {/* Header facts */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1"><CallTypeIcon type={call.type} className="h-3 w-3" /> {CALL_TYPE_LABELS[call.type] || call.type}</Badge>
        <OutcomeBadge outcome={call.outcome} status={call.status} />
        {call.outcome && <Badge variant={CALL_STATUS_TONES[call.status] || 'secondary'}>{CALL_STATUS_LABELS[call.status] || call.status}</Badge>}
        {!!call.durationSeconds && <Badge variant="secondary"><Clock className="h-3 w-3" /> {formatDuration(call.durationSeconds)}</Badge>}
        {typeof a.interestLevel === 'number' && (
          <Badge variant={a.interestLevel >= 70 ? 'destructive' : a.interestLevel >= 40 ? 'warning' : 'info'}>
            <Flame className="h-3 w-3" /> Interest {a.interestLevel}/100
          </Badge>
        )}
        {call.attempt > 1 && <Badge variant="secondary">Attempt {call.attempt}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {showLead && leadName && <span className="font-medium text-foreground">{leadName} · </span>}
        {call.toNumber} · {formatDate(call.startedAt || call.createdAt)}
        {call.endedReason && <span> · {call.endedReason.replace(/-/g, ' ')}</span>}
        {typeof call.costUsd === 'number' && <span> · ${call.costUsd.toFixed(3)}</span>}
      </p>

      {call.recordingUrl && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Recording</p>
          <audio controls preload="none" src={call.recordingUrl} className="w-full" />
        </div>
      )}

      {needsNotes && !editingNotes && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /> No transcript — add a note so the AI can plan the follow-up.</span>
          <Button size="sm" variant="outline" onClick={() => setEditingNotes(true)}>Add notes</Button>
        </div>
      )}
      {editingNotes && <NotesForm call={call} onDone={() => setEditingNotes(false)} />}

      {(call.summary || a.nextAction) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {call.summary && (
            <div className="rounded-xl border bg-card p-3.5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI summary</p>
              <p className="text-sm leading-relaxed">{call.summary}</p>
            </div>
          )}
          {a.nextAction && a.nextAction.type !== 'none' && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><Target className="h-3.5 w-3.5" /> Next action</p>
              <p className="text-sm font-medium">{a.nextAction.title}</p>
              {a.nextAction.reason && <p className="mt-0.5 text-xs text-muted-foreground">{a.nextAction.reason}</p>}
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {a.callbackAt ? `Callback at ${formatDate(a.callbackAt)}` : a.meeting?.at ? `Meeting at ${formatDate(a.meeting.at)}` : a.nextAction.dueInHours ? `within ${a.nextAction.dueInHours}h` : ''}
                {a.suggestedStatus && <span> · stage → {statusLabel(a.suggestedStatus)}</span>}
              </p>
            </div>
          )}
        </div>
      )}

      {(a.requirement || a.budget || a.timeline || a.objections?.length || a.keyPoints?.length) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {a.requirement && <Fact label="Requirement" value={a.requirement} />}
          {a.budget && <Fact label="Budget" value={a.budget} />}
          {a.timeline && <Fact label="Timeline" value={a.timeline} />}
          {!!a.objections?.length && <Fact label="Objections" value={a.objections.join(' · ')} tone="amber" />}
          {!!a.keyPoints?.length && <Fact label="Key points" value={a.keyPoints.join(' · ')} className="sm:col-span-2" />}
        </div>
      )}

      {call.actions && Object.keys(call.actions).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pipeline: {[
            call.actions.status && `moved to ${statusLabel(call.actions.status)}`,
            call.actions.assignedTo && 'assigned to a salesperson',
            call.actions.whatsapp && 'WhatsApp sent',
            call.actions.retryAt && `retry ${formatDate(call.actions.retryAt)}`,
            call.actions.taskId && 'follow-up task created',
            call.actions.appointmentId && 'meeting booked',
            call.actions.callbackCallId && 'AI callback scheduled',
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {call.notes && !editingNotes && (
        <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/[0.06] p-3.5 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salesperson notes</p>
          <p className="whitespace-pre-wrap">{call.notes}</p>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" /> Transcript</p>
        <Transcript call={call} />
      </div>
    </div>
  );
}

function Fact({ label, value, tone, className }: { label: string; value: string; tone?: 'amber'; className?: string }) {
  return (
    <div className={cn('rounded-xl border p-3', tone === 'amber' ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'bg-muted/30', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

export function CallDetailDialog({ call, open, onOpenChange, showLead }: { call: CallLog | null; open: boolean; onOpenChange: (o: boolean) => void; showLead?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {call && <CallTypeIcon type={call.type} className="h-5 w-5 text-primary" />} Call details
          </DialogTitle>
          <DialogDescription>Recording, transcript and what the AI decided to do next.</DialogDescription>
        </DialogHeader>
        {call && <CallDetail call={call} showLead={showLead} />}
      </DialogContent>
    </Dialog>
  );
}
