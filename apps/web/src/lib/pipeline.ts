/**
 * The sales pipeline, mirrored from the API (`common/constants/pipeline.ts`):
 *
 *   Lead -> Contacted -> Interested -> Follow-up -> Meeting -> Won / Lost
 *
 * Every page that shows or picks a status reads from here.
 */
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'follow_up', 'meeting', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  follow_up: 'Follow-up',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
};

export type BadgeTone = 'default' | 'info' | 'success' | 'warning' | 'destructive' | 'violet' | 'secondary';

export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: 'default',
  contacted: 'info',
  interested: 'warning',
  follow_up: 'violet',
  meeting: 'success',
  won: 'success',
  lost: 'destructive',
};

/** Tailwind accents for kanban columns / pipeline bars. */
export const LEAD_STATUS_COLORS: Record<LeadStatus, { dot: string; bar: string; soft: string }> = {
  new: { dot: 'bg-slate-400', bar: 'bg-slate-400', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  contacted: { dot: 'bg-sky-500', bar: 'bg-sky-500', soft: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  interested: { dot: 'bg-amber-500', bar: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  follow_up: { dot: 'bg-violet-500', bar: 'bg-violet-500', soft: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  meeting: { dot: 'bg-indigo-500', bar: 'bg-indigo-500', soft: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  won: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  lost: { dot: 'bg-rose-500', bar: 'bg-rose-500', soft: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

export const statusLabel = (s?: string) => (s && (LEAD_STATUS_LABELS as any)[s]) || s || '—';
export const statusTone = (s?: string): BadgeTone => (s && (LEAD_STATUS_TONES as any)[s]) || 'secondary';

/** Stages still being worked. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'follow_up', 'meeting'];

// ─── Calls ────────────────────────────────────────────────────────────

export const CALL_OUTCOME_LABELS: Record<string, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  callback: 'Callback requested',
  meeting_booked: 'Meeting booked',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  wrong_number: 'Wrong number',
  busy: 'Busy',
  won: 'Won',
  lost: 'Lost',
  unknown: 'Unclear',
};

export const CALL_OUTCOME_TONES: Record<string, BadgeTone> = {
  interested: 'success',
  not_interested: 'destructive',
  callback: 'warning',
  meeting_booked: 'success',
  no_answer: 'secondary',
  voicemail: 'secondary',
  wrong_number: 'destructive',
  busy: 'secondary',
  won: 'success',
  lost: 'destructive',
  unknown: 'secondary',
};

export const CALL_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  scheduled: 'Scheduled',
  dialing: 'Dialing',
  ringing: 'Ringing',
  in_progress: 'On call',
  transferring: 'Transferring to human',
  completed: 'Completed',
  no_answer: 'No answer',
  busy: 'Busy',
  voicemail: 'Voicemail',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const CALL_STATUS_TONES: Record<string, BadgeTone> = {
  queued: 'secondary',
  scheduled: 'info',
  dialing: 'info',
  ringing: 'info',
  in_progress: 'warning',
  transferring: 'violet',
  completed: 'success',
  no_answer: 'secondary',
  busy: 'secondary',
  voicemail: 'secondary',
  failed: 'destructive',
  cancelled: 'secondary',
};

export const CALL_TYPE_LABELS: Record<string, string> = {
  ai_outbound: 'AI call',
  ai_reengage: 'AI re-engage',
  human_outbound: 'Salesperson call',
  manual: 'Logged call',
};

export const LIVE_CALL_STATUSES = new Set(['queued', 'scheduled', 'dialing', 'ringing', 'in_progress', 'transferring']);

// ─── Tasks ────────────────────────────────────────────────────────────

export const TASK_TYPE_LABELS: Record<string, string> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Meeting',
  other: 'Other',
};

export const TASK_OUTCOMES = [
  { value: 'reached', label: 'Reached - spoke to them' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'meeting_set', label: 'Meeting set' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'won', label: 'Won the deal' },
  { value: 'lost', label: 'Lost the deal' },
  { value: 'note', label: 'Just a note' },
];

export const formatDuration = (seconds?: number) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r.toString().padStart(2, '0')}s` : `${r}s`;
};

/** "in 2h", "3d ago", "now" */
export const relativeTime = (date?: string | Date) => {
  if (!date) return '';
  const diff = new Date(date).getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 60_000 ? 'now' : abs < 3_600_000 ? `${Math.round(abs / 60_000)}m` : abs < 86_400_000 ? `${Math.round(abs / 3_600_000)}h` : `${Math.round(abs / 86_400_000)}d`;
  if (unit === 'now') return 'now';
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
};
