'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Bot,
  Zap,
  TrendingUp,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Globe2,
  Users,
  ArrowRight,
  CheckCircle2,
  Star,
  Play,
  Layers,
  BarChart3,
  Flame,
  Building2,
  Check,
  ChevronDown,
  Moon,
  Sun,
  DollarSign,
  Cpu,
  ArrowUpRight,
  Headphones,
  Brain,
  Target,
  Rocket,
  Clock,
  Shield,
  LineChart,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ============================================================ */
/* Reusable Animated Counter Hook                                */
/* ============================================================ */
function useCountUp(end: number, duration = 2000, suffix = '') {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { ref, value, suffix };
}

/* ============================================================ */
/* Scroll-triggered fade-in section                              */
/* ============================================================ */
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.12 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ============================================================ */
/* Typewriter component for hero headline                        */
/* ============================================================ */
function Typewriter({ words, className = '' }: { words: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[index];
    const timeout = deleting ? 40 : 80;

    if (!deleting && displayed === word) {
      setTimeout(() => setDeleting(true), 2200);
      return;
    }
    if (deleting && displayed === '') {
      setDeleting(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayed(deleting ? word.slice(0, displayed.length - 1) : word.slice(0, displayed.length + 1));
    }, timeout);

    return () => clearTimeout(timer);
  }, [displayed, deleting, index, words]);

  return (
    <span className={className}>
      {displayed}
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
}

/* ============================================================ */
/* Floating Orb Background Animation                             */
/* ============================================================ */
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.05]"
        style={{
          background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
          top: '40%',
          left: '-10%',
          animation: 'float 10s ease-in-out infinite 2s',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
          bottom: '-5%',
          right: '-5%',
          animation: 'float 12s ease-in-out infinite 4s',
        }}
      />
    </div>
  );
}

/* ============================================================ */
/* Auto-rotating testimonial with crossfade                      */
/* ============================================================ */
const testimonials = [
  {
    quote:
      'LeadAI replaced our static forms and skyrocketed inbound demos from 42 to 178 in month one—without touching our ad budget.',
    name: 'Sarah Jenkins',
    role: 'VP Demand Gen · CloudScale',
    metric: '+324%',
    metricLabel: 'Demo Bookings',
  },
  {
    quote:
      'The WhatsApp handoff is pure magic. A visitor asks a question at 11 PM and wakes up to a confirmed meeting. Zero human effort.',
    name: 'Marcus Vance',
    role: 'CRO · FinVantage',
    metric: '4x',
    metricLabel: 'Pipeline Speed',
  },
  {
    quote:
      'Fluent conversations in French, Japanese, and Spanish with zero latency transformed our international revenue overnight.',
    name: 'Elena Rostova',
    role: 'Head of Growth · NexusTech',
    metric: '$2.1M',
    metricLabel: 'Added Pipeline',
  },
];

