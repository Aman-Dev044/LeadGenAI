/**
 * The sales pipeline every lead moves through:
 *
 *   Lead -> Contacted -> Interested -> Follow-up -> Meeting -> Won / Lost
 *
 * `new` is shown as "Lead" in the UI. The stage names are the ones the
 * client's process uses; the older `qualified / unqualified / converted`
 * values are migrated on boot (see LeadService) and accepted nowhere else.
 */
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'follow_up', 'meeting', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Old value -> new stage. Applied once by the boot-time migration. */
export const LEGACY_LEAD_STATUS_MAP: Record<string, LeadStatus> = {
  qualified: 'interested',
  unqualified: 'lost',
  converted: 'won',
  proposal: 'follow_up',
  negotiation: 'meeting',
};

/** Stages where the lead is still being worked (counts toward a salesperson's load). */
export const OPEN_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'follow_up', 'meeting'];

/** Stages the AI may move a lead into on its own; Won/Lost stay a human decision after a human call. */
export const AI_ASSIGNABLE_STATUSES: LeadStatus[] = ['contacted', 'interested', 'follow_up', 'meeting', 'lost'];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  follow_up: 'Follow-up',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
};

export const isLeadStatus = (value: unknown): value is LeadStatus =>
  typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);

/** Accepts a new or legacy value and returns the current stage, or undefined. */
export const normalizeLeadStatus = (value: unknown): LeadStatus | undefined => {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (isLeadStatus(v)) return v;
  return LEGACY_LEAD_STATUS_MAP[v];
};
