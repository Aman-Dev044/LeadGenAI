'use client';
import { useState } from 'react';
import { Flame, Bot, Clock, AlertTriangle, PhoneCall, ChevronDown, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn, getInitials } from '@/lib/utils';
import {
  LEAD_STATUSES, LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, statusLabel, relativeTime, CALL_OUTCOME_LABELS,
} from '@/lib/pipeline';
import type { Lead } from '@/types';

type Stage = { status: string; label: string; count: number; leads: Partial<Lead>[] };

const tempColors: Record<string, 'destructive' | 'warning' | 'info'> = { hot: 'destructive', warm: 'warning', cold: 'info' };

const leadName = (l: Partial<Lead>) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || l.phone || 'Unnamed lead';

/** Compact "what the automation is doing" line, shared by the table and the board. */
export function FollowUpCell({ lead }: { lead: Partial<Lead> }) {
  const next = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const overdue = next && next.getTime() < Date.now();
  const ai = lead.aiCallStatus;

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {next ? (
        <span className={cn('inline-flex items-center gap-1 font-medium', overdue ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
          {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
          {overdue ? 'Overdue' : 'Follow-up'} {relativeTime(next)}
        </span>
      ) : lead.lastCallOutcome ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <PhoneCall className="h-3 w-3" /> {CALL_OUTCOME_LABELS[lead.lastCallOutcome] || lead.lastCallOutcome}
        </span>
      ) : null}
      {ai && ai !== 'none' && ai !== 'done' && (
        <span className={cn('inline-flex items-center gap-1', ai === 'calling' ? 'text-emerald-600 dark:text-emerald-400' : ai === 'failed' ? 'text-rose-500' : 'text-muted-foreground')}>
          <Bot className="h-3 w-3" />
          {ai === 'queued' ? 'AI call queued' : ai === 'calling' ? 'AI on call' : ai === 'failed' ? 'AI call failed' : 'AI skipped'}
        </span>
      )}
      {!next && (!ai || ai === 'none' || ai === 'done') && !lead.lastCallOutcome && <span className="text-muted-foreground">—</span>}
    </div>
  );
}

function LeadCard({ lead, onOpen, onMove }: { lead: Partial<Lead>; onOpen: (id: string) => void; onMove?: (id: string, status: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead._id!)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(lead._id!)}
      className={cn(
        'group rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer',
        overdue && 'border-rose-500/40',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-[11px]">{getInitials(leadName(lead))}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{leadName(lead)}</p>
          {lead.company && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" /> {lead.company}
            </p>
          )}
        </div>
        {lead.temperature && (
          <Badge variant={tempColors[lead.temperature] || 'secondary'} className="h-5 px-1.5 text-[10px]">
            <Flame className="h-2.5 w-2.5" /> {lead.temperature}
          </Badge>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <FollowUpCell lead={lead} />
        {onMove && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="inline-flex h-6 items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Move to stage"
              >
                Move <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(lead._id!, s)} className="text-xs">
                  <span className={cn('mr-2 h-2 w-2 rounded-full', LEAD_STATUS_COLORS[s].dot)} />
                  {LEAD_STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/**
 * Kanban of the pipeline: one column per stage, most recently active leads on
 * top. Cards open the lead; the "Move" menu changes the stage.
 */
export function PipelineBoard({
  stages, loading, onOpen, onMove,
}: {
  stages: Stage[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onMove?: (id: string, status: string) => void;
}) {
  const ordered = LEAD_STATUSES.map((s) => stages.find((st) => st.status === s) || { status: s, label: statusLabel(s), count: 0, leads: [] });
  const total = ordered.reduce((n, s) => n + s.count, 0);

  return (
    <div className="space-y-4">
      {/* Funnel strip */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {ordered.map((s) => {
          const pct = total ? (s.count / total) * 100 : 0;
          return pct > 0 ? <div key={s.status} className={cn('h-full', LEAD_STATUS_COLORS[s.status as keyof typeof LEAD_STATUS_COLORS]?.bar)} style={{ width: `${pct}%` }} title={`${s.label}: ${s.count}`} /> : null;
        })}
      </div>

      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3 px-1">
          {ordered.map((stage) => {
            const colors = LEAD_STATUS_COLORS[stage.status as keyof typeof LEAD_STATUS_COLORS];
            return (
              <div key={stage.status} className="flex w-[268px] shrink-0 flex-col rounded-2xl border bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', colors?.dot)} />
                    <span className="text-sm font-semibold">{stage.label}</span>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tabular', colors?.soft)}>{stage.count}</span>
                </div>
                <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)
                  ) : stage.leads.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">No leads here</p>
                  ) : (
                    stage.leads.map((lead) => <LeadCard key={lead._id} lead={lead} onOpen={onOpen} onMove={onMove} />)
                  )}
                  {!loading && stage.count > stage.leads.length && (
                    <p className="px-1 pt-1 text-center text-[11px] text-muted-foreground">+{stage.count - stage.leads.length} more · use the table view</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
