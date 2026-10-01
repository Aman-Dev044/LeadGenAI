import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  Calendar,
  Clock,
  Compass,
  Database,
  FileSearch,
  Gauge,
  Github,
  Globe2,
  KeyRound,
  Layers,
  LineChart,
  ListChecks,
  Mic,
  Repeat,
  FileSpreadsheet,
  AlarmClock,
  Languages,
  BrainCircuit,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  Radar,
  Radio,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Every list the landing page renders, in one place.
 *
 * Copy lives here rather than inline in the page so a marketing edit is a data
 * change, and so the FAQ and pricing arrays can be reused verbatim by the
 * JSON-LD builders in `structured-data.ts` — the rich result can never claim a
 * price or an answer the page does not show.
 */

export const CHANNELS_IN: { icon: LucideIcon; label: string }[] = [
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

export const CHANNELS_OUT = [
  'HubSpot', 'Salesforce', 'Slack', 'Zapier', 'Calendly', 'Twilio',
  'Stripe', 'Gmail', 'Webhooks', 'REST API', 'Google Calendar', 'Zoom',
];

export const HERO_PROOF = [
  { value: '5 sec', label: 'lead added → AI calling' },
  { value: '24/7', label: 'calls, WhatsApp, follow-ups' },
  { value: '0', label: 'follow-ups slipped' },
];

export const STATS = [
  { value: 5, suffix: 's', label: 'From new lead to first call', sub: 'the AI dials the moment a lead lands' },
  { value: 3, suffix: 'x', label: 'More meetings booked', sub: 'vs. reps calling back the next day' },
  { value: 68, suffix: '%', label: 'Of calls qualified', sub: 'requirement, budget and timeline captured' },
  { value: 100, suffix: '%', label: 'Of follow-ups tracked', sub: 'overdue ones alert the manager' },
];

export const WITHOUT = [
  'Leads sit in a sheet until someone has time to call',
  'First call happens the next day — the lead has moved on',
  'No answer? Nobody tries again',
  'Reps forget follow-ups; the manager finds out weeks later',
  'Call notes live in someone’s head',
  'Cold leads are never touched again',
];

export const WITH = [
  'The AI calls every new lead within seconds — one by one',
  'No answer → WhatsApp + retry, automatically',
  'Interested → meeting booked on the call, details on WhatsApp',
  'Hot leads handed to a salesperson with a due-by task',
  'Every call recorded, transcribed and summarised',
  'Gone quiet for 5 days → the AI re-engages',
];

export const STEPS: { icon: LucideIcon; title: string; text: string; meta: string }[] = [
  {
    icon: FileSpreadsheet,
    title: 'Add your leads',
    text: 'Type one in, upload an Excel sheet, or let the website widget, WhatsApp and prospecting feed them in.',
    meta: 'Name · phone · what they want',
  },
  {
    icon: Mic,
    title: 'Tell the agent what you sell',
    text: 'Company, pitch, the questions to ask, language and voice. Upload docs so it answers from your material.',
    meta: 'Hinglish · Hindi · English',
  },
  {
    icon: PhoneCall,
    title: 'It calls, qualifies, books',
    text: 'Within seconds of a lead landing the AI is on the phone — confirming the need, budget and timeline, booking the meeting.',
    meta: 'Sequential, 24/7',
  },
  {
    icon: ListChecks,
    title: 'Your team gets the hot ones',
    text: 'Recording, transcript and next step on every lead. Follow-ups scheduled; overdue ones alert the manager.',
    meta: 'Zero touch',
  },
];

export const BENTO: {
  icon: LucideIcon;
  title: string;
  text: string;
  span: string;
  accent?: boolean;
}[] = [
  {
    icon: Brain,
    title: 'An agent that actually calls — and closes',
    text: 'On the phone and in chat, with real tool calling: it confirms the requirement, books the meeting, schedules the callback or transfers to a human mid-sentence — instead of promising someone will be in touch.',
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
    title: 'Follow-ups that cannot slip',
    text: 'Every call ends with a due-by task. Miss it and the manager is alerted; go quiet and the AI re-engages.',
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
    text: 'Slot agreed on the call, calendar blocked, rep notified, WhatsApp confirmation sent.',
    span: '',
  },
  {
    icon: Bell,
    title: 'Rings the right person',
    text: 'Routing by score, source and team, with realtime desktop and Slack alerts.',
    span: '',
  },
];

export const LEAD_ROWS = [
  { name: 'Sarah Whitfield', company: 'Northwind Logistics', source: 'Website chat', score: 94, status: 'Hot', when: '2m' },
  { name: 'Diego Marín', company: 'Marín Auto Care', source: 'Google Maps', score: 81, status: 'Hot', when: '11m' },
  { name: 'u/buildfast', company: 'r/smallbusiness', source: 'Reddit', score: 76, status: 'Hot', when: '24m' },
  { name: 'Ayesha Khan', company: 'Bluepeak Studio', source: 'WhatsApp', score: 62, status: 'Warm', when: '1h' },
  { name: 'Tom Alvarez', company: 'Ridgeline Dental', source: 'Google Maps', score: 58, status: 'Warm', when: '2h' },
  { name: 'City of Aarhus', company: 'Tender #DK-4471', source: 'Public tenders', score: 44, status: 'Warm', when: '3h' },
];

export const DASHBOARD_POINTS = [
  'One inbox for every source — inbound chat and outbound prospecting side by side',
  'Scores, owners, statuses and SLA timers on the same row',
  'Full conversation, page path and UTM behind every lead',
  'Filter, bulk-assign and export without leaving the table',
];

export const OUTBOUND: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  chips: string[];
}[] = [
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

export const ENTERPRISE: { icon: LucideIcon; label: string; text: string }[] = [
  { icon: Layers, label: 'Multi-tenant isolation', text: 'Every workspace in its own logical boundary.' },
  { icon: ShieldCheck, label: 'Role-based access', text: 'Admin, sales manager and agent scopes.' },
  { icon: Activity, label: 'Full audit trail', text: 'Who did what, to which record, from where.' },
  { icon: KeyRound, label: 'Your own API keys', text: 'Bring your AI, SMTP, storage and SERP accounts.' },
  { icon: Globe2, label: 'Webhooks & REST API', text: 'Push every event into your own stack.' },
  { icon: Compass, label: 'Owner console', text: 'Cross-tenant control, usage and health in one place.' },
];

export const TESTIMONIALS = [
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

export const FAQS = [
  {
    q: 'How does the AI calling work?',
    a: 'Add a lead — by hand, from an Excel/CSV sheet, or from your website chat and prospecting — and within seconds the AI agent phones them. It introduces itself, confirms the name, asks about the requirement, budget and timeline in Hinglish, Hindi or English, and books a meeting or a callback right on the call. Leads are called one after another, only inside the calling hours you set.',
  },
  {
    q: 'What if the lead does not pick up?',
    a: 'The AI sends a WhatsApp message straight away, retries after a gap you choose (up to a limit), and if nobody ever answers it hands the lead to a salesperson with a task to try another channel. Wrong numbers are flagged, not retried.',
  },
  {
    q: 'Can the AI transfer the call to a real person?',
    a: 'Yes. You list the people it can transfer to — by name, number and what they handle — and the moment a lead asks for a human, wants to negotiate or is ready to buy, the AI says who it is connecting them to and transfers live. It can also try the lead’s own salesperson first.',
  },
  {
    q: 'Does the lead get anything after the call?',
    a: 'A WhatsApp message within seconds: a thank-you, and when a meeting was booked, the date, time and who they will meet with their number. Callback times are confirmed the same way. Templates are yours to edit.',
  },
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

export type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: string;
  variant: 'outline' | 'gradient';
  popular: boolean;
};

export const PLANS: Plan[] = [
  {
    name: 'Free',
    tagline: 'Try the basics',
    monthly: 0,
    yearly: 0,
    features: ['1 Agent', '100 Leads', '500 Conversations/mo', '5 Knowledge Sources', '2 Users', 'Community Support'],
    cta: 'Get started free',
    variant: 'outline',
    popular: false,
  },
  {
    name: 'Starter',
    tagline: 'For small teams',
    monthly: 29,
    yearly: 279,
    features: ['3 Agents', '1,000 Leads', '2,000 Conversations/mo', '20 Knowledge Sources', '5 Users', 'WhatsApp & Email Support'],
    cta: 'Start 14-day trial',
    variant: 'outline',
    popular: false,
  },
  {
    name: 'Professional',
    tagline: 'Most popular',
    monthly: 79,
    yearly: 759,
    features: ['10 Agents', '10,000 Leads', '10,000 Conversations/mo', '50 Knowledge Sources', '20 Users', 'Priority Support & CRM Sync'],
    cta: 'Start 14-day trial',
    variant: 'gradient',
    popular: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Scale without limits',
    monthly: 199,
    yearly: 1910,
    features: ['50 Agents', '100,000 Leads', '50,000 Conversations/mo', '200 Knowledge Sources', '100 Users', 'Custom SLA & Dedicated Manager'],
    cta: 'Contact sales',
    variant: 'outline',
    popular: false,
  },
];

export const PLAN_EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: 'No setup fee, ever' },
  { icon: Zap, label: 'Every feature on every plan' },
  { icon: Clock, label: 'Cancel or switch anytime' },
  { icon: KeyRound, label: 'Bring your own AI keys' },
];

