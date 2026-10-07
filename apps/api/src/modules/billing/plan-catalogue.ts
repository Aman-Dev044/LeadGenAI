/**
 * What a workspace gets for its money - the single source of truth for pricing,
 * quotas and features. The dashboard, the landing page and every limit check
 * read from here, so a number is changed in exactly one place.
 *
 * Prices are in rupees per month, EXCLUDING GST. GST is added at checkout.
 */

export const CURRENCY = 'INR';
export const GST_RATE = 0.18;
/** A yearly subscription is charged for ten months. */
export const YEARLY_MONTHS = 10;
/** Everybody starts here: the full product, no card, for two weeks. */
export const TRIAL_DAYS = 14;

export type PlanId = 'trial' | 'basic' | 'standard' | 'premium' | 'pro' | 'custom';

/** -1 means unlimited. */
export interface PlanQuota {
  /** AI voice calls a month - the headline number. */
  aiCalls: number;
  leads: number;
  users: number;
  /** WhatsApp messages the platform sends on the workspace's behalf. */
  whatsappMessages: number;
  /** Website chat agents (the widget bots). */
  agents: number;
  knowledgeSources: number;
}

export interface PlanFeatures {
  aiTranscription: boolean;
  personalisedWhatsapp: boolean;
  appointmentReminders: boolean;
  twoWayWhatsapp: boolean;
  inboundReceptionist: boolean;
  liveTransfer: boolean;
  whatsappBookings: boolean;
  googleCalendar: boolean;
  playbooks: boolean;
  leadScoring: boolean;
  analytics: boolean;
  apiWebhooks: boolean;
  prospecting: boolean;
  ownSmtp: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export interface PlanSpec {
  id: PlanId;
  name: string;
  tagline: string;
  /** Rupees a month, excluding GST. */
  priceMonthly: number;
  priceYearly: number;
  quota: PlanQuota;
  features: PlanFeatures;
  /** Shown on the pricing cards, in order. */
  highlights: string[];
  popular?: boolean;
}

const noFeatures: PlanFeatures = {
  aiTranscription: false,
  personalisedWhatsapp: false,
  appointmentReminders: false,
  twoWayWhatsapp: false,
  inboundReceptionist: false,
  liveTransfer: false,
  whatsappBookings: false,
  googleCalendar: false,
  playbooks: false,
  leadScoring: false,
  analytics: false,
  apiWebhooks: false,
  prospecting: false,
  ownSmtp: false,
  whiteLabel: false,
  prioritySupport: false,
};

/** Every feature on - what the trial hands out, and what Pro keeps. */
const allFeatures: PlanFeatures = Object.fromEntries(
  Object.keys(noFeatures).map((k) => [k, true]),
) as unknown as PlanFeatures;

export const PLAN_CATALOGUE: Record<Exclude<PlanId, 'custom'>, PlanSpec> = {
  trial: {
    id: 'trial',
    name: 'Free trial',
    tagline: `Everything switched on for ${TRIAL_DAYS} days. No card needed.`,
    priceMonthly: 0,
    priceYearly: 0,
    // Enough to feel the product work end to end, not enough to run a business on
    quota: { aiCalls: 10, leads: 200, users: 3, whatsappMessages: 100, agents: 2, knowledgeSources: 10 },
    features: allFeatures,
    highlights: [
      `${TRIAL_DAYS} days free, every feature unlocked`,
      '10 AI calls to try the agent on your own leads',
      'No card, no commitment',
    ],
  },

  basic: {
    id: 'basic',
    name: 'Basic',
    tagline: 'For a solo owner who wants the AI to make the first call.',
    priceMonthly: 444,
    priceYearly: 444 * YEARLY_MONTHS,
    quota: { aiCalls: 5, leads: 500, users: 2, whatsappMessages: 200, agents: 1, knowledgeSources: 5 },
    features: {
      ...noFeatures,
      aiTranscription: true,
      personalisedWhatsapp: true,
      appointmentReminders: true,
    },
    highlights: [
      '5 AI calls a month',
      'Every call recorded, transcribed and summarised',
      'Personalised WhatsApp after each call',
      '500 leads · 2 team members',
      'Pipeline, follow-up tasks and appointment reminders',
      'Excel / CSV import and the website chat widget',
    ],
  },

  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'For a small sales team that lives on WhatsApp.',
    priceMonthly: 700,
    priceYearly: 700 * YEARLY_MONTHS,
    quota: { aiCalls: 15, leads: 2000, users: 5, whatsappMessages: 1000, agents: 3, knowledgeSources: 20 },
    features: {
      ...noFeatures,
      aiTranscription: true,
      personalisedWhatsapp: true,
      appointmentReminders: true,
      twoWayWhatsapp: true,
      googleCalendar: true,
      playbooks: true,
    },
    highlights: [
      '15 AI calls a month',
      'Two-way WhatsApp AI - it answers your customers, not just messages them',
      'Google Calendar sync and no-show rescue',
      '2,000 leads · 5 team members · 1,000 WhatsApp messages',
      'Call playbooks for different kinds of leads',
    ],
    popular: true,
  },

  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'For a team that must not miss a single enquiry.',
    priceMonthly: 1500,
    priceYearly: 1500 * YEARLY_MONTHS,
    quota: { aiCalls: 40, leads: 10000, users: 15, whatsappMessages: 5000, agents: 10, knowledgeSources: 50 },
    features: {
      ...noFeatures,
      aiTranscription: true,
      personalisedWhatsapp: true,
      appointmentReminders: true,
      twoWayWhatsapp: true,
      inboundReceptionist: true,
      liveTransfer: true,
      whatsappBookings: true,
      googleCalendar: true,
      playbooks: true,
      leadScoring: true,
      analytics: true,
      apiWebhooks: true,
    },
    highlights: [
      '40 AI calls a month',
      'Inbound AI receptionist - the AI answers your number 24x7',
      'Live transfer to a salesperson while the caller is on the line',
      'Bookings and payment links on WhatsApp',
      '10,000 leads · 15 team members · 5,000 WhatsApp messages',
      'Lead scoring, analytics, API and webhooks',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For an agency or a multi-branch business.',
    priceMonthly: 2400,
    priceYearly: 2400 * YEARLY_MONTHS,
    quota: { aiCalls: 75, leads: -1, users: 50, whatsappMessages: 20000, agents: -1, knowledgeSources: 200 },
    features: allFeatures,
    highlights: [
      '75 AI calls a month',
      'Unlimited leads and unlimited chat agents',
      'Leads Scrap AI - find prospects, not just answer them',
      'Send every e-mail from your own address (your SMTP)',
      'Your logo and name across the dashboard',
      '50 team members · 20,000 WhatsApp messages · priority support',
    ],
  },
};

