/**
 * Per-workspace configuration of the AI calling + follow-up engine, with the
 * defaults every tenant starts from. Stored on `tenant.callingSettings`.
 */

export interface CallingHours {
  /** "HH:MM" 24h, in the tenant's timezone. */
  start: string;
  end: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
}

export interface AssistantSettings {
  /** How the agent introduces itself. */
  agentName: string;
  companyName: string;
  /** One paragraph: what you sell and to whom. Goes into the system prompt. */
  offerSummary: string;
  /** Extra instructions / objections handling / tone. */
  extraInstructions: string;
  /** Spoken first. Placeholders: {{leadName}}, {{companyName}}, {{agentName}} */
  firstMessage: string;
  /** Questions the agent must get answered before ending the call. */
  qualificationQuestions: string[];
  /** en | hi | hi-en (Hinglish) */
  language: string;
  voiceProvider: string;
  voiceId: string;
  llmModel: string;
  maxDurationSeconds: number;
}

export interface CallingSettings {
  /** Master switch for AI calls. */
  enabled: boolean;
  /** Dial every new lead that has a phone number. */
  autoCallOnNewLead: boolean;
  /** Lead sources to auto-call; empty = all. */
  autoCallSources: string[];
  /** Seconds to wait after creation before the first call (lets imports settle). */
  firstCallDelaySeconds: number;
  callingHours: CallingHours;
  maxAttempts: number;
  retryDelayMinutes: number;
  /** How many AI calls may be in flight at once for this workspace. */
  maxConcurrentCalls: number;
  whatsappOnNoAnswer: boolean;
  whatsappNoAnswerTemplate: string;
  /** interestLevel >= this marks the lead hot and hands it to a salesperson. */
  hotThreshold: number;
  /** Hours the salesperson has to call a hot lead before the task counts as due. */
  hotFollowUpHours: number;
  /** Alert admins when a task is this many hours past due. */
  overdueAlertHours: number;
  /** A worked lead with no activity for this many days is "cold". */
  coldAfterDays: number;
  reengageEnabled: boolean;
  /** ai_call | whatsapp | both */
  reengageChannel: string;
  maxReengageAttempts: number;
  reengageWhatsappTemplate: string;
  /** Record + transcribe salesperson calls bridged through Twilio. */
  recordHumanCalls: boolean;
  /** Live transfer to a human during an AI call. */
  transfer: TransferSettings;
  /** Lead-type specific scripts, first match wins. */
  playbooks: CallPlaybook[];
  /** WhatsApp sent to the lead right after an answered AI call. */
  postCallWhatsapp: {
    enabled: boolean;
    /** After a normal conversation. */
    thankYouTemplate: string;
    /** When a meeting was booked on the call - includes the details. */
    appointmentTemplate: string;
    /** When a callback was agreed. */
    callbackTemplate: string;
  };
  /** Let the AI book meetings / schedule callbacks during the call. */
  inCallBooking: {
    enabled: boolean;
    /** Minutes a booked meeting blocks in the calendar. */
    meetingDurationMinutes: number;
    /** Extra guidance, e.g. "Meetings only Mon-Fri 11am-6pm at our Chandigarh office". */
    instructions: string;
  };
  /** Reminders before a meeting and what happens when the lead does not turn up. */
  appointmentReminders: AppointmentReminderSettings;
  assistant: AssistantSettings;
}

export interface AppointmentReminderSettings {
  enabled: boolean;
  /** WhatsApp (and e-mail when known) to the lead ~24h before. */
  dayBefore: boolean;
  /** WhatsApp to the lead shortly before the meeting. */
  hourBefore: boolean;
  /** How many minutes before the meeting the short reminder goes out. */
  minutesBefore: number;
  /** In-app + push nudge to the salesperson shortly before. */
  remindSalesperson: boolean;
  noShowRescue: {
    enabled: boolean;
    /** Minutes after the start when nobody marked the meeting done: ask the salesperson what happened. */
    askAfterMinutes: number;
    /** Minutes after the start when still unmarked: treat as a no-show automatically (0 = never, manual only). */
    autoMarkAfterMinutes: number;
    /** WhatsApp the lead a "we missed you" message. */
    whatsapp: boolean;
    /** Have the AI call the lead to fix a new time. */
    aiCall: boolean;
    /** Minutes after the no-show before the AI calls. */
    callDelayMinutes: number;
  };
}