export const CLOSING_TILES: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: PhoneCall, value: '1,284', label: 'AI calls this month' },
  { icon: Calendar, value: '317', label: 'Meetings booked on the call' },
  { icon: Clock, value: '5s', label: 'Lead added → dialing' },
  { icon: Globe2, value: '14', label: 'Countries served' },
];

export const NAV_LINKS = [
  { label: 'AI Calling', href: '#calling' },
  { label: 'How it works', href: '#how' },
  { label: 'Platform', href: '#platform' },
  { label: 'The inbox', href: '#inbox' },
  { label: 'Outbound AI', href: '#outbound' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const PRICING_EYEBROW_ICON = BarChart3;


// ─── AI calling section ───────────────────────────────────────────────

export const CALLING_PROOF: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: AlarmClock, value: '< 5 s', label: 'from lead to first ring' },
  { icon: Languages, value: '3', label: 'languages: Hinglish, Hindi, English' },
  { icon: Calendar, value: 'On call', label: 'meetings & callbacks booked live' },
  { icon: Mic, value: '100%', label: 'recorded, transcribed, summarised' },
];

export const CALLING_FLOW: { icon: LucideIcon; title: string; text: string; meta: string; branch?: boolean }[] = [
  {
    icon: FileSpreadsheet,
    title: 'Lead lands',
    text: 'Typed in, imported from Excel, captured by the website chat or found by prospecting — with a line about what they want.',
    meta: 'any source',
  },
  {
    icon: PhoneCall,
    title: 'AI calls within seconds',
    text: 'Introduces itself by name, confirms it is the right person, and talks about their requirement — not a script.',
    meta: 'one by one',
  },
  {
    icon: PhoneMissed,
    title: 'No answer? WhatsApp + retry',
    text: 'A message goes out immediately; the AI calls again after the gap you set, up to your limit.',
    meta: 'automatic',
    branch: true,
  },
  {
    icon: BrainCircuit,
    title: 'Qualifies like a human',
    text: 'Requirement, budget, timeline, decision maker, objections — scored 0-100 for interest.',
    meta: 'hot · warm · cold',
  },
  {
    icon: Calendar,
    title: 'Books the meeting on the call',
    text: '“Kal 11 baje?” — slot confirmed, calendar blocked, salesperson task created, WhatsApp confirmation sent.',
    meta: 'or a callback',
  },
  {
    icon: PhoneForwarded,
    title: 'Hands over when it should',
    text: 'Hot leads are assigned to a salesperson with a due-by task; on request the call is transferred live to a named person.',
    meta: 'live transfer',
    branch: true,
  },
  {
    icon: Repeat,
    title: 'Never lets it go cold',
    text: 'Overdue follow-ups alert the manager. A lead quiet for 5 days gets a WhatsApp and another call.',
    meta: 'closed loop',
  },
];

