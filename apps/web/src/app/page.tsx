'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Database,
  FileSearch,
  Flame,
  Gauge,
  Github,
  Globe2,
  KeyRound,
  Layers,
  LineChart,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Moon,
  Phone,
  Plug,
  Radar,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Logo, LogoMark, PoweredBy } from '@/components/brand/logo';
import { BRAND, COMPANY } from '@/lib/brand';

/* ==========================================================================
   Primitives
   ========================================================================== */

/** Thin gradient bar that tracks how far down the page the reader is. */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * Fade + lift on first scroll into view. Opacity and a small translate only, so
 * nothing reflows and the page never jumps while it settles.
 */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[650ms] ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Counts up once, when scrolled into view. */
function useCountUp(end: number, duration = 1500) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return;
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          setValue(Math.round((1 - Math.pow(1 - p, 3)) * end));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  return { ref, value };
}

/**
 * Swaps one word in place. Words render stacked in a single grid cell so the box
 * is always as wide as the longest one — the line never reflows.
 */
function WordRotate({ words, className = '' }: { words: string[]; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <span className={`grid ${className}`}>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent transition-all duration-500 ${
            i === index
              ? 'translate-y-0 opacity-100 blur-0'
              : 'pointer-events-none -translate-y-1.5 opacity-0 blur-[3px]'
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

/** Small label above every section heading. */
function Eyebrow({
  icon: Icon,
  children,
  className = '',
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[10.5px] font-black tracking-[0.13em] text-primary uppercase ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/* ==========================================================================
   Hero: the live console
   A looping, non-interactive replay of one conversation — the chat fills in on
   the left while the agent writes the lead record on the right.
   ========================================================================== */

type Turn = { from: 'visitor' | 'agent'; text: string };

const TRANSCRIPT: Turn[] = [
  { from: 'visitor', text: 'Do you integrate with HubSpot? We run a 40-seat sales team.' },
  { from: 'agent', text: 'Yes — two-way sync. Every qualified lead lands in your pipeline in seconds.' },
  { from: 'visitor', text: "We're evaluating this quarter. Budget is around $2k/mo." },
  { from: 'agent', text: 'Noted. Our architect has Thursday 2:00 PM open — shall I hold it?' },
  { from: 'visitor', text: 'Yes please. sarah@northwind.io' },
  { from: 'agent', text: 'Booked. Invite sent, and your rep has been notified.' },
];

const LEAD_FIELDS = [
  { at: 5, label: 'Contact', value: 'Sarah Whitfield' },
  { at: 1, label: 'Company', value: 'Northwind Logistics' },
  { at: 3, label: 'Budget', value: '$2,000 / mo' },
  { at: 3, label: 'Timeline', value: 'This quarter' },
];

function LiveConsole() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s >= TRANSCRIPT.length + 1 ? 0 : s + 1)), 1800);
    return () => clearInterval(id);
  }, []);

  const visible = TRANSCRIPT.slice(0, step);
  const score = Math.min(94, Math.round((step / TRANSCRIPT.length) * 94));
  const booked = step > TRANSCRIPT.length;

  return (
    <div className="lit-border rounded-3xl border border-border/70 bg-card/85 p-2 shadow-float backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          {BRAND.name.toLowerCase()} · live console
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-black text-emerald-600 uppercase dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          live
        </span>
      </div>

      <div className="grid gap-2 rounded-2xl bg-background/60 p-2 sm:grid-cols-[1.2fr_1fr]">
        {/* Transcript */}
        <div className="flex min-h-[300px] flex-col gap-2 rounded-xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <p className="text-[11.5px] font-bold">Visitor · Chicago, IL</p>
              <p className="text-[9.5px] text-muted-foreground">Google Ads → /pricing</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-1.5">
            {visible.map((turn, i) => (
              <div
                key={`${turn.from}-${i}`}
                className={`animate-tick-up max-w-[90%] rounded-2xl px-2.5 py-1.5 text-[11px] leading-snug ${
                  turn.from === 'agent'
                    ? 'self-start rounded-bl-md bg-brand-gradient text-white shadow-sm shadow-primary/25'
                    : 'self-end rounded-br-md bg-muted text-foreground'
                }`}
              >
                {turn.text}
              </div>
            ))}
            {step < TRANSCRIPT.length && (
              <div className="self-start rounded-2xl rounded-bl-md bg-muted px-3 py-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${d * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Lead record the agent is writing */}
        <div className="flex min-h-[300px] flex-col gap-2.5 rounded-xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <p className="text-[10px] font-black tracking-[0.12em] text-muted-foreground uppercase">
              Lead record
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider uppercase transition-colors duration-500 ${
                score > 75
                  ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                  : score > 40
                    ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-500/12 text-muted-foreground'
              }`}
            >
              {score > 75 ? 'Hot' : score > 40 ? 'Warm' : 'Cold'}
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">Intent score</span>
              <span className="tabular text-xl font-black">{score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-[900ms] ease-out"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {LEAD_FIELDS.map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5"
              >
                <span className="text-[9.5px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {field.label}
                </span>
                {step >= field.at ? (
                  <span className="animate-tick-up truncate text-[10.5px] font-bold">
                    {field.value}
                  </span>
                ) : (
                  <span className="h-2.5 w-16 rounded-full bg-muted" />
                )}
              </div>
            ))}
          </div>

          <div
            className={`mt-auto flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all duration-500 ${
              booked
                ? 'border-emerald-500/30 bg-emerald-500/10 opacity-100'
                : 'border-border/50 bg-muted/40 opacity-45'
            }`}
          >
            <Calendar
              className={`h-4 w-4 shrink-0 ${
                booked ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}
            />
            <div className="leading-tight">
              <p className="text-[10.5px] font-bold">
                {booked ? 'Demo booked · Thu 2:00 PM' : 'Awaiting qualification'}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {booked ? 'Invite sent · rep pinged' : 'Books once intent clears 75'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Data
   ========================================================================== */

const CHANNELS_IN = [
  { icon: MessageSquare, label: 'Website chat' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Mail, label: 'Email' },
  { icon: Phone, label: 'SMS' },
  { icon: MapPin, label: 'Google Maps' },
  { icon: Radio, label: 'Reddit' },
  { icon: FileSearch, label: 'Hacker News' },
  { icon: Github, label: 'GitHub' },
  { icon: Building2, label: 'Public tenders' },
  { icon: Globe2, label: 'Quora & web' },
];

const CHANNELS_OUT = [
  'HubSpot', 'Salesforce', 'Slack', 'Zapier', 'Calendly', 'Twilio',
  'Stripe', 'Gmail', 'Webhooks', 'REST API', 'Google Calendar', 'Zoom',
];

const HERO_PROOF = [
  { value: '2 min', label: 'to go live' },
  { value: '24/7', label: 'always answering' },
  { value: '0', label: 'leads missed' },
];

const STATS = [
  { value: 3, suffix: 'x', label: 'More booked demos', sub: 'vs. a static contact form' },
  { value: 68, suffix: '%', label: 'Of chats qualified', sub: 'scored and routed automatically' },
  { value: 2, suffix: 's', label: 'Median reply time', sub: 'day, night, weekend, holiday' },
  { value: 100, suffix: '%', label: 'Of visitors greeted', sub: 'nobody leaves unanswered' },
];

const WITHOUT = [
  'A contact form nobody fills in',
  'First reply lands 14 hours later',
  'Night and weekend traffic is simply lost',
  'Reps guess which lead to call first',
  'Outbound lists bought, stale on arrival',
  'No idea which campaign actually paid',
];

const WITH = [
  'An agent that answers the real question',
  'Median first reply under two seconds',
  '3 a.m. visitors get booked, not bounced',
  'Every lead scored hot, warm or cold on arrival',
  'Prospects found the day they start looking',
  'Referrer, UTM and device on every record',
];

const STEPS = [
  {
    icon: Plug,
    title: 'Drop in one script',
    text: 'A single tag on your site and the widget is live. No rebuild, no dev sprint.',
    meta: '~2 minutes',
  },
  {
    icon: Database,
    title: 'Teach it your business',
    text: 'Upload PDFs, decks, price sheets or paste a URL. It answers inside your own docs.',
    meta: 'Vector-indexed',
  },
  {
    icon: MessageSquare,
    title: 'Let it work the traffic',
    text: 'It greets, answers, captures the lead and scores intent while the chat is still running.',
    meta: 'Runs 24/7',
  },
  {
    icon: Target,
    title: 'Wake up to pipeline',
    text: 'Hot leads routed, meetings booked, follow-ups sent, CRM already in sync.',
    meta: 'Zero touch',
  },
];

const BENTO = [
  {
    icon: Brain,
    title: 'An agent that actually closes',
    text: 'GPT-4o and Claude with real tool calling — it captures the lead, updates its status and books the meeting mid-sentence, instead of promising someone will be in touch.',
    span: 'lg:col-span-2 lg:row-span-2',
    accent: true,
  },
  {
    icon: Database,
    title: 'Grounded in your docs',
    text: 'Vector-indexed knowledge base. Answers cite your material, never invented.',
    span: '',
  },
  {
    icon: Gauge,
    title: 'Live intent scoring',
    text: 'Hot, warm and cold ranked from what the visitor actually says.',
    span: '',
  },
  {
    icon: Users,
    title: 'Human takeover, mid-chat',
    text: 'The agent hands off the moment a person should take it. Your rep drops into the live thread with full context — the visitor never notices a seam.',
    span: 'lg:col-span-2',
  },
  {
    icon: Workflow,
    title: 'Follow-ups on autopilot',
    text: 'Email, SMS and WhatsApp sequences fire on created, changed or gone quiet.',
    span: '',
  },
  {
    icon: LineChart,
    title: 'Attribution that adds up',
    text: 'Referrer, UTM, device and path on every lead — you know which spend paid.',
    span: '',
  },
  {
    icon: Calendar,
    title: 'Books its own meetings',
    text: 'Availability checked, invite sent, rep notified — inside the conversation.',
    span: '',
  },
  {
    icon: Bell,
    title: 'Rings the right person',
    text: 'Routing by score, source and team, with realtime desktop and Slack alerts.',
    span: '',
  },
];

const LEAD_ROWS = [
  { name: 'Sarah Whitfield', company: 'Northwind Logistics', source: 'Website chat', score: 94, status: 'Hot', when: '2m' },
  { name: 'Diego Marín', company: 'Marín Auto Care', source: 'Google Maps', score: 81, status: 'Hot', when: '11m' },
  { name: 'u/buildfast', company: 'r/smallbusiness', source: 'Reddit', score: 76, status: 'Hot', when: '24m' },
  { name: 'Ayesha Khan', company: 'Bluepeak Studio', source: 'WhatsApp', score: 62, status: 'Warm', when: '1h' },
  { name: 'Tom Alvarez', company: 'Ridgeline Dental', source: 'Google Maps', score: 58, status: 'Warm', when: '2h' },
  { name: 'City of Aarhus', company: 'Tender #DK-4471', source: 'Public tenders', score: 44, status: 'Warm', when: '3h' },
];

const DASHBOARD_POINTS = [
  'One inbox for every source — inbound chat and outbound prospecting side by side',
  'Scores, owners, statuses and SLA timers on the same row',
  'Full conversation, page path and UTM behind every lead',
  'Filter, bulk-assign and export without leaving the table',
];

const OUTBOUND = [
  {
    icon: Radar,
    kicker: 'AI Automation',
    title: 'Sweep Google Maps for businesses that just opened',
    text: 'Pick categories and cities. The AI finds newly listed businesses with no website, scores each 0-100 for fit and drafts the opener — grounded in their own reviews.',
    points: [
      'Newness inferred from review counts, review age and first-seen deltas',
      'Every prospect links back to its real listing before you reach out',
      'Promote the ones you trust straight into Leads',
    ],
    chips: ['Dentists · Austin', 'Gyms · Pune', 'Cafés · Lisbon'],
  },
  {
    icon: Radio,
    kicker: 'Leads Scrap AI',
    title: 'Catch people asking for what you sell, in public',
    text: '"Need a developer for…" gets posted a thousand times a day. Reddit, Hacker News, Quora, Stack Exchange, GitHub, Bluesky and tender feeds are swept for buying intent.',
    points: [
      'Every source runs on a free tier — no scraping bill to approve',
      'AI drafts the outreach in the poster’s own context',
      'Review queue first: nothing enters your pipeline unread',
    ],
    chips: ['“need a CRM”', '“shopify dev”', '“build me an app”'],
  },
];

const ENTERPRISE = [
  { icon: Layers, label: 'Multi-tenant isolation', text: 'Every workspace in its own logical boundary.' },
  { icon: ShieldCheck, label: 'Role-based access', text: 'Admin, sales manager and agent scopes.' },
  { icon: Activity, label: 'Full audit trail', text: 'Who did what, to which record, from where.' },
  { icon: KeyRound, label: 'Your own API keys', text: 'Bring your AI, SMTP, storage and SERP accounts.' },
  { icon: Globe2, label: 'Webhooks & REST API', text: 'Push every event into your own stack.' },
  { icon: Compass, label: 'Owner console', text: 'Cross-tenant control, usage and health in one place.' },
];

const TESTIMONIALS = [
  {
    quote:
      'We replaced a contact form nobody filled in. Inbound demos went from 42 to 178 in the first month — not one extra rupee of ad spend.',
    name: 'Marcus Reed',
    role: 'VP Revenue',
    company: 'Northwind Logistics',
    metric: '+324% demos',
  },
  {
    quote:
      'The handoff is the part I did not expect to love. My reps join a conversation already three questions deep, with budget and timeline on screen.',
    name: 'Priya Nair',
    role: 'Head of Sales',
    company: 'Trellis Software',
    metric: '9 min saved / lead',
  },
  {
    quote:
      'Leads Scrap AI found eleven people publicly asking for exactly what we build, in one afternoon. Two of them are customers now.',
    name: 'Daniel Okafor',
    role: 'Founder',
    company: 'Bluepeak Studio',
    metric: '2 deals in 3 weeks',
  },
];

const FAQS = [
  {
    q: 'How long does it actually take to go live?',
    a: 'Under ten minutes. Paste one script tag into your site, point the agent at your website URL or upload a few documents, and it starts answering. Nothing to rebuild, no engineering ticket.',
  },
  {
    q: 'Will the AI make things up about my product?',
    a: 'It answers from your knowledge base — PDFs, decks, pricing sheets, crawled pages — and is instructed to stay inside it. When something is not covered it says so and offers a human instead of guessing.',
  },
  {
    q: 'Can a real person take over a conversation?',
    a: 'Yes. The agent raises a handoff the moment a person should take it, or a rep can jump in unprompted. The live thread, the lead record and the full history are already on screen.',
  },
  {
    q: 'Whose AI keys does it use?',
    a: 'Either. Run on the platform defaults, or point the workspace at your own OpenAI, Anthropic, SMTP, Twilio, storage and SERP accounts from Settings → API Credentials. Keys are encrypted at rest and never returned to the browser.',
  },
  {
    q: 'What happens to my leads and chat data?',
    a: 'They stay in your workspace, isolated at the database level from every other tenant, with role-based access and a complete audit trail. Export or delete them whenever you want.',
  },
  {
    q: 'Does outbound prospecting cost extra?',
    a: 'No. Google Maps prospecting uses your own Places key, and every Leads Scrap AI source runs on a free tier. You approve every prospect in a review queue before it touches your pipeline.',
  },
  {
    q: 'Can I use my own branding on the widget?',
    a: 'Yes — colours, greeting, avatar, position and tone are all per agent, and you can run different agents on different pages or sites.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes — one agent, 100 leads and 500 conversations a month, no card required. Paid plans add agents, volume, users and CRM sync.',
  },
];

const PLANS = [
  {
    name: 'Free',
    tagline: 'Try the basics',
    monthly: 0,
    yearly: 0,
    features: ['1 Agent', '100 Leads', '500 Conversations/mo', '5 Knowledge Sources', '2 Users', 'Community Support'],
    cta: 'Get started free',
    variant: 'outline' as const,
    popular: false,
  },
  {
    name: 'Starter',
    tagline: 'For small teams',
    monthly: 29,
    yearly: 279,
    features: ['3 Agents', '1,000 Leads', '2,000 Conversations/mo', '20 Knowledge Sources', '5 Users', 'WhatsApp & Email Support'],
    cta: 'Start 14-day trial',
    variant: 'outline' as const,
    popular: false,
  },
  {
    name: 'Professional',
    tagline: 'Most popular',
    monthly: 79,
    yearly: 759,
    features: ['10 Agents', '10,000 Leads', '10,000 Conversations/mo', '50 Knowledge Sources', '20 Users', 'Priority Support & CRM Sync'],
    cta: 'Start 14-day trial',
    variant: 'gradient' as const,
    popular: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Scale without limits',
    monthly: 199,
    yearly: 1910,
    features: ['50 Agents', '100,000 Leads', '50,000 Conversations/mo', '200 Knowledge Sources', '100 Users', 'Custom SLA & Dedicated Manager'],
    cta: 'Contact sales',
    variant: 'outline' as const,
    popular: false,
  },
];

const PLAN_EXTRAS = [
  { icon: ShieldCheck, label: 'No setup fee, ever' },
  { icon: Zap, label: 'Every feature on every plan' },
  { icon: Clock, label: 'Cancel or switch anytime' },
  { icon: KeyRound, label: 'Bring your own AI keys' },
];

/* ==========================================================================
   Page
   ========================================================================== */

export default function LandingPage() {
  const { theme, setTheme } = useUIStore();
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const heroRef = useRef<HTMLElement>(null);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const stat0 = useCountUp(STATS[0].value);
  const stat1 = useCountUp(STATS[1].value);
  const stat2 = useCountUp(STATS[2].value);
  const stat3 = useCountUp(STATS[3].value);
  const statRefs = [stat0, stat1, stat2, stat3];

  /* Cursor spotlight over the hero — written to CSS vars so React never
     re-renders on mouse move. */
  const onHeroMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const node = heroRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    node.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      <ScrollProgress />

      {/* ---------------------------------------------------------------- */}
      {/* Ambient backdrop                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,#000_25%,transparent_75%)]" />
        <div className="animate-aurora absolute -top-40 left-[10%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/20 blur-[110px]" />
        <div
          className="animate-aurora absolute -top-24 right-[6%] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/16 blur-[110px]"
          style={{ animationDelay: '-6s' }}
        />
        <div
          className="animate-aurora absolute top-[55%] left-[42%] h-[24rem] w-[24rem] rounded-full bg-violet-500/12 blur-[120px]"
          style={{ animationDelay: '-11s' }}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Navigation                                                        */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
            <span className="leading-none">
              <span className="block text-lg font-extrabold tracking-tight">
                Lead<span className="text-gradient">Bells</span>
              </span>
              <span className="mt-0.5 hidden text-[9px] font-bold tracking-[0.13em] text-muted-foreground uppercase sm:block">
                {BRAND.tagline}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-muted-foreground lg:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#inbox" className="transition-colors hover:text-foreground">The inbox</a>
            <a href="#outbound" className="transition-colors hover:text-foreground">Outbound AI</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-[13px] font-semibold">Sign in</Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="gradient" size="sm" className="gap-1.5 text-[13px] font-bold">
                Start free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero — two columns so the full width is actually used              */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-10 pb-10 sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(460px circle at var(--spot-x, 70%) var(--spot-y, 25%), color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 70%)',
          }}
        />

        <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_1fr] lg:gap-10">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-[11.5px] font-bold text-primary backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Autonomous AI agents — inbound &amp; outbound
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
                  v2.4
                </span>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-black tracking-tight sm:text-6xl lg:text-[4rem]">
                AI Leads Follow up,
                <br />
                tracking &amp;{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                    calling software.
                  </span>
                  <span className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-35" />
                </span>
              </h1>
            </Reveal>

            <Reveal delay={110}>
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] font-bold tracking-[0.11em] text-muted-foreground uppercase lg:justify-start">
                <span>Ringing in from</span>
                <WordRotate
                  words={['your website', 'WhatsApp', 'Google Maps', 'Reddit & HN', 'public tenders']}
                />
              </p>
            </Reveal>

            <Reveal delay={160}>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground lg:mx-0">
                {BRAND.taglineLong} One agent greets every visitor, answers from your own documents,
                scores their intent and books the meeting — before your team has read the alert.
              </p>
            </Reveal>

            <Reveal delay={210}>
              <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row lg:justify-start">
                <Link href="/auth/register" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="gradient"
                    className="group h-12 w-full gap-2 px-7 text-[15px] font-bold sm:w-auto"
                  >
                    Start free — no card
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <a href="#inbox" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="h-12 w-full gap-2 px-7 text-[15px] font-bold sm:w-auto">
                    <Activity className="h-4 w-4" /> See the inbox
                  </Button>
                </a>
              </div>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-7 grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
                {HERO_PROOF.map((proof) => (
                  <div key={proof.label} className="text-center lg:text-left">
                    <p className="text-xl font-black tracking-tight">{proof.value}</p>
                    <p className="text-[10.5px] font-semibold text-muted-foreground">{proof.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11.5px] text-muted-foreground lg:justify-start">
                <span className="flex -space-x-2">
                  {['MR', 'PN', 'DO', 'AK'].map((initials, i) => (
                    <span
                      key={initials}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-brand-gradient text-[8.5px] font-black text-white"
                      style={{ opacity: 1 - i * 0.12 }}
                    >
                      {initials}
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </span>
                <span className="font-semibold">Trusted by revenue teams in 14 countries</span>
              </div>
            </Reveal>
          </div>

          {/* Console + floating cards */}
          <Reveal delay={150} className="relative">
            <LiveConsole />

            <div className="animate-float pointer-events-none absolute -top-4 -left-3 hidden rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl xl:block">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/12 text-rose-500">
                  <Flame className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11px] font-bold">New hot lead · 94</p>
                  <p className="text-[9.5px] text-muted-foreground">Northwind Logistics</p>
                </div>
              </div>
            </div>

            <div
              className="animate-float pointer-events-none absolute -right-3 -bottom-4 hidden rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl xl:block"
              style={{ animationDelay: '-3s' }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-500">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11px] font-bold">Demo booked · Thu 2:00 PM</p>
                  <p className="text-[9.5px] text-muted-foreground">Invite sent automatically</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Channel strip — two marquees: what rings in, what it syncs out to  */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 border-y border-border/50 bg-muted/20 py-5">
        <div className="mx-auto mb-3 flex w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <p className="text-[10px] font-black tracking-[0.18em] text-muted-foreground uppercase">
            Leads ring in from
          </p>
          <p className="text-[10px] font-black tracking-[0.18em] text-muted-foreground uppercase">
            And sync out to
          </p>
        </div>

        <div className="relative space-y-2.5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          <div className="animate-marquee-x flex w-max gap-2.5 px-4">
            {[...CHANNELS_IN, ...CHANNELS_IN].map((channel, i) => (
              <span
                key={`in-${channel.label}-${i}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-1.5 text-[12px] font-bold whitespace-nowrap backdrop-blur-sm"
              >
                <channel.icon className="h-3.5 w-3.5 text-primary" />
                {channel.label}
              </span>
            ))}
          </div>

          <div
            className="animate-marquee-x flex w-max gap-2.5 px-4"
            style={{ animationDirection: 'reverse', animationDuration: '46s' }}
          >
            {[...CHANNELS_OUT, ...CHANNELS_OUT].map((name, i) => (
              <span
                key={`out-${name}-${i}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Stats                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 70}>
              <div className="lit-border h-full rounded-2xl border border-border/60 bg-card/65 p-4 backdrop-blur-sm sm:p-5">
                <div className="flex items-baseline gap-0.5">
                  <span ref={statRefs[i].ref} className="tabular text-3xl font-black tracking-tight sm:text-4xl">
                    {statRefs[i].value}
                  </span>
                  <span className="text-xl font-black text-primary sm:text-2xl">{stat.suffix}</span>
                </div>
                <p className="mt-1.5 text-[12.5px] font-bold">{stat.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Before / after split                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <Eyebrow icon={Bell}>The gap</Eyebrow>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Most of your traffic never rings at all
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              A form, an inbox and a rep who signs off at six — everything that arrives after that
              simply leaves. {BRAND.name} answers all of it, scores it, and puts it in one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['No lead left unanswered', 'No 14-hour first reply', 'No guessing who to call'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-[11.5px] font-semibold text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            <Reveal delay={80}>
              <div className="h-full rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/12 text-rose-500">
                    <X className="h-4 w-4" />
                  </span>
                  <p className="text-[12.5px] font-black tracking-wide uppercase">Without</p>
                </div>
                <ul className="space-y-2">
                  {WITHOUT.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500/70" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="lit-border h-full rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/8 to-card/70 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <LogoMark className="h-8 w-8" />
                  <p className="text-[12.5px] font-black tracking-wide uppercase">With {BRAND.name}</p>
                </div>
                <ul className="space-y-2">
                  {WITH.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12.5px]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-foreground/85">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="how" className="relative z-10 scroll-mt-20 border-y border-border/50 bg-muted/15 py-12">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <Eyebrow icon={Workflow}>From script tag to signed deal</Eyebrow>
              <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                Four steps. Then it runs without you.
              </h2>
            </div>
            <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
              {BRAND.name} is live the same afternoon you sign up — and keeps working through the
              night, the weekend and every holiday your competitors take off.
            </p>
          </Reveal>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute top-12 right-12 left-12 hidden h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent lg:block" />
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 90}>
                <div className="lit-border group relative h-full rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/25">
                      <step.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="tabular text-2xl font-black text-muted-foreground/20">0{i + 1}</span>
                  </div>
                  <h3 className="text-[14.5px] font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.text}</p>
                  <p className="mt-3 inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-black tracking-wider text-primary uppercase">
                    {step.meta}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Platform bento                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="platform" className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Eyebrow icon={Layers}>The platform</Eyebrow>
            <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Everything between <span className="text-gradient">a visitor</span> and{' '}
              <span className="text-gradient">a signature</span>
            </h2>
          </div>
          <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Not a chatbot with a form bolted on. A complete revenue loop — capture, qualify, route,
            follow up, measure — in one workspace.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-3 lg:grid-cols-4">
          {BENTO.map((cell, i) => (
            <Reveal key={cell.title} delay={i * 60} className={cell.span}>
              <div
                className={`lit-border group flex h-full flex-col rounded-2xl border border-border/60 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${
                  cell.accent
                    ? 'bg-gradient-to-br from-primary/10 via-card/80 to-violet-500/10'
                    : 'bg-card/70'
                }`}
              >
                <span
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
                    cell.accent
                      ? 'bg-brand-gradient text-white shadow-md shadow-primary/25'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  <cell.icon className="h-4.5 w-4.5" />
                </span>
                <h3 className={`font-bold ${cell.accent ? 'text-lg' : 'text-[14px]'}`}>{cell.title}</h3>
                <p
                  className={`mt-1.5 leading-relaxed text-muted-foreground ${
                    cell.accent ? 'text-[13.5px]' : 'text-[12.5px]'
                  }`}
                >
                  {cell.text}
                </p>

                {cell.accent && (
                  <div className="mt-auto space-y-2 pt-5">
                    <p className="text-[10px] font-black tracking-[0.13em] text-muted-foreground uppercase">
                      Tools it can call mid-conversation
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Send, label: 'capture_lead' },
                        { icon: Calendar, label: 'book_appointment' },
                        { icon: Flame, label: 'update_lead_status' },
                        { icon: Users, label: 'request_handoff' },
                      ].map((tool) => (
                        <div
                          key={tool.label}
                          className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2"
                        >
                          <tool.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate font-mono text-[10px] font-semibold text-muted-foreground">
                            {tool.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The inbox — the tagline, shown rather than claimed                 */}
      {/* ---------------------------------------------------------------- */}
      <section id="inbox" className="relative z-10 scroll-mt-20 border-y border-border/50 bg-muted/15 py-12">
        <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-8 lg:px-8">
          <Reveal>
            <Eyebrow icon={Bell}>One inbox</Eyebrow>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Chat, Maps, Reddit, tenders — <span className="text-gradient">one table</span>
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              No tab-hopping between a chat tool, a scraper spreadsheet and a CRM. Every lead lands
              in the same row format, scored and owned, whatever door it came through.
            </p>
            <ul className="mt-5 space-y-2.5">
              {DASHBOARD_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[13px]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth/register" className="mt-6 inline-flex">
              <Button variant="gradient" className="gap-2 font-bold">
                Open your own inbox <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="lit-border overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-float backdrop-blur-xl">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[12.5px] font-black">
                  <Bell className="h-3.5 w-3.5 text-primary" /> Leads
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                  6 new
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {['All', 'Hot', 'Warm', 'Cold'].map((tab, i) => (
                    <span
                      key={tab}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        i === 0
                          ? 'bg-brand-gradient text-white shadow-sm shadow-primary/25'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>

              {/* Header row */}
              <div className="hidden grid-cols-[1.5fr_1fr_0.7fr_0.6fr] gap-3 border-b border-border/60 bg-muted/25 px-4 py-2 text-[9.5px] font-black tracking-[0.12em] text-muted-foreground uppercase sm:grid">
                <span>Lead</span>
                <span>Source</span>
                <span>Score</span>
                <span className="text-right">Status</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/50">
                {LEAD_ROWS.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1.5fr_1fr_0.7fr_0.6fr] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[10px] font-black text-white">
                        {row.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[12.5px] font-bold">{row.name}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">{row.company}</p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <span className="truncate">{row.source}</span>
                      </span>
                      <p className="mt-0.5 text-[9.5px] text-muted-foreground/70">{row.when} ago</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="tabular w-6 text-[12.5px] font-black">{row.score}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                          style={{ width: `${row.score}%` }}
                        />
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-wider uppercase ${
                          row.status === 'Hot'
                            ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[10.5px] text-muted-foreground">
                <span className="font-semibold">Showing 6 of 1,284 leads this month</span>
                <span className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> 312 hot
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 508 warm
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> 464 cold
                  </span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Outbound AI                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section id="outbound" className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Eyebrow icon={Radar}>Outbound AI</Eyebrow>
            <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Don&apos;t only wait for traffic. Go and find it.
            </h2>
          </div>
          <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Two prospecting engines inside the same workspace, so the pipeline keeps filling on the
            days nobody visits your site.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {OUTBOUND.map((card, i) => (
            <Reveal key={card.kicker} delay={i * 110}>
              <div className="lit-border group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
                <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md shadow-primary/25">
                    <card.icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-primary uppercase">
                    {card.kicker}
                  </span>
                </div>

                <h3 className="text-lg leading-snug font-bold">{card.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{card.text}</p>

                <ul className="mt-4 space-y-2">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-[12.5px]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-4">
                  {card.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Enterprise + testimonials, stacked in one band to keep it dense   */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 border-y border-border/50 bg-muted/15 py-12">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <Eyebrow icon={ShieldCheck}>Built for real companies</Eyebrow>
              <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                Enterprise bones, startup setup time
              </h2>
            </div>
            <Link href="/privacy">
              <Button variant="outline" className="gap-2 font-bold">
                Read the privacy policy <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ENTERPRISE.map((item, i) => (
              <Reveal key={item.label} delay={i * 60}>
                <div className="flex h-full items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="leading-snug">
                    <p className="text-[13px] font-bold">{item.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {TESTIMONIALS.map((item, i) => (
              <Reveal key={item.name} delay={i * 90}>
                <figure className="lit-border flex h-full flex-col rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      {item.metric}
                    </span>
                  </div>
                  <blockquote className="flex-1 text-[13.5px] leading-relaxed font-medium">
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-2.5 border-t border-border/50 pt-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-black text-white">
                      {item.name.split(' ').map((w) => w[0]).join('')}
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[12.5px] font-bold">{item.name}</span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        {item.role} · {item.company}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pricing                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section id="pricing" className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Eyebrow icon={BarChart3}>Pricing</Eyebrow>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Priced per plan. Not per missed lead.
            </h2>
            <p className="mt-2 max-w-xl text-[13.5px] text-muted-foreground">
              {BRAND.tagline} — starting at nothing. Upgrade when the pipeline says you should.
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 backdrop-blur-sm">
            {(['monthly', 'annual'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCycle(option)}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-[13px] font-bold capitalize transition-colors ${
                  cycle === option
                    ? 'bg-brand-gradient text-white shadow-sm shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option}
                {option === 'annual' && <span className="ml-1.5 text-[10px] font-black opacity-90">−20%</span>}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const perMonth = cycle === 'annual' ? Math.round(plan.yearly / 12) : plan.monthly;
            return (
              <Reveal key={plan.name} delay={i * 70}>
                <div
                  className={`lit-border relative flex h-full flex-col rounded-2xl border p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${
                    plan.popular
                      ? 'border-primary/45 bg-gradient-to-b from-primary/8 to-card/80 shadow-glow'
                      : 'border-border/60 bg-card/70'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-0.5 text-[9.5px] font-black tracking-wider text-white uppercase shadow-md shadow-primary/30">
                      Most popular
                    </span>
                  )}

                  <p className="text-[14.5px] font-bold">{plan.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">{plan.tagline}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="tabular text-4xl font-black tracking-tight">${perMonth}</span>
                    <span className="text-[12.5px] font-semibold text-muted-foreground">/mo</span>
                  </div>
                  {/* Reserved line keeps every card the same height on both cycles */}
                  <p className="mt-1 h-4 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {cycle === 'annual' && plan.yearly > 0
                      ? `$${plan.yearly} billed yearly · save $${plan.monthly * 12 - plan.yearly}`
                      : ' '}
                  </p>

                  <ul className="mt-5 flex-1 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[12px]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/auth/register" className="mt-5 block">
                    <Button variant={plan.variant} className="w-full font-bold">
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120}>
          <div className="mt-3 grid gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_EXTRAS.map((extra) => (
              <div key={extra.label} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <extra.icon className="h-4 w-4" />
                </span>
                <span className="text-[12.5px] font-semibold">{extra.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ — two columns so the page never narrows to a thin ribbon      */}
      {/* ---------------------------------------------------------------- */}
      <section id="faq" className="relative z-10 scroll-mt-20 border-t border-border/50 bg-muted/15 py-12">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <Eyebrow icon={MessageSquare}>Questions</Eyebrow>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Straight answers</h2>
            </div>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              Still stuck? The agent on this very site will answer — or hand you to a human.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={faq.q} delay={i * 40}>
                  <div
                    className={`overflow-hidden rounded-2xl border backdrop-blur-sm transition-colors ${
                      open ? 'border-primary/35 bg-card/85' : 'border-border/60 bg-card/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-left"
                    >
                      <span className="text-[13.5px] font-bold">{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                          open ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-4 pb-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 px-6 py-10 sm:px-12 sm:py-12">
            <div className="animate-gradient-pan absolute inset-0 -z-10 bg-[linear-gradient(120deg,#4F46E5,#7C3AED,#C026D3,#7C3AED,#4F46E5)] opacity-95" />
            <div className="absolute inset-0 -z-10 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />

            <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="text-center lg:text-left">
                <LogoMark className="mx-auto h-12 w-12 lg:mx-0" />
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Your next customer is on the site right now.
                </h2>
                <p className="mt-3 max-w-xl text-[14.5px] text-white/85">
                  {BRAND.signature}. Switch it on in two minutes and let the agent take the first
                  conversation — tonight, while you sleep.
                </p>

                <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row lg:justify-start">
                  <Link href="/auth/register" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="group h-12 w-full gap-2 bg-white px-8 text-[15px] font-black text-indigo-700 shadow-lg hover:bg-white/90 sm:w-auto"
                    >
                      Start free
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                  <Link href="/auth/login" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 w-full border-white/35 bg-white/10 px-8 text-[15px] font-bold text-white hover:bg-white/20 hover:text-white sm:w-auto"
                    >
                      Sign in
                    </Button>
                  </Link>
                </div>

                <p className="mt-5 text-[11.5px] text-white/70">
                  No credit card required · Deploy in two minutes · Cancel anytime
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: Bell, value: '1,284', label: 'Leads rung in this month' },
                  { icon: Calendar, value: '317', label: 'Meetings auto-booked' },
                  { icon: Clock, value: '1.8s', label: 'Median first reply' },
                  { icon: Globe2, value: '14', label: 'Countries served' },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
                  >
                    <tile.icon className="mb-2 h-4 w-4 text-white/80" />
                    <p className="tabular text-2xl font-black text-white">{tile.value}</p>
                    <p className="mt-0.5 text-[10.5px] leading-tight text-white/70">{tile.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                            */}
      {/* ---------------------------------------------------------------- */}
      <footer className="relative z-10 border-t border-border/50 bg-muted/20 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1400px] gap-8 md:grid-cols-6">
          <div className="space-y-3.5 md:col-span-2">
            <Logo size="md" showTagline />
            <p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              {BRAND.taglineLong}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Multi-tenant', 'RBAC', 'Audit trail', 'Webhooks', 'REST API'].map((badge) => (
                <span
                  key={badge}
                  className="rounded-md border border-border/60 bg-card/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {badge}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              All systems operational · 99.98% uptime
            </div>
          </div>

          {[
            {
              title: 'Platform',
              links: [
                { label: 'How it works', href: '#how' },
                { label: 'Features', href: '#platform' },
                { label: 'The inbox', href: '#inbox' },
                { label: 'Outbound AI', href: '#outbound' },
              ],
            },
            {
              title: 'Channels',
              links: [
                { label: 'Website chat', href: '#platform' },
                { label: 'WhatsApp & SMS', href: '#platform' },
                { label: 'Google Maps', href: '#outbound' },
                { label: 'Reddit & tenders', href: '#outbound' },
              ],
            },
            {
              title: 'Resources',
              links: [
                { label: 'Dashboard', href: '/auth/login' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Create account', href: '/auth/register' },
              ],
            },
            {
              title: 'Company',
              links: [
                { label: COMPANY.shortName, href: COMPANY.url },
                { label: 'Privacy policy', href: '/privacy' },
                { label: 'Sign in', href: '/auth/login' },
              ],
            },
          ].map((column) => (
            <div key={column.title} className="space-y-2.5">
              <p className="text-[9.5px] font-black tracking-[0.15em] uppercase">{column.title}</p>
              <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(link.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 border-t border-border/50 pt-5 text-[11.5px] text-muted-foreground sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
          </p>
          <PoweredBy />
        </div>
      </footer>
    </div>
  );
}