/**
 * A different way of calling a certain kind of lead. The first playbook whose
 * `match` fits the lead overrides the default assistant for that call.
 */
export interface CallPlaybook {
  name: string;
  enabled: boolean;
  match: {
    /** Lead sources, e.g. ["import", "widget"]. Empty = any. */
    sources: string[];
    /** Any of these tags on the lead. Empty = any. */
    tags: string[];
    /** Pipeline stages. Empty = any. */
    statuses: string[];
    /** Call reasons: new_lead, retry, callback, reengage, bulk_import, manual, workflow. Empty = any. */
    reasons: string[];
  };
  /** Overrides - empty means "keep the default". */
  agentName: string;
  language: string;
  firstMessage: string;
  /** Extra instructions for this kind of lead (goal, tone, what to push). */
  instructions: string;
}

export interface TransferDestination {
  /** Who picks up - "Rahul", "Sales team", "Support desk". Spoken by the AI. */
  name: string;
  number: string;
  /** When to pick this one - "pricing and new projects", "existing customers". */
  description: string;
}

export interface TransferSettings {
  enabled: boolean;
  /** Default number the call is transferred to (E.164). */
  number: string;
  /** Named people / departments the AI can choose between. */
  destinations: TransferDestination[];
  /** Also try the assigned salesperson's own phone first, when the lead has one. */
  preferAssignedSalesperson: boolean;
  /** What the AI says before transferring. */
  message: string;
  /** When the AI should transfer, in plain words. */
  instructions: string;
}

