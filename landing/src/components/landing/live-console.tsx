'use client';

import { useEffect, useState } from 'react';
import { Bot, Calendar, MessageCircle, Mic, PhoneCall, PhoneForwarded, User } from 'lucide-react';
import { BRAND } from '@/lib/brand';

/**
 * The hero centrepiece: a looping, non-interactive replay of one AI phone call.
 *
 * A lead is added, the agent dials, the conversation fills in on the left while
 * the call record builds on the right — interest climbing, requirement and
 * budget landing, the meeting booking itself mid-call, and the WhatsApp
 * confirmation going out the moment the call ends. Nothing responds to input,
 * so it reads as a screen recording rather than a demo the visitor must drive.
 *
 * Marked `aria-hidden`: decorative proof; a screen reader walking a transcript
 * that restarts every fifteen seconds would be noise.
 */

type Turn = { from: 'lead' | 'agent'; text: string };

const TRANSCRIPT: Turn[] = [
  { from: 'agent', text: 'Hi Rohit ji, Priya bol rahi hoon Cyberbells se. Aapne clinic ki website ke liye enquiry ki thi — 2 minute hain?' },
  { from: 'lead', text: 'Haan bolo. Website chahiye, online appointment booking ke saath.' },
  { from: 'agent', text: 'Perfect. Budget approx kya soch rahe hain, aur kab tak chahiye?' },
  { from: 'lead', text: 'Around 50k. Diwali se pehle live ho jaye.' },
  { from: 'agent', text: 'Ho jayega. Kal 11 baje Rahul ji se 20 minute ki call fix kar dun? Woh demo dikha denge.' },
  { from: 'lead', text: 'Haan, kal 11 theek hai.' },
  { from: 'agent', text: 'Book ho gaya — kal 11:00 AM, Rahul ke saath. Details WhatsApp pe bhej rahi hoon. Thank you Rohit ji!' },
];

const CALL_FIELDS = [
  { at: 2, label: 'Requirement', value: 'Clinic website + booking' },
  { at: 4, label: 'Budget', value: '₹50,000' },
  { at: 4, label: 'Timeline', value: 'Before Diwali' },
  { at: 6, label: 'Meeting', value: 'Tomorrow · 11:00 AM' },
];

// Timeline of the loop, in ticks of 1.6s
const RING_TICKS = 2; // 0-1: dialing
const TOTAL = RING_TICKS + TRANSCRIPT.length + 3; // + booked, + whatsapp, + hold

export function LiveConsole() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t >= TOTAL ? 0 : t + 1)), 1600);
    return () => clearInterval(id);
  }, []);

  const ringing = tick < RING_TICKS;
  const step = Math.max(0, tick - RING_TICKS);
  const visible = TRANSCRIPT.slice(0, step);
  const talking = !ringing && step < TRANSCRIPT.length;
  const ended = step >= TRANSCRIPT.length;
  const booked = step >= TRANSCRIPT.length;
  const whatsapp = step >= TRANSCRIPT.length + 1;
  const interest = ringing ? 0 : Math.min(92, Math.round((step / TRANSCRIPT.length) * 92));
  const seconds = ringing ? 0 : Math.min(step, TRANSCRIPT.length) * 19;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div
      aria-hidden="true"
      className="lit-border rounded-3xl border border-border/70 bg-card/85 p-2 shadow-float backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          {BRAND.name.toLowerCase()} · ai call · lead #4821
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase transition-colors duration-500 ${
            ended
              ? 'bg-slate-500/12 text-muted-foreground'
              : ringing
                ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {!ended && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-current" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          )}
          {ringing ? 'dialing' : ended ? 'call ended' : `on call · ${mm}:${ss}`}
        </span>
      </div>

      <div className="grid gap-2 rounded-2xl bg-background/60 p-2 sm:grid-cols-[1.2fr_1fr]">
        {/* Transcript */}
        <div className="flex min-h-[320px] flex-col gap-2 rounded-xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <PhoneCall className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <p className="text-[11.5px] font-bold">Rohit Sharma · +91 98•••• 4310</p>
              <p className="text-[9.5px] text-muted-foreground">Excel import → “clinic website, booking”</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              <Mic className="h-2.5 w-2.5" /> Hinglish
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-1.5">
            {ringing && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-primary/30" />
                  <PhoneCall className="relative h-5 w-5" />
                </span>
                <p className="text-[11px] font-semibold">Calling lead · 4s after it was added</p>
              </div>
            )}
            {visible.map((turn, i) => (
              <div
                key={`${turn.from}-${i}`}
                className={`animate-tick-up flex max-w-[92%] items-end gap-1.5 ${
                  turn.from === 'agent' ? 'self-start' : 'self-end flex-row-reverse'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    turn.from === 'agent' ? 'bg-brand-gradient text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {turn.from === 'agent' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                </span>
                <div
                  className={`rounded-2xl px-2.5 py-1.5 text-[11px] leading-snug ${
                    turn.from === 'agent'
                      ? 'rounded-bl-md bg-brand-gradient text-white shadow-sm shadow-primary/25'
                      : 'rounded-br-md bg-muted text-foreground'
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))}
            {talking && (
              <div className="flex items-center gap-1.5 self-start pl-7">
                <span className="flex h-4 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((d) => (
                    <span
                      key={d}
                      className="w-0.5 animate-bounce rounded-full bg-primary/70"
                      style={{ height: `${6 + (d % 3) * 4}px`, animationDelay: `${d * 90}ms` }}
                    />
                  ))}
                </span>
                <span className="text-[9.5px] text-muted-foreground">listening…</span>
              </div>
            )}
            {whatsapp && (
              <div className="animate-tick-up mt-1 flex items-center gap-2 self-end rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <div className="leading-tight">
                  <p className="text-[10.5px] font-bold">WhatsApp sent to lead</p>
                  <p className="text-[9px] text-muted-foreground">Thank you + meeting details · Rahul · +91 98•••• 0021</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Call record the agent is writing */}
        <div className="flex min-h-[320px] flex-col gap-2.5 rounded-xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <p className="text-[10px] font-black tracking-[0.12em] text-muted-foreground uppercase">
              Call record
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider uppercase transition-colors duration-500 ${
                interest > 70
                  ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                  : interest > 40
                    ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-500/12 text-muted-foreground'
              }`}
            >
              {interest > 70 ? 'Hot' : interest > 40 ? 'Warm' : 'Cold'}
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">Interest level</span>
              <span className="tabular text-xl font-black">{interest}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-[900ms] ease-out"
                style={{ width: `${interest}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {CALL_FIELDS.map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5"
              >
                <span className="text-[9.5px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {field.label}
                </span>
                {step >= field.at ? (
                  <span className="animate-tick-up truncate text-[10.5px] font-bold">{field.value}</span>
                ) : (
                  <span className="h-2.5 w-16 rounded-full bg-muted" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-1.5">
            <div
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all duration-500 ${
                booked
                  ? 'border-emerald-500/30 bg-emerald-500/10 opacity-100'
                  : 'border-border/50 bg-muted/40 opacity-45'
              }`}
            >
              <Calendar
                className={`h-4 w-4 shrink-0 ${booked ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
              />
              <div className="leading-tight">
                <p className="text-[10.5px] font-bold">
                  {booked ? 'Meeting booked · Tomorrow 11:00 AM' : 'Books the meeting mid-call'}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {booked ? 'Assigned to Rahul · task + calendar created' : 'Once the lead agrees a time'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
              <PhoneForwarded className="h-3.5 w-3.5 shrink-0" />
              <p className="text-[9.5px] font-semibold">Live transfer to a human available on request</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