/** What a workspace pays per unit when it builds its own plan, or goes over. */
export const UNIT_PRICES = {
  /** Flat monthly fee the custom plan starts at. */
  base: 299,
  aiCall: 39,
  /** Per block of 500 leads. */
  leadsPer500: 99,
  user: 99,
  /** Per block of 1,000 WhatsApp messages. */
  whatsappPer1000: 249,
  agent: 149,
  addons: {
    inboundReceptionist: 499,
    prospecting: 399,
    whiteLabel: 999,
  },
} as const;

/** Nobody can build a custom plan cheaper than Basic. */
export const CUSTOM_MIN_MONTHLY = PLAN_CATALOGUE.basic.priceMonthly;

export interface CustomPlanChoice {
  aiCalls: number;
  leads: number;
  users: number;
  whatsappMessages: number;
  agents: number;
  inboundReceptionist: boolean;
  prospecting: boolean;
  whiteLabel: boolean;
  billingInterval?: 'monthly' | 'yearly';
}

export interface PriceLine {
  label: string;
  detail: string;
  amount: number;
}

export interface Quote {
  lines: PriceLine[];
  subtotal: number;
  gstRate: number;
  gst: number;
  total: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  /** Months charged for - 10 on yearly, so two are free. */
  months: number;
  quota: PlanQuota;
  features: PlanFeatures;
}