/* ============================================================ */
/* Main Page Component                                           */
/* ============================================================ */
export default function LandingPage() {
  const { theme, setTheme } = useUIStore();
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Animated counters
  const counter1 = useCountUp(340, 2000);
  const counter2 = useCountUp(1800000, 2500);
  const counter3 = useCountUp(95, 1500);
  const counter4 = useCountUp(850, 1800);

  const formatBigNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary transition-colors duration-300 overflow-x-hidden">
      <FloatingOrbs />

      {/* ============================================================ */}
      {/* NAVIGATION                                                    */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-background/70 border-b border-border/40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                <Bot className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                LeadAI<span className="text-primary">.</span>
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-[13px] font-medium text-muted-foreground">
            {['Features', 'How It Works', 'Results', 'Pricing', 'FAQ'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-9 w-9 rounded-xl border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-primary/40 transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="font-semibold text-[13px]">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="gradient" size="sm" className="font-bold text-[13px] shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all gap-1.5">
                Start Free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* HERO                                                          */}
      {/* ============================================================ */}
      <section className="relative z-10 pt-20 sm:pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <AnimatedSection>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-primary/15 to-violet-500/15 border border-primary/20 text-primary mb-8 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" style={{ animation: 'float 3s ease-in-out infinite' }} />
            <span>Autonomous AI Sales Agents — Now Generally Available</span>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <h1 className="text-4xl sm:text-6xl lg:text-[4.5rem] font-black tracking-tight max-w-5xl mx-auto leading-[1.08]">
            Your Website Deserves An{' '}
            <span className="relative inline-block">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-violet-500 to-indigo-400">
                <Typewriter words={['AI Sales Rep', 'Revenue Engine', 'Lead Machine', 'Deal Closer']} />
              </span>
              <span
                className="absolute -bottom-1.5 left-0 w-full h-1 rounded-full bg-gradient-to-r from-primary to-violet-500 opacity-40"
                style={{ animation: 'shimmer 3s linear infinite', backgroundSize: '200% 100%' }}
              />
            </span>{' '}
            That Never Sleeps.
          </h1>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <p className="mt-7 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
            Deploy intelligent conversational agents trained on your product docs, pricing, and playbooks.
            They engage every visitor across <strong className="text-foreground font-medium">web & WhatsApp</strong>, qualify intent in real-time,
            book meetings on your calendar, and pipe warm leads straight into your CRM — <strong className="text-foreground font-medium">24 hours a day, 365 days a year</strong>.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={300}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register">
              <Button variant="gradient" size="lg" className="h-13 px-9 text-base font-bold shadow-xl shadow-primary/30 hover:scale-[1.03] transition-all duration-300 gap-2.5">
                <Rocket className="h-4.5 w-4.5" />
                Deploy Your Agent Free
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="h-13 px-7 text-base font-semibold border-border/60 hover:bg-muted/50 hover:border-primary/40 gap-2.5 transition-all duration-300">
                <Play className="h-4 w-4 fill-primary text-primary" />
                See How It Works
              </Button>
            </a>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={400}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {['No credit card needed', 'Live in under 2 minutes', 'SOC2 & GDPR compliant'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </AnimatedSection>

        {/* ---- Animated Counter Stats ---- */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {[
            { ref: counter1.ref, label: 'Avg Conversion Lift', prefix: '+', value: counter1.value, suffix: '%', icon: TrendingUp, color: 'text-emerald-500' },
            { ref: counter2.ref, label: 'Leads Qualified', value: counter2.value, format: true, suffix: '+', icon: Users, color: 'text-primary' },
            { ref: counter3.ref, label: 'Languages Supported', value: counter3.value, suffix: '+', icon: Globe2, color: 'text-violet-500' },
            { ref: counter4.ref, label: 'Customer Reviews', value: counter4.value, suffix: '+', icon: Star, color: 'text-amber-500', rating: true },
          ].map((stat, i) => (
            <AnimatedSection key={i} delay={500 + i * 100}>
              <div
                ref={stat.ref}
                className="relative p-5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-md text-left overflow-hidden group hover:border-primary/40 hover:shadow-lg transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
                <stat.icon className={`h-5 w-5 mb-3 ${stat.color} group-hover:scale-110 transition-transform`} />
                <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  {stat.prefix || ''}{stat.format ? formatBigNumber(stat.value) : stat.value}{stat.suffix || ''}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">{stat.label}</div>
                {stat.rating && (
                  <div className="flex mt-1.5 text-amber-400 gap-0.5">
                    {[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-current" />)}
                    <span className="text-[10px] text-muted-foreground ml-1 font-semibold">4.9/5</span>
                  </div>
                )}
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* TRUSTED BY MARQUEE                                            */}
      {/* ============================================================ */}
      <section className="py-10 border-y border-border/40 bg-muted/10 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">
            Trusted by revenue teams at
          </p>
          <div className="relative overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
            <div className="flex gap-12 sm:gap-16 items-center justify-center animate-[shimmer_20s_linear_infinite]" style={{ width: 'max-content' }}>
              {[...['TrackBells', 'NexusTech', 'CloudPulse', 'HyperScale', 'FinVantage', 'OmniData', 'CyberFlow', 'DataForge'], ...['TrackBells', 'NexusTech', 'CloudPulse', 'HyperScale']].map(
                (brand, idx) => (
                  <div key={idx} className="flex items-center gap-2 font-bold text-base tracking-tight text-muted-foreground/60 hover:text-foreground/80 transition-colors shrink-0">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs text-primary font-black">
                      {brand.charAt(0)}
                    </div>
                    <span>{brand}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS — 3-STEP VISUAL                                  */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            Simple 3-Step Setup
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            From Zero to Autonomous Agent in{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
              Under 2 Minutes.
            </span>
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

          {[
            {
              step: '01',
              icon: Brain,
              title: 'Train Your Agent',
              desc: 'Upload your product docs, pricing PDFs, FAQ pages, or simply paste your website URL. The AI ingests everything and becomes your product expert in seconds.',
              color: 'from-primary to-indigo-500',
            },
            {
              step: '02',
              icon: Workflow,
              title: 'Customize The Playbook',
              desc: 'Define your agent\u0027s persona, set qualification rules (BANT, MEDDIC), connect your Google Calendar, CRM, WhatsApp, and Slack for instant handoff.',
              color: 'from-violet-500 to-purple-500',
            },
            {
              step: '03',
              icon: Rocket,
              title: 'Go Live & Close Deals',
              desc: 'Paste one script tag on your site. Your agent starts engaging visitors, scoring intent, booking demos, and pushing warm leads to your pipeline immediately.',
              color: 'from-emerald-500 to-teal-500',
            },
          ].map((item, i) => (
            <AnimatedSection key={i} delay={i * 150} className="relative">
              <div className="p-8 rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group h-full">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <item.icon className="h-7 w-7" />
                </div>
                <div className="text-[11px] font-black text-primary tracking-widest uppercase mb-2">Step {item.step}</div>
                <h3 className="text-xl font-bold tracking-tight mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES SHOWCASE — BENTO GRID                                */}
      {/* ============================================================ */}
      <section id="features" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            Platform Capabilities
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Every Weapon Your Revenue Team Needs.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            One platform replaces your chatbot, lead forms, SDR qualification calls, and meeting scheduler.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Bot, title: 'Custom Agent Personas', desc: 'Design specialists for Sales, Technical Pre-Sales, Pricing, or Support. Each with unique tone, guardrails, and conversion objectives.', color: 'bg-primary/10 text-primary', hoverColor: 'group-hover:bg-primary group-hover:text-white' },
            { icon: Flame, title: 'Predictive Lead Scoring', desc: 'Dynamic BANT scoring powered by conversation analysis and website behavior. Automatically route hot leads to your top closers.', color: 'bg-amber-500/10 text-amber-500', hoverColor: 'group-hover:bg-amber-500 group-hover:text-white' },
            { icon: Calendar, title: 'Calendar Auto-Booking', desc: 'Native Google Calendar & Outlook integration. Proposes real-time availability and sends confirmed calendar invites mid-conversation.', color: 'bg-emerald-500/10 text-emerald-500', hoverColor: 'group-hover:bg-emerald-500 group-hover:text-white' },
            { icon: MessageSquare, title: 'WhatsApp Business API', desc: 'Seamless web-to-WhatsApp handoff. Continue conversations, send automated follow-ups, and never lose a lead who navigates away.', color: 'bg-violet-500/10 text-violet-500', hoverColor: 'group-hover:bg-violet-500 group-hover:text-white' },
            { icon: Target, title: 'Visitor Intelligence', desc: 'IP geolocation, referrer tracking, scroll depth, and page-level intent signals feed your agent before the first message is sent.', color: 'bg-rose-500/10 text-rose-500', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white' },
            { icon: ShieldCheck, title: 'Enterprise Security', desc: 'SOC2 Type II compliant. Multi-tenant workspace isolation, role-based access, data purge policies, and full audit logging.', color: 'bg-sky-500/10 text-sky-500', hoverColor: 'group-hover:bg-sky-500 group-hover:text-white' },
            { icon: Headphones, title: 'Live Human Takeover', desc: 'Instant Slack/WhatsApp/SMS pings when a VIP lead hits your threshold. Human reps seamlessly step into any conversation.', color: 'bg-pink-500/10 text-pink-500', hoverColor: 'group-hover:bg-pink-500 group-hover:text-white' },
            { icon: LineChart, title: 'Revenue Analytics', desc: 'Real-time dashboards tracking agent conversations, lead scores, booking rates, conversion funnels, and ROI by source.', color: 'bg-teal-500/10 text-teal-500', hoverColor: 'group-hover:bg-teal-500 group-hover:text-white' },
            { icon: Globe2, title: '95+ Languages', desc: 'Auto-detect visitor language and reply fluently in French, Japanese, Spanish, Arabic, Hindi and 90+ more — zero configuration.', color: 'bg-indigo-500/10 text-indigo-500', hoverColor: 'group-hover:bg-indigo-500 group-hover:text-white' },
          ].map((f, i) => (
            <AnimatedSection key={i} delay={i * 80}>
              <div className="p-7 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400 group h-full">
                <div className={`h-12 w-12 rounded-2xl ${f.color} ${f.hoverColor} flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold tracking-tight mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTEGRATIONS GRID                                             */}
      {/* ============================================================ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            Ecosystem
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Plugs Into Your Entire Stack.
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {[
            { name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
            { name: 'HubSpot', icon: Building2, color: 'text-amber-500' },
            { name: 'Salesforce', icon: Layers, color: 'text-sky-500' },
            { name: 'Slack', icon: MessageSquare, color: 'text-violet-500' },
            { name: 'Google Cal', icon: Calendar, color: 'text-rose-500' },
            { name: 'Outlook', icon: Calendar, color: 'text-blue-500' },
            { name: 'Zapier', icon: Zap, color: 'text-orange-500' },
            { name: 'Webhooks', icon: Cpu, color: 'text-indigo-500' },
            { name: 'Stripe', icon: DollarSign, color: 'text-purple-500' },
            { name: 'Segment', icon: BarChart3, color: 'text-teal-500' },
          ].map((t, i) => (
            <AnimatedSection key={i} delay={i * 50}>
              <div className="p-4 rounded-2xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/30 hover:shadow-md transition-all duration-300 text-center flex flex-col items-center group">
                <div className={`h-10 w-10 rounded-xl bg-muted/40 group-hover:bg-muted/80 flex items-center justify-center mb-2.5 ${t.color} transition-all group-hover:scale-110`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="font-bold text-xs text-foreground">{t.name}</div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* TESTIMONIALS — AUTO-ROTATING CROSSFADE                        */}
      {/* ============================================================ */}
      <section id="results" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            Real Results
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Revenue Leaders Love LeadAI.
          </h2>
        </AnimatedSection>

        <AnimatedSection>
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl border border-border/60 bg-card/50 backdrop-blur-md p-8 sm:p-12 overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className={`transition-all duration-700 ${
                    activeTestimonial === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 p-8 sm:p-12 pointer-events-none'
                  }`}
                >
                  <div className="flex text-amber-400 mb-6 gap-1">
                    {[...Array(5)].map((_, j) => <Star key={j} className="h-5 w-5 fill-current" />)}
                  </div>
                  <p className="text-lg sm:text-2xl font-medium text-foreground leading-relaxed mb-8">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="font-bold text-foreground">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.role}</div>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{t.metric}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">{t.metricLabel}</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Dots navigation */}
              <div className="flex justify-center gap-2 mt-8">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      activeTestimonial === i ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ============================================================ */}
      {/* PRICING                                                       */}
      {/* ============================================================ */}
      <section id="pricing" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            Transparent Pricing
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Start Free. Scale When Ready.</h2>
          <p className="mt-4 text-muted-foreground">14-day free trial on every plan. No setup fees. Cancel anytime.</p>

          <div className="mt-8 inline-flex items-center p-1 rounded-full border border-border/60 bg-muted/30 backdrop-blur-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                billingCycle === 'monthly' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 ${
                billingCycle === 'annual' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">-20%</span>
            </button>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {[
            {
              name: 'Starter',
              desc: 'For founders & small teams.',
              price: billingCycle === 'annual' ? 39 : 49,
              features: ['1 AI Agent', '1,500 Conversations/mo', 'Website Widget', 'Basic Lead Scoring', '10 Knowledge Docs'],
              cta: 'Start Starter Trial',
              variant: 'outline' as const,
              popular: false,
            },
            {
              name: 'Growth',
              desc: 'For scaling revenue teams.',
              price: billingCycle === 'annual' ? 119 : 149,
              features: ['5 AI Agents', '15,000 Conversations/mo', 'WhatsApp Integration', 'Calendar Booking', 'CRM & Slack Sync', 'Unlimited Knowledge Base'],
              cta: 'Start 14-Day Free Trial',
              variant: 'gradient' as const,
              popular: true,
            },
            {
              name: 'Enterprise',
              desc: 'For maximum scale & compliance.',
              price: billingCycle === 'annual' ? 399 : 499,
              features: ['Unlimited Agents', 'Unlimited Conversations', 'Custom LLM Models', 'SOC2 & DPA', 'Dedicated Manager', '99.99% SLA'],
              cta: 'Contact Sales',
              variant: 'outline' as const,
              popular: false,
            },
          ].map((plan, i) => (
            <AnimatedSection key={i} delay={i * 120}>
              <div
                className={`p-8 rounded-3xl flex flex-col justify-between h-full transition-all duration-300 ${
                  plan.popular
                    ? 'border-2 border-primary bg-card shadow-2xl shadow-primary/15 relative scale-[1.03] hover:shadow-primary/25'
                    : 'border border-border/60 bg-card/40 backdrop-blur-sm hover:bg-card/70 hover:border-primary/30 hover:shadow-xl'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-gradient-to-r from-primary to-violet-500 text-white text-[10px] font-black tracking-widest uppercase shadow-lg">
                    Most Popular
                  </div>
                )}
                <div>
                  <div className="font-bold text-lg">{plan.name}</div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-black tracking-tight">${plan.price}</span>
                    <span className="text-sm text-muted-foreground font-medium">/mo</span>
                  </div>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <div key={f} className={`flex items-center gap-2.5 text-sm ${plan.popular ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-8">
                  <Link href="/auth/register">
                    <Button variant={plan.variant} className={`w-full font-bold h-11 ${plan.popular ? 'shadow-lg shadow-primary/25' : ''}`}>
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FAQ                                                           */}
      {/* ============================================================ */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Common Questions, Straight Answers.</h2>
        </AnimatedSection>

        <div className="space-y-3">
          {[
            { q: 'How fast can I go live?', a: 'Under 2 minutes. Paste one script tag before your closing </body> tag, or install via Google Tag Manager, WordPress, Webflow, or Shopify. Your agent starts engaging visitors immediately.' },
            { q: 'How does the AI learn about my product?', a: 'Upload PDFs, sales decks, pricing sheets, or paste your website URL. LeadAI securely digests your knowledge base and strictly answers within your documented boundaries — no hallucinations.' },
            { q: 'Can my sales reps take over a live chat?', a: 'Yes. When a visitor asks for a human or their lead score crosses your threshold, your team gets an instant Slack, WhatsApp, or SMS notification and can seamlessly step into any conversation.' },
            { q: 'Does it work with WhatsApp?', a: 'Natively. Connect your official WhatsApp Business API number and continue conversations, send automated follow-up sequences, and link every chat to the same CRM contact record.' },
            { q: 'Is my data used to train public AI models?', a: 'Never. All data is isolated in private tenant containers with zero public LLM training. We are SOC2 Type II certified, GDPR compliant, and offer custom DPA agreements for Enterprise plans.' },
          ].map((item, i) => (
            <AnimatedSection key={i} delay={i * 60}>
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden hover:border-primary/20 transition-colors">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between font-bold text-sm sm:text-[15px] text-foreground"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-transform duration-300 ${expandedFaq === i ? 'rotate-180 text-primary' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">{item.a}</div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FINAL CTA                                                     */}
      {/* ============================================================ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatedSection>
          <div className="relative rounded-[2rem] overflow-hidden p-10 sm:p-20 text-center border border-primary/30">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-violet-600/15 to-indigo-500/10" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(600px circle at 50% 50%, var(--color-primary), transparent 70%)',
                animation: 'float 6s ease-in-out infinite',
              }}
            />

            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/25 mb-8">
                <Sparkles className="h-3.5 w-3.5" style={{ animation: 'float 3s ease-in-out infinite' }} />
                Limited: First 100 signups get 30 days free
              </div>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
                Stop Losing Visitors.<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
                  Start Closing Deals.
                </span>
              </h2>

              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Join 2,000+ revenue teams generating qualified pipeline 24/7 with zero SDR overhead.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/register">
                  <Button variant="gradient" size="lg" className="h-14 px-10 text-base font-black shadow-2xl shadow-primary/30 hover:scale-[1.03] transition-all duration-300 gap-2.5">
                    <Rocket className="h-5 w-5" />
                    Create Your Free Agent
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" size="lg" className="h-14 px-8 font-bold border-border/60">
                    Sign In To Dashboard
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                No credit card required · Deploy in 2 minutes · Cancel anytime
              </p>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-border/40 bg-muted/10 py-16 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white font-bold shadow-md">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                LeadAI<span className="text-primary">.</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              The autonomous AI agent platform that turns anonymous website traffic into verified calendar meetings,
              qualified leads, and accelerated pipeline — on complete autopilot.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational · 99.98% Uptime SLA
            </div>
          </div>

          {[
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'How It Works', href: '#how-it-works' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }] },
            { title: 'Resources', links: [{ label: 'Dashboard', href: '/auth/login' }, { label: 'Privacy Policy', href: '/privacy' }, { label: 'Security', href: '#features' }] },
            { title: 'Company', links: [{ label: 'Terms of Service', href: '#faq' }, { label: 'SOC2 Compliance', href: '#features' }, { label: 'Contact', href: '/auth/login' }] },
          ].map((col) => (
            <div key={col.title} className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground">{col.title}</div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} LeadAI Technologies Inc. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <a href="#faq" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#features" className="hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