export const CALLING_PIPELINE = ['Lead', 'Contacted', 'Interested', 'Follow-up', 'Meeting', 'Won'];

export const CALLING_FEATURES: {
  icon: LucideIcon;
  title: string;
  text: string;
  points?: string[];
  span?: string;
  accent?: boolean;
}[] = [
  {
    icon: FileSpreadsheet,
    title: 'Excel in, calls out',
    text: 'Upload a sheet with Name, Phone, Email and a Description. Tick “AI calls every lead” and it works through the list in order, using each row’s description as context.',
    span: 'sm:col-span-2',
    accent: true,
    points: ['Duplicates skipped, Indian numbers normalised', 'Schedule the batch for a time, or start now', 'Every call visible live in the Calls page'],
  },
  {
    icon: Languages,
    title: 'Sounds local',
    text: 'Hinglish by default — the way people actually talk. Switches to Hindi or English if the lead prefers. Indian voices.',
  },
  {
    icon: BrainCircuit,
    title: 'Remembers every lead',
    text: 'Past calls, objections, budget and pending tasks go into the next conversation. A follow-up never sounds like a first call.',
  },
  {
    icon: PhoneForwarded,
    title: 'Live transfer to your team',
    text: 'List people by name and role — “Rahul, pricing” — and the AI connects the lead to the right one, mid-call.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp after every call',
    text: 'Thank-you with the meeting date, time and who they will meet. Callback times confirmed the same way.',
  },
  {
    icon: Mic,
    title: 'Your reps’ calls too',
    text: '“Call via LeadBells” rings the rep, then the lead — recorded, transcribed, and the AI plans the next step.',
  },
  {
    icon: ListChecks,
    title: 'Manager sees what slips',
    text: 'Overdue follow-ups per salesperson, team load, and an alert the moment a hot lead is left waiting.',
  },
];