const clamp = (n: any, lo: number, hi: number, fallback = lo) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Price a plan the customer built themselves, line by line, GST included. */
export function quoteCustomPlan(raw: Partial<CustomPlanChoice>): Quote {
  const choice: CustomPlanChoice = {
    aiCalls: clamp(raw.aiCalls, 0, 5000, 25),
    leads: clamp(raw.leads, 500, 500000, 1000),
    users: clamp(raw.users, 1, 500, 3),
    whatsappMessages: clamp(raw.whatsappMessages, 0, 500000, 1000),
    agents: clamp(raw.agents, 0, 200, 1),
    inboundReceptionist: !!raw.inboundReceptionist,
    prospecting: !!raw.prospecting,
    whiteLabel: !!raw.whiteLabel,
    billingInterval: raw.billingInterval === 'yearly' ? 'yearly' : 'monthly',
  };

  const leadBlocks = Math.ceil(choice.leads / 500);
  const waBlocks = Math.ceil(choice.whatsappMessages / 1000);

  const lines: PriceLine[] = [
    { label: 'Platform', detail: 'Pipeline, tasks, appointments, dashboard', amount: UNIT_PRICES.base },
    { label: 'AI calls', detail: `${choice.aiCalls} calls x ₹${UNIT_PRICES.aiCall}`, amount: choice.aiCalls * UNIT_PRICES.aiCall },
    { label: 'Leads', detail: `${choice.leads.toLocaleString('en-IN')} leads (${leadBlocks} x 500)`, amount: leadBlocks * UNIT_PRICES.leadsPer500 },
    { label: 'Team members', detail: `${choice.users} x ₹${UNIT_PRICES.user}`, amount: choice.users * UNIT_PRICES.user },
  ];
  if (choice.whatsappMessages > 0) {
    lines.push({
      label: 'WhatsApp messages',
      detail: `${choice.whatsappMessages.toLocaleString('en-IN')} messages (${waBlocks} x 1,000)`,
      amount: waBlocks * UNIT_PRICES.whatsappPer1000,
    });
  }
  if (choice.agents > 0) {
    lines.push({ label: 'Chat agents', detail: `${choice.agents} x ₹${UNIT_PRICES.agent}`, amount: choice.agents * UNIT_PRICES.agent });
  }
  if (choice.inboundReceptionist) {
    lines.push({ label: 'Inbound AI receptionist', detail: 'The AI answers calls that come in', amount: UNIT_PRICES.addons.inboundReceptionist });
  }
  if (choice.prospecting) {
    lines.push({ label: 'Leads Scrap AI', detail: 'Find new prospects automatically', amount: UNIT_PRICES.addons.prospecting });
  }
  if (choice.whiteLabel) {
    lines.push({ label: 'White label', detail: 'Your logo and name everywhere', amount: UNIT_PRICES.addons.whiteLabel });
  }

  let monthly = lines.reduce((sum, l) => sum + l.amount, 0);
  if (monthly < CUSTOM_MIN_MONTHLY) {
    lines.push({ label: 'Minimum plan adjustment', detail: `Custom plans start at ₹${CUSTOM_MIN_MONTHLY} a month`, amount: CUSTOM_MIN_MONTHLY - monthly });
    monthly = CUSTOM_MIN_MONTHLY;
  }

  const months = choice.billingInterval === 'yearly' ? YEARLY_MONTHS : 1;
  const subtotal = round(monthly * months);
  const gst = round(subtotal * GST_RATE);

  return {
    lines,
    subtotal,
    gstRate: GST_RATE,
    gst,
    total: round(subtotal + gst),
    currency: CURRENCY,
    billingInterval: choice.billingInterval!,
    months,
    quota: {
      aiCalls: choice.aiCalls,
      leads: choice.leads,
      users: choice.users,
      whatsappMessages: choice.whatsappMessages,
      agents: choice.agents,
      knowledgeSources: Math.max(10, choice.agents * 10),
    },
    features: {
      ...noFeatures,
      aiTranscription: true,
      personalisedWhatsapp: true,
      appointmentReminders: true,
      twoWayWhatsapp: true,
      googleCalendar: true,
      playbooks: true,
      leadScoring: true,
      analytics: true,
      apiWebhooks: true,
      ownSmtp: true,
      inboundReceptionist: choice.inboundReceptionist,
      liveTransfer: choice.inboundReceptionist,
      whatsappBookings: true,
      prospecting: choice.prospecting,
      whiteLabel: choice.whiteLabel,
      prioritySupport: choice.whiteLabel,
    },
  };
}