export const DEFAULT_CALLING_SETTINGS: CallingSettings = {
  enabled: true,
  autoCallOnNewLead: true,
  autoCallSources: [],
  firstCallDelaySeconds: 0,
  callingHours: { start: '09:30', end: '19:00', days: [1, 2, 3, 4, 5, 6] },
  maxAttempts: 3,
  retryDelayMinutes: 180,
  maxConcurrentCalls: 1,
  whatsappOnNoAnswer: true,
  whatsappNoAnswerTemplate:
    'Hi {{leadName}}, this is {{agentName}} from {{companyName}}. I tried calling you about your enquiry. ' +
    'Reply here with a good time and I will call you back, or just let me know what you are looking for.',
  hotThreshold: 70,
  hotFollowUpHours: 2,
  overdueAlertHours: 4,
  coldAfterDays: 5,
  reengageEnabled: true,
  reengageChannel: 'both',
  maxReengageAttempts: 2,
  reengageWhatsappTemplate:
    'Hi {{leadName}}, {{agentName}} here from {{companyName}}. Just checking in - are you still looking for ' +
    'help with this? Happy to answer any questions or set up a quick call.',
  recordHumanCalls: true,
  transfer: {
    enabled: false,
    number: '',
    destinations: [],
    preferAssignedSalesperson: true,
    message: 'Sure, let me connect you to one of our specialists right now. Please hold for a moment.',
    instructions:
      'Transfer when the person clearly asks to speak to a human, wants to negotiate price, or is ready to buy right now. ' +
      'Do not transfer for basic questions you can answer.',
  },
  playbooks: [],
  postCallWhatsapp: {
    enabled: true,
    thankYouTemplate:
      'Hi {{leadName}}, thank you for your time on the call today! 🙏\n' +
      'This is {{agentName}} from {{companyName}}. {{summary}}\n' +
      'If anything comes up, just reply here - happy to help.',
    appointmentTemplate:
      'Hi {{leadName}}, thank you for speaking with us! 🙏 Your appointment is confirmed:\n\n' +
      '📅 {{meetingDate}}\n⏰ {{meetingTime}}\n👤 With: {{salespersonName}}\n📞 {{salespersonPhone}}\n🏢 {{companyName}}\n\n' +
      'Reply here if you need to reschedule. See you then!',
    callbackTemplate:
      'Hi {{leadName}}, thanks for your time! 🙏 As discussed, we will call you back on {{callbackDate}} at {{callbackTime}}.\n' +
      '- {{agentName}}, {{companyName}}',
  },
  inCallBooking: {
    enabled: true,
    meetingDurationMinutes: 30,
    instructions: '',
  },
  appointmentReminders: {
    enabled: true,
    dayBefore: true,
    hourBefore: true,
    minutesBefore: 60,
    remindSalesperson: true,
    noShowRescue: {
      enabled: true,
      askAfterMinutes: 20,
      autoMarkAfterMinutes: 90,
      whatsapp: true,
      aiCall: true,
      callDelayMinutes: 30,
    },
  },
  assistant: {
    agentName: 'Priya',
    companyName: '',
    offerSummary: '',
    extraInstructions: '',
    firstMessage:
      'Hi {{leadName}}, this is {{agentName}} calling from {{companyName}}. You recently enquired with us - ' +
      'is this a good time for a quick two minute chat?',
    qualificationQuestions: [
      'What exactly are they looking for?',
      'When do they want to start?',
      'Do they have a budget in mind?',
      'Who else is involved in the decision?',
    ],
    language: 'hi-en',
    voiceProvider: 'vapi',
    voiceId: 'Neha',
    llmModel: 'gpt-4o-mini',
    maxDurationSeconds: 420,
  },
};

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep-merges what the tenant saved over the defaults, ignoring junk. */
export function resolveCallingSettings(stored: any): CallingSettings {
  const s = isObj(stored) ? stored : {};
  const d = DEFAULT_CALLING_SETTINGS;
  const num = (v: any, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const bool = (v: any, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const str = (v: any, fallback: string) => (typeof v === 'string' ? v : fallback);
  const strList = (v: any, fallback: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : fallback;

  const hours = isObj(s.callingHours) ? s.callingHours : {};
  const a = isObj(s.assistant) ? s.assistant : {};
  const t = isObj(s.transfer) ? s.transfer : {};
  const b = isObj(s.inCallBooking) ? s.inCallBooking : {};
  const w = isObj(s.postCallWhatsapp) ? s.postCallWhatsapp : {};
  const r = isObj(s.appointmentReminders) ? s.appointmentReminders : {};
  const ns = isObj(r.noShowRescue) ? r.noShowRescue : {};
  const dr = d.appointmentReminders;

  return {
    enabled: bool(s.enabled, d.enabled),
    autoCallOnNewLead: bool(s.autoCallOnNewLead, d.autoCallOnNewLead),
    autoCallSources: strList(s.autoCallSources, d.autoCallSources),
    firstCallDelaySeconds: num(s.firstCallDelaySeconds, d.firstCallDelaySeconds, 0, 86400),
    callingHours: {
      start: /^\d{2}:\d{2}$/.test(hours.start) ? hours.start : d.callingHours.start,
      end: /^\d{2}:\d{2}$/.test(hours.end) ? hours.end : d.callingHours.end,
      days: Array.isArray(hours.days)
        ? hours.days.map(Number).filter((x: number) => x >= 0 && x <= 6)
        : d.callingHours.days,
    },
    maxAttempts: num(s.maxAttempts, d.maxAttempts, 1, 10),
    retryDelayMinutes: num(s.retryDelayMinutes, d.retryDelayMinutes, 5, 10080),
    maxConcurrentCalls: num(s.maxConcurrentCalls, d.maxConcurrentCalls, 1, 20),
    whatsappOnNoAnswer: bool(s.whatsappOnNoAnswer, d.whatsappOnNoAnswer),
    whatsappNoAnswerTemplate: str(s.whatsappNoAnswerTemplate, d.whatsappNoAnswerTemplate),
    hotThreshold: num(s.hotThreshold, d.hotThreshold, 1, 100),
    hotFollowUpHours: num(s.hotFollowUpHours, d.hotFollowUpHours, 0.25, 168),
    overdueAlertHours: num(s.overdueAlertHours, d.overdueAlertHours, 0.5, 168),
    coldAfterDays: num(s.coldAfterDays, d.coldAfterDays, 1, 90),
    reengageEnabled: bool(s.reengageEnabled, d.reengageEnabled),
    reengageChannel: ['ai_call', 'whatsapp', 'both'].includes(s.reengageChannel) ? s.reengageChannel : d.reengageChannel,
    maxReengageAttempts: num(s.maxReengageAttempts, d.maxReengageAttempts, 0, 10),
    reengageWhatsappTemplate: str(s.reengageWhatsappTemplate, d.reengageWhatsappTemplate),
    recordHumanCalls: bool(s.recordHumanCalls, d.recordHumanCalls),
    transfer: {
      enabled: bool(t.enabled, d.transfer.enabled),
      number: str(t.number, d.transfer.number).trim(),
      destinations: Array.isArray(t.destinations)
        ? t.destinations
            .filter((x: any) => isObj(x) && typeof x.number === 'string' && x.number.trim())
            .slice(0, 10)
            .map((x: any) => ({
              name: str(x.name, '').trim(),
              number: String(x.number).trim(),
              description: str(x.description, '').trim(),
            }))
        : d.transfer.destinations,
      preferAssignedSalesperson: bool(t.preferAssignedSalesperson, d.transfer.preferAssignedSalesperson),
      message: str(t.message, d.transfer.message),
      instructions: str(t.instructions, d.transfer.instructions),
    },
    playbooks: Array.isArray(s.playbooks)
      ? s.playbooks
          .filter((p: any) => isObj(p) && typeof p.name === 'string' && p.name.trim())
          .slice(0, 20)
          .map((p: any) => {
            const m = isObj(p.match) ? p.match : {};
            const list = (v: any) => strList(v, []).map((x) => x.toLowerCase());
            return {
              name: p.name.trim(),
              enabled: bool(p.enabled, true),
              match: { sources: list(m.sources), tags: list(m.tags), statuses: list(m.statuses), reasons: list(m.reasons) },
              agentName: str(p.agentName, '').trim(),
              language: ['en', 'hi', 'hi-en'].includes(p.language) ? p.language : '',
              firstMessage: str(p.firstMessage, ''),
              instructions: str(p.instructions, ''),
            } as CallPlaybook;
          })
      : d.playbooks,
    postCallWhatsapp: {
      enabled: bool(w.enabled, d.postCallWhatsapp.enabled),
      thankYouTemplate: str(w.thankYouTemplate, d.postCallWhatsapp.thankYouTemplate),
      appointmentTemplate: str(w.appointmentTemplate, d.postCallWhatsapp.appointmentTemplate),
      callbackTemplate: str(w.callbackTemplate, d.postCallWhatsapp.callbackTemplate),
    },
    inCallBooking: {
      enabled: bool(b.enabled, d.inCallBooking.enabled),
      meetingDurationMinutes: num(b.meetingDurationMinutes, d.inCallBooking.meetingDurationMinutes, 10, 240),
      instructions: str(b.instructions, d.inCallBooking.instructions),
    },
    appointmentReminders: {
      enabled: bool(r.enabled, dr.enabled),
      dayBefore: bool(r.dayBefore, dr.dayBefore),
      hourBefore: bool(r.hourBefore, dr.hourBefore),
      minutesBefore: num(r.minutesBefore, dr.minutesBefore, 10, 720),
      remindSalesperson: bool(r.remindSalesperson, dr.remindSalesperson),
      noShowRescue: {
        enabled: bool(ns.enabled, dr.noShowRescue.enabled),
        askAfterMinutes: num(ns.askAfterMinutes, dr.noShowRescue.askAfterMinutes, 5, 720),
        autoMarkAfterMinutes: num(ns.autoMarkAfterMinutes, dr.noShowRescue.autoMarkAfterMinutes, 0, 1440),
        whatsapp: bool(ns.whatsapp, dr.noShowRescue.whatsapp),
        aiCall: bool(ns.aiCall, dr.noShowRescue.aiCall),
        callDelayMinutes: num(ns.callDelayMinutes, dr.noShowRescue.callDelayMinutes, 0, 1440),
      },
    },
    assistant: {
      agentName: str(a.agentName, d.assistant.agentName),
      companyName: str(a.companyName, d.assistant.companyName),
      offerSummary: str(a.offerSummary, d.assistant.offerSummary),
      extraInstructions: str(a.extraInstructions, d.assistant.extraInstructions),
      firstMessage: str(a.firstMessage, d.assistant.firstMessage),
      qualificationQuestions: strList(a.qualificationQuestions, d.assistant.qualificationQuestions),
      language: ['en', 'hi', 'hi-en'].includes(a.language) ? a.language : d.assistant.language,
      voiceProvider: str(a.voiceProvider, d.assistant.voiceProvider),
      voiceId: str(a.voiceId, d.assistant.voiceId),
      llmModel: str(a.llmModel, d.assistant.llmModel),
      maxDurationSeconds: num(a.maxDurationSeconds, d.assistant.maxDurationSeconds, 60, 1800),
    },
  };
}

/** First enabled playbook whose every non-empty match list contains the lead's value. */
export function pickPlaybook(
  playbooks: CallPlaybook[],
  lead: { source?: string; tags?: string[]; status?: string },
  reason: string,
): CallPlaybook | undefined {
  const source = String(lead?.source || 'manual').toLowerCase();
  const tags = (lead?.tags || []).map((t) => String(t).toLowerCase());
  const status = String(lead?.status || 'new').toLowerCase();
  const r = String(reason || '').toLowerCase();
  return playbooks.find((p) => {
    if (!p.enabled) return false;
    const m = p.match;
    if (m.sources.length && !m.sources.includes(source)) return false;
    if (m.statuses.length && !m.statuses.includes(status)) return false;
    if (m.reasons.length && !m.reasons.includes(r)) return false;
    if (m.tags.length && !m.tags.some((t) => tags.includes(t))) return false;
    return true;
  });
}

/** {{leadName}} style placeholders used in messages and the first line of a call. */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return (template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

// ─── Calling hours ────────────────────────────────────────────────────

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday,
  };
}

/** The UTC instant of a wall-clock time in a zone (DST edge cases ignored). */
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = partsInZone(new Date(guess), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess - (asUtc - guess));
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const safeZone = (now: Date, timeZone: string) => {
  try {
    partsInZone(now, timeZone);
    return timeZone;
  } catch {
    return 'UTC';
  }
};

export function isWithinCallingHours(now: Date, hours: CallingHours, timeZone: string): boolean {
  const p = partsInZone(now, safeZone(now, timeZone));
  if (!hours.days.includes(p.weekday)) return false;
  const cur = p.hour * 60 + p.minute;
  return cur >= toMinutes(hours.start) && cur < toMinutes(hours.end);
}

/**
 * `now` when calls are allowed right now, otherwise the next opening moment.
 * Searches at most 8 days ahead; with no allowed day at all it returns `now`
 * so a misconfiguration never silently stalls the queue.
 */
export function nextCallingSlot(now: Date, hours: CallingHours, timeZone: string): Date {
  if (!hours.days.length) return now;
  const tz = safeZone(now, timeZone);
  if (isWithinCallingHours(now, hours, tz)) return now;

  const [sh, sm] = hours.start.split(':').map(Number);
  for (let offset = 0; offset < 8; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const p = partsInZone(probe, tz);
    if (!hours.days.includes(p.weekday)) continue;
    const start = zonedToUtc(p.year, p.month, p.day, sh, sm, tz);
    if (start.getTime() > now.getTime()) return start;
  }
  return now;
}
