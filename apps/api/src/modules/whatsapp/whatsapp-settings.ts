/**
 * Per-workspace configuration of the WhatsApp AI agent - the two-way
 * conversation engine that answers leads on WhatsApp, sends pictures, books
 * meetings and collects booking details. Stored on `tenant.whatsappSettings`.
 */

export interface BookingField {
  key: string;
  label: string;
  /** text | number | date | choice | phone | email */
  type: string;
  required: boolean;
  options: string[];
  /** Shown to the AI: how to ask / validate (e.g. "DD-MM-YYYY, must be a future date"). */
  hint: string;
}

export interface BookingForm {
  key: string;
  name: string;
  /** When the AI should start this form ("customer wants to book a flight"). */
  description: string;
  fields: BookingField[];
  /**
   * Fixed payment link (Razorpay page, Stripe link...). Placeholders:
   * {{amount}} {{leadName}} {{phone}} {{bookingId}} plus any field key.
   * Empty = the team adds the link from the Bookings page and it is sent then.
   */
  paymentLink: string;
  /** Extra text sent with the payment link (UPI id, bank details, validity). */
  paymentNote: string;
  /** Who gets the task when a booking is submitted; empty = lead owner / admins. */
  notifyUserId: string;
}

export interface WhatsAppAiSettings {
  enabled: boolean;
  /** Empty = the calling agent's name. */
  agentName: string;
  /** auto | en | hi | hi-en */
  language: string;
  /** Tone, do's and don'ts, what to push for. */
  instructions: string;
  /** Pull answers from the knowledge base. */
  useKnowledgeBase: boolean;
  /** Attach pictures from the media library when relevant. */
  sendMedia: boolean;
  maxMediaPerReply: number;
  /** Let the AI book meetings / callbacks / request an AI call. */
  allowBooking: boolean;
  /** Words that hand the chat to a human straight away. */
  handoffKeywords: string[];
  /** Seconds to wait for follow-on messages before answering (people send 3 short lines). */
  replyDelaySeconds: number;
  /** Stop replying automatically once a human has taken over. */
  pauseWhenHuman: boolean;
  bookings: {
    enabled: boolean;
    forms: BookingForm[];
  };
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppAiSettings = {
  enabled: true,
  agentName: '',
  language: 'auto',
  instructions: '',
  useKnowledgeBase: true,
  sendMedia: true,
  maxMediaPerReply: 3,
  allowBooking: true,
  handoffKeywords: ['human', 'agent', 'real person', 'call me', 'manager', 'insaan', 'baat karni hai'],
  replyDelaySeconds: 3,
  pauseWhenHuman: true,
  bookings: {
    enabled: true,
    forms: [],
  },
};

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v: any, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
const num = (v: any, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const strList = (v: any, d: string[]) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 50) : d;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export function resolveWhatsAppSettings(stored: any): WhatsAppAiSettings {
  const s = isObj(stored) ? stored : {};
  const d = DEFAULT_WHATSAPP_SETTINGS;
  const b = isObj(s.bookings) ? s.bookings : {};
  const forms: BookingForm[] = Array.isArray(b.forms)
    ? b.forms
        .filter((f: any) => isObj(f) && typeof f.name === 'string' && f.name.trim())
        .slice(0, 20)
        .map((f: any) => {
          const key = slug(str(f.key, '') || f.name) || 'form';
          const fields: BookingField[] = Array.isArray(f.fields)
            ? f.fields
                .filter((x: any) => isObj(x) && typeof x.label === 'string' && x.label.trim())
                .slice(0, 30)
                .map((x: any) => ({
                  key: slug(str(x.key, '') || x.label) || 'field',
                  label: x.label.trim(),
                  type: ['text', 'number', 'date', 'choice', 'phone', 'email'].includes(x.type) ? x.type : 'text',
                  required: bool(x.required, true),
                  options: strList(x.options, []),
                  hint: str(x.hint, ''),
                }))
            : [];
          return {
            key,
            name: f.name.trim(),
            description: str(f.description, ''),
            fields,
            paymentLink: str(f.paymentLink, '').trim(),
            paymentNote: str(f.paymentNote, ''),
            notifyUserId: str(f.notifyUserId, ''),
          };
        })
    : d.bookings.forms;

  return {
    enabled: bool(s.enabled, d.enabled),
    agentName: str(s.agentName, d.agentName),
    language: ['auto', 'en', 'hi', 'hi-en'].includes(s.language) ? s.language : d.language,
    instructions: str(s.instructions, d.instructions),
    useKnowledgeBase: bool(s.useKnowledgeBase, d.useKnowledgeBase),
    sendMedia: bool(s.sendMedia, d.sendMedia),
    maxMediaPerReply: num(s.maxMediaPerReply, d.maxMediaPerReply, 0, 5),
    allowBooking: bool(s.allowBooking, d.allowBooking),
    handoffKeywords: strList(s.handoffKeywords, d.handoffKeywords),
    replyDelaySeconds: num(s.replyDelaySeconds, d.replyDelaySeconds, 0, 30),
    pauseWhenHuman: bool(s.pauseWhenHuman, d.pauseWhenHuman),
    bookings: {
      enabled: bool(b.enabled, d.bookings.enabled),
      forms,
    },
  };
}

/** {{placeholders}} in payment links (URL-encoded) and notes (plain). */
export function fillTemplate(template: string, vars: Record<string, any>, encode = false): string {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return '';
    return encode ? encodeURIComponent(String(v)) : String(v);
  });
}