/** Price one of the ready-made plans, GST included. */
export function quotePlan(planId: PlanId, billingInterval: 'monthly' | 'yearly' = 'monthly'): Quote {
  const spec = PLAN_CATALOGUE[planId as Exclude<PlanId, 'custom'>] || PLAN_CATALOGUE.basic;
  const months = billingInterval === 'yearly' ? YEARLY_MONTHS : 1;
  const subtotal = round(spec.priceMonthly * months);
  const gst = round(subtotal * GST_RATE);
  return {
    lines: [
      {
        label: `${spec.name} plan`,
        detail: billingInterval === 'yearly' ? `12 months, billed for ${YEARLY_MONTHS}` : 'One month',
        amount: subtotal,
      },
    ],
    subtotal,
    gstRate: GST_RATE,
    gst,
    total: round(subtotal + gst),
    currency: CURRENCY,
    billingInterval,
    months,
    quota: spec.quota,
    features: spec.features,
  };
}

/** Older workspaces still carry the first naming - map them onto the new plans. */
const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  free: 'trial',
  starter: 'basic',
  professional: 'premium',
  enterprise: 'pro',
};

export function normalisePlanId(plan?: string): PlanId {
  const p = String(plan || '').toLowerCase();
  if (p in PLAN_CATALOGUE) return p as PlanId;
  if (p === 'custom') return 'custom';
  return LEGACY_PLAN_MAP[p] || 'trial';
}

/** The quota a workspace is actually entitled to right now. */
export function quotaFor(plan?: string, customQuota?: Partial<PlanQuota> | null): PlanQuota {
  const id = normalisePlanId(plan);
  if (id === 'custom' && customQuota) {
    const base = PLAN_CATALOGUE.basic.quota;
    return {
      aiCalls: customQuota.aiCalls ?? base.aiCalls,
      leads: customQuota.leads ?? base.leads,
      users: customQuota.users ?? base.users,
      whatsappMessages: customQuota.whatsappMessages ?? base.whatsappMessages,
      agents: customQuota.agents ?? base.agents,
      knowledgeSources: customQuota.knowledgeSources ?? base.knowledgeSources,
    };
  }
  return PLAN_CATALOGUE[(id === 'custom' ? 'basic' : id) as Exclude<PlanId, 'custom'>].quota;
}

export function featuresFor(plan?: string, customFeatures?: Partial<PlanFeatures> | null): PlanFeatures {
  const id = normalisePlanId(plan);
  if (id === 'custom' && customFeatures) return { ...noFeatures, ...customFeatures };
  return PLAN_CATALOGUE[(id === 'custom' ? 'basic' : id) as Exclude<PlanId, 'custom'>].features;
}

/** Plans as the pricing page shows them. */
export function publicPlans(): PlanSpec[] {
  return [PLAN_CATALOGUE.basic, PLAN_CATALOGUE.standard, PLAN_CATALOGUE.premium, PLAN_CATALOGUE.pro];
}

export const FEATURE_LABELS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'aiTranscription', label: 'Call recording, transcript and AI summary' },
  { key: 'personalisedWhatsapp', label: 'Personalised WhatsApp after every call' },
  { key: 'appointmentReminders', label: 'Meeting reminders and no-show rescue' },
  { key: 'twoWayWhatsapp', label: 'Two-way WhatsApp AI (it replies to customers)' },
  { key: 'googleCalendar', label: 'Google Calendar sync' },
  { key: 'playbooks', label: 'Call playbooks per lead type' },
  { key: 'inboundReceptionist', label: 'Inbound AI receptionist (24x7)' },
  { key: 'liveTransfer', label: 'Live transfer to a salesperson' },
  { key: 'whatsappBookings', label: 'Bookings and payment links on WhatsApp' },
  { key: 'leadScoring', label: 'Lead scoring' },
  { key: 'analytics', label: 'Analytics and reports' },
  { key: 'apiWebhooks', label: 'API access and webhooks' },
  { key: 'prospecting', label: 'Leads Scrap AI (find new prospects)' },
  { key: 'ownSmtp', label: 'Send e-mail from your own address' },
  { key: 'whiteLabel', label: 'Your logo and name across the dashboard' },
  { key: 'prioritySupport', label: 'Priority support' },
];
