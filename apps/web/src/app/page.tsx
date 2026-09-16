'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  Plus,
  Minus,
  Calculator,
  Activity,
  CheckCheck,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ============================================================ */
/* Reusable Animated Counter Hook (zero layout shift)           */
/* ============================================================ */
function useCountUp(end: number, duration = 1800) {
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
            const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { ref, value };
}

/* ============================================================ */
/* Subtle fade-in without vertical jitter                        */
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
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-700 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ============================================================ */
/* Stable WordRotate: Fixed height/width to prevent page jump    */
/* ============================================================ */
function WordRotate({ words, className = '' }: { words: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        setFade(true);
      }, 350);
    }, 3200);
    return () => clearInterval(interval);
  }, [words.length]);

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Invisible placeholder containing longest word to strictly lock layout width */}
      <span className="invisible select-none opacity-0" aria-hidden="true">
        {words.reduce((a, b) => (a.length >= b.length ? a : b), '')}
      </span>
      {/* Absolute positioned crossfade text */}
      <span
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-350 ease-in-out ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {words[index]}
      </span>
    </span>
  );
}

/* ============================================================ */
/* Static Testimonials (3-card grid: zero height jumping)       */
/* ============================================================ */
const testimonials = [
  {
    quote:
      'LeadAI replaced our static forms and skyrocketed inbound demos from 42 to 178 in month one — without touching our paid ad budget.',
    name: 'Sarah Jenkins',
    role: 'VP Demand Gen · CloudScale',
    metric: '+324%',
    metricLabel: 'Demo Bookings',
  },
  {
    quote:
      'The WhatsApp handoff is pure magic. A visitor asks a question at 11 PM and wakes up to a confirmed meeting. Zero human SDR effort.',
    name: 'Marcus Vance',
    role: 'CRO · FinVantage',
    metric: '4x',
    metricLabel: 'Pipeline Speed',
  },
  {
    quote:
      'Fluent conversations in French, Japanese, and Spanish with zero latency transformed our international inbound revenue overnight.',
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Interactive ROI Calculator State
  const [monthlyVisitors, setMonthlyVisitors] = useState<number>(25000);
  const [dealValue, setDealValue] = useState<number>(2500);

  // ROI Calculations
  const calculations = useMemo(() => {
    // 2.2% qualification uplift on website visitors
    const qualifiedLeads = Math.max(1, Math.round(monthlyVisitors * 0.022));
    // 18% demo to deal close rate
    const closedDeals = Math.max(1, Math.round(qualifiedLeads * 0.18));
    const monthlyPipeline = closedDeals * dealValue;
    const annualPipeline = monthlyPipeline * 12;
    // 8.5 minutes saved per qualification vs manual SDR review
    const hoursSaved = Math.round((monthlyVisitors * 0.08 * 8.5) / 60);
    // Starter plan cost estimate benchmark
    const softwareCost = 79 * 12;
    const roiMultiplier = Math.max(12, Math.round(annualPipeline / Math.max(softwareCost, 1)));

    return {
      qualifiedLeads,
      closedDeals,
      monthlyPipeline,
      annualPipeline,
      hoursSaved,
      roiMultiplier,
    };
  }, [monthlyVisitors, dealValue]);

  // Animated counters for stats
  const counter1 = useCountUp(340, 1800);
  const counter2 = useCountUp(1800000, 2200);
  const counter3 = useCountUp(95, 1400);
  const counter4 = useCountUp(850, 1600);

  const formatBigNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Exact plans from billing page
  const plans = [
    {
      name: 'Free',
      tagline: 'Try the basics',
      priceMonthly: 0,
      priceYearly: 0,
      yearlyMonthlyEquivalent: 0,
      features: ['1 Agent', '100 Leads', '500 Conversations/mo', '5 Knowledge Sources', '2 Users', 'Community Support'],
      cta: 'Get Started Free',
      variant: 'outline' as const,
      popular: false,
    },
    {
      name: 'Starter',
      tagline: 'For small teams',
      priceMonthly: 29,
      priceYearly: 279,
      yearlyMonthlyEquivalent: 23, // 279 / 12 ~ 23
      yearlySavings: 69, // 29*12 = 348 - 279 = 69
      features: ['3 Agents', '1,000 Leads', '2,000 Conversations/mo', '20 Knowledge Sources', '5 Users', 'WhatsApp & Email Support'],
      cta: 'Start 14-Day Free Trial',
      variant: 'outline' as const,
      popular: false,
    },
    {
      name: 'Professional',
      tagline: 'Most popular',
      priceMonthly: 79,
      priceYearly: 759,
      yearlyMonthlyEquivalent: 63, // 759 / 12 ~ 63
      yearlySavings: 189, // 79*12 = 948 - 759 = 189
      features: ['10 Agents', '10,000 Leads', '10,000 Conversations/mo', '50 Knowledge Sources', '20 Users', 'Priority Support & CRM Sync'],
      cta: 'Start 14-Day Free Trial',
      variant: 'gradient' as const,
      popular: true,
    },
    {
      name: 'Enterprise',
      tagline: 'Scale without limits',
      priceMonthly: 199,
      priceYearly: 1910,
      yearlyMonthlyEquivalent: 159, // 1910 / 12 ~ 159
      yearlySavings: 478, // 199*12 = 2388 - 1910 = 478
      features: ['50 Agents', '100,000 Leads', '50,000 Conversations/mo', '200 Knowledge Sources', '100 Users', 'Custom SLA & Dedicated Manager'],
      cta: 'Contact Sales',
      variant: 'outline' as const,
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary transition-colors duration-300 overflow-x-hidden relative">
      {/* Modern subtle ambient grid background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#80808012_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-primary/10 via-violet-500/5 to-transparent blur-3xl pointer-events-none" />
      </div>

      {/* ============================================================ */}
      {/* NAVIGATION                                                    */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform duration-200">
                <Bot className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                LeadAI<span className="text-primary">.</span>
              </span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v2.4 GA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-[13px] font-semibold text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#calculator" className="hover:text-foreground transition-colors">ROI Calculator</a>
            <a href="#results" className="hover:text-foreground transition-colors">Results</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-9 w-9 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="font-semibold text-[13px]">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="gradient" size="sm" className="font-bold text-[13px] shadow-md shadow-primary/20 hover:scale-[1.02] transition-transform gap-1.5">
                Start Free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* HERO SECTION                                                  */}
      {/* ============================================================ */}
      <section className="relative z-10 pt-12 sm:pt-16 pb-14 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto text-center">
        <AnimatedSection>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-primary/10 border border-primary/25 text-primary mb-6 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Autonomous AI Sales Agents — Active Across Web & WhatsApp</span>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={80}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight max-w-5xl mx-auto leading-[1.15]">
            Turn Every Anonymous Visitor Into A
            <br className="hidden sm:block" />
            <span className="relative inline-block mt-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-violet-500 to-indigo-500">
                <WordRotate words={['Qualified Lead', 'Booked Demo', 'Closed Deal', 'Revenue Win']} />
              </span>
              <span className="absolute -bottom-1 left-0 w-full h-1 rounded-full bg-gradient-to-r from-primary to-violet-500 opacity-40" />
            </span>
          </h1>
        </AnimatedSection>

        <AnimatedSection delay={140}>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Deploy intelligent agents trained on your product docs, pricing, and battle-cards.
            They engage visitors 24/7 across <strong className="text-foreground font-semibold">Web & WhatsApp</strong>, qualify buyer intent with BANT scoring, book calendar invites in real-time, and sync hot leads directly to your CRM.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register">
              <Button variant="gradient" size="lg" className="h-12 px-8 text-base font-bold shadow-xl shadow-primary/25 hover:scale-[1.02] transition-transform gap-2">
                <Rocket className="h-4.5 w-4.5" />
                Deploy Your Agent Free
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="h-12 px-6 text-base font-semibold border-border/80 hover:bg-muted/50 gap-2">
                <Play className="h-4 w-4 fill-primary text-primary" />
                See How It Works
              </Button>
            </a>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={260}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground font-medium">
            {['No credit card required', 'Deploy in under 2 minutes', 'SOC2 & GDPR Compliant', 'Cancel anytime'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </AnimatedSection>

        {/* Counter Stats Bar — Wide 4-column layout */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-5xl mx-auto">
          {[
            { ref: counter1.ref, label: 'Avg Conversion Lift', prefix: '+', value: counter1.value, suffix: '%', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { ref: counter2.ref, label: 'Leads Qualified', value: counter2.value, format: true, suffix: '+', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
            { ref: counter3.ref, label: 'Languages Supported', value: counter3.value, suffix: '+', icon: Globe2, color: 'text-violet-500', bg: 'bg-violet-500/10' },
            { ref: counter4.ref, label: 'Verified Customer Reviews', value: counter4.value, suffix: '+', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10', rating: true },
          ].map((stat, i) => (
            <div
              key={i}
              ref={stat.ref}
              className="p-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className={`h-9 w-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="h-4.5 w-4.5" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {stat.prefix || ''}{stat.format ? formatBigNumber(stat.value) : stat.value}{stat.suffix || ''}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">{stat.label}</div>
              {stat.rating && (
                <div className="flex mt-1.5 text-amber-400 gap-0.5 items-center">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-current" />)}
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-bold">4.9 / 5</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live Product Visual Centerpiece: Autonomous Sales Agent Cockpit (Fills the hero horizontally!) */}
        <AnimatedSection delay={320} className="mt-12">
          <div className="w-full max-w-6xl mx-auto rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl p-4 sm:p-7 shadow-2xl text-left overflow-hidden relative">
            {/* Top Mockup Header Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="h-4 w-px bg-border/80 mx-1" />
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                  Agent Live Stream: <span className="text-primary font-mono font-semibold">Nexus Enterprise SDR</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Channel: Web + WhatsApp Active
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">Latency: 820ms</span>
              </div>
            </div>

            {/* Mockup Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
              {/* Left Col: Lead Qualification Details */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        AC
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Alexander Chen · CTO</div>
                        <div className="text-[10px] text-muted-foreground">Starlight Technologies (180 employees)</div>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] font-bold">
                      Intent Score: 96 / 100
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-background/80 border border-border/40 text-xs text-foreground leading-relaxed">
                    <span className="text-primary font-bold">Agent:</span> &ldquo;Based on your 40-seat sales team and current HubSpot setup, LeadAI can automatically qualify high-intent demo requests in under 3 minutes. I have a slot open with our solutions architect tomorrow at 2:00 PM EST. Shall I reserve it for you?&rdquo;
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">BANT Budget</div>
                    <div className="text-xs font-bold text-emerald-500 mt-0.5">$25k - $50k / yr</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Decision Timeline</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">Under 14 Days</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">CRM Sync</div>
                    <div className="text-xs font-bold text-primary mt-0.5 flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5 text-primary" /> Synced to CRM
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Instant Meeting & Routing Card */}
              <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-gradient-to-br from-primary/5 via-violet-500/5 to-transparent border border-primary/20">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-primary mb-3">
                    <Calendar className="h-4 w-4" /> Meeting Confirmed Autonomously
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border/60 mb-3 space-y-1">
                    <div className="text-xs font-bold text-foreground">Enterprise Product Demo (30 min)</div>
                    <div className="text-[11px] text-muted-foreground">Tomorrow · 2:00 PM - 2:30 PM EST</div>
                    <div className="text-[10px] text-emerald-500 font-medium">Invites sent to alex@starlight.io & Rep calendar</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" /> WhatsApp reminder queued 1 hr before call
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" /> Deal stage pushed to &apos;Demo Scheduled&apos;
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Autonomous Resolution:</span>
                  <span className="font-bold text-foreground">1 min 42 sec (Zero Human Touch)</span>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ============================================================ */}
      {/* TRUSTED BY MARQUEE                                            */}
      {/* ============================================================ */}
      <section className="py-8 border-y border-border/50 bg-muted/20 relative z-10 overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Trusted by modern revenue and growth leaders worldwide
          </p>
          <div className="flex flex-wrap gap-8 sm:gap-12 items-center justify-center">
            {['TrackBells', 'NexusTech', 'CloudScale', 'HyperScale', 'FinVantage', 'OmniData', 'CyberFlow', 'DataForge'].map(
              (brand, idx) => (
                <div key={idx} className="flex items-center gap-2 font-bold text-sm tracking-tight text-muted-foreground/70 hover:text-foreground transition-colors">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary font-black">
                    {brand.charAt(0)}
                  </div>
                  <span>{brand}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS — 3-STEP VISUAL                                  */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            Fast 3-Step Setup
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            From Zero to Autonomous Agent in{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
              Under 2 Minutes.
            </span>
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">
            No complex coding or engineering required. Simply connect your docs and go live.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {[
            {
              step: '01',
              icon: Brain,
              title: 'Train Your Agent',
              desc: 'Upload product docs, pricing PDFs, battle-cards, or paste your website URL. The AI digests everything instantly with zero hallucinations.',
              color: 'from-primary to-indigo-500',
            },
            {
              step: '02',
              icon: Workflow,
              title: 'Set Qualification Rules',
              desc: 'Define custom BANT criteria, set scoring thresholds, connect your Google/Outlook calendar, WhatsApp API, and CRM webhooks for auto-routing.',
              color: 'from-violet-500 to-purple-500',
            },
            {
              step: '03',
              icon: Rocket,
              title: 'Go Live & Close Deals',
              desc: 'Embed the snippet tag or share your WhatsApp number. Your agent engages visitors, books meetings, and feeds pipeline 24 hours a day.',
              color: 'from-emerald-500 to-teal-500',
            },
          ].map((item, i) => (
            <AnimatedSection key={i} delay={i * 100}>
              <div className="p-7 rounded-3xl border border-border/70 bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:shadow-lg transition-all group h-full flex flex-col justify-between">
                <div>
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md mb-5 group-hover:scale-105 transition-transform`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="text-[11px] font-black text-primary tracking-widest uppercase mb-1.5">Step {item.step}</div>
                  <h3 className="text-lg font-bold tracking-tight mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTERACTIVE ROI CALCULATOR (Animated, Responsive, No Jitter)  */}
      {/* ============================================================ */}
      <section id="calculator" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            <Calculator className="h-3 w-3 mr-1.5" /> Interactive ROI Simulator
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Calculate Your Revenue Upside With LeadAI.
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">
            Adjust your monthly visitor traffic and average deal size to see the immediate pipeline you are leaving on the table.
          </p>
        </AnimatedSection>

        <div className="w-full max-w-6xl mx-auto rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 sm:p-10 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Controls: Sliders & Quick Buttons */}
            <div className="lg:col-span-7 space-y-7">
              {/* Slider 1: Monthly Website Visitors */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-foreground">Monthly Website Visitors</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyVisitors((v) => Math.max(2000, v - 5000))}
                      className="h-7 w-7 rounded-lg border border-border/80 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Decrease by 5,000"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-black text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 min-w-[120px] text-center">
                      {monthlyVisitors.toLocaleString()} /mo
                    </span>
                    <button
                      type="button"
                      onClick={() => setMonthlyVisitors((v) => Math.min(200000, v + 5000))}
                      className="h-7 w-7 rounded-lg border border-border/80 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Increase by 5,000"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="2000"
                  max="150000"
                  step="1000"
                  value={monthlyVisitors}
                  onChange={(e) => setMonthlyVisitors(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />

                {/* Preset Chips */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-semibold mr-1">Presets:</span>
                  {[5000, 25000, 75000, 150000].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setMonthlyVisitors(val)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        monthlyVisitors === val
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider 2: Average Deal Value (ACV) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-foreground">Average Deal Value (ACV)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDealValue((d) => Math.max(500, d - 500))}
                      className="h-7 w-7 rounded-lg border border-border/80 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Decrease by $500"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-black text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 min-w-[120px] text-center">
                      ${dealValue.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDealValue((d) => Math.min(25000, d + 500))}
                      className="h-7 w-7 rounded-lg border border-border/80 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Increase by $500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="500"
                  max="20000"
                  step="250"
                  value={dealValue}
                  onChange={(e) => setDealValue(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />

                {/* Preset Chips */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-semibold mr-1">Presets:</span>
                  {[1000, 2500, 5000, 10000, 15000].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setDealValue(val)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        dealValue === val
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      ${val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Benchmark notes */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Assumes a modest +2.2% net qualification lift based on 800+ customer benchmark datasets.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Saves approximately {calculations.hoursSaved} manual SDR qualification hours each month.</span>
                </div>
              </div>
            </div>

            {/* Right Card: Dynamic Real-time Calculations */}
            <div className="lg:col-span-5 rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card p-6 sm:p-7 text-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Projected Added Pipeline
              </span>
              <div className="mt-2 text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                ${(calculations.monthlyPipeline / 1000).toFixed(1)}k
                <span className="text-base font-semibold text-muted-foreground"> / month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Estimated ${(calculations.annualPipeline / 1000000).toFixed(2)}M in annual opportunity value
              </p>

              <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-2 gap-4 text-left">
                <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">New Qualified Leads</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{calculations.qualifiedLeads} / mo
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">SDR Hours Saved</div>
                  <div className="text-lg font-black text-primary mt-0.5">
                    {calculations.hoursSaved} hrs / mo
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Estimated Software ROI:</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{calculations.roiMultiplier}x ROI</span>
              </div>

              <Link href="/auth/register" className="block mt-5">
                <Button variant="gradient" className="w-full font-bold h-11 shadow-md">
                  Capture This Pipeline Now <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES SHOWCASE — BENTO GRID                                */}
      {/* ============================================================ */}
      <section id="features" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            Full Suite
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Every Weapon Your Revenue Team Needs.
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">
            One platform replaces your chatbot, lead forms, SDR qualification calls, and meeting scheduler.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Bot, title: 'Custom Agent Personas', desc: 'Design specialists for Sales, Technical Pre-Sales, Pricing, or Support. Each with tailored tone, guardrails, and conversion goals.', color: 'bg-primary/10 text-primary' },
            { icon: Flame, title: 'Predictive Lead Scoring', desc: 'Dynamic BANT qualification scoring based on live conversation analysis and intent indicators to surface ready-to-buy prospects.', color: 'bg-amber-500/10 text-amber-500' },
            { icon: Calendar, title: 'Calendar Auto-Booking', desc: 'Native Google Calendar & Outlook integration. Proposes real-time availability and confirms calendar invites mid-conversation.', color: 'bg-emerald-500/10 text-emerald-500' },
            { icon: MessageSquare, title: 'WhatsApp Business API', desc: 'Seamless web-to-WhatsApp handoff. Continue conversations, send automated sequences, and never lose a dropped visitor.', color: 'bg-violet-500/10 text-violet-500' },
            { icon: Target, title: 'Visitor Intelligence', desc: 'IP geolocation, referrer tracking, scroll depth, and page-level intent signals feed your agent before the first reply is sent.', color: 'bg-rose-500/10 text-rose-500' },
            { icon: ShieldCheck, title: 'Enterprise Security', desc: 'SOC2 Type II certified. Multi-tenant workspace isolation, role-based access, data purge policies, and full audit logs.', color: 'bg-sky-500/10 text-sky-500' },
            { icon: Headphones, title: 'Live Human Takeover', desc: 'Instant Slack, WhatsApp, or SMS alerts when a high-value account hits your scoring threshold. Reps step in with 1 click.', color: 'bg-pink-500/10 text-pink-500' },
            { icon: LineChart, title: 'Revenue Analytics', desc: 'Real-time dashboards tracking conversations, qualification rates, booked demos, and ROI per channel and agent.', color: 'bg-teal-500/10 text-teal-500' },
            { icon: Globe2, title: '95+ Languages', desc: 'Auto-detect visitor language and converse fluently in Spanish, French, Japanese, German, Hindi, and 90+ more — zero setup.', color: 'bg-indigo-500/10 text-indigo-500' },
          ].map((f, i) => (
            <AnimatedSection key={i} delay={i * 60}>
              <div className="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/70 hover:shadow-md transition-all group h-full">
                <div className={`h-11 w-11 rounded-xl ${f.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold tracking-tight mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTEGRATIONS ECOSYSTEM                                        */}
      {/* ============================================================ */}
      <section className="py-12 sm:py-14 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-8">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            Ecosystem
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Plugs Into Your Entire Stack.
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 max-w-5xl mx-auto">
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
            <div
              key={i}
              className="p-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/40 hover:shadow-sm transition-all text-center flex flex-col items-center group"
            >
              <div className={`h-10 w-10 rounded-xl bg-muted/50 group-hover:bg-muted/80 flex items-center justify-center mb-2 ${t.color} transition-transform group-hover:scale-110`}>
                <t.icon className="h-5 w-5" />
              </div>
              <div className="font-bold text-xs text-foreground">{t.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* TESTIMONIALS (Static 3-column grid: ZERO page jumping!)       */}
      {/* ============================================================ */}
      <section id="results" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            Proven Growth
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Revenue Leaders Love LeadAI.
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">
            See how high-performing teams convert website traffic into recurring revenue.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/70 bg-card/50 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between hover:border-primary/40 hover:shadow-lg transition-all"
            >
              <div>
                <div className="flex text-amber-400 mb-4 gap-0.5">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-foreground">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.role}</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{t.metric}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">{t.metricLabel}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* PRICING (Exact app plans, rock-solid toggle, no jump)         */}
      {/* ============================================================ */}
      <section id="pricing" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            Transparent Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Start Free. Scale When Ready.</h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">
            14-day free trial on paid plans. No setup fees. Cancel anytime.
          </p>

          {/* Stable Monthly/Annual Switcher */}
          <div className="mt-6 inline-flex items-center p-1 rounded-full border border-border/80 bg-muted/40 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                billingCycle === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                billingCycle === 'annual' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">Save 20%</span>
            </button>
          </div>
        </AnimatedSection>

        {/* 4-column wide grid that spans the page */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan, i) => {
            const isAnnual = billingCycle === 'annual';
            // Display price: if annual, show monthly equivalent; if free, 0
            const displayPrice = isAnnual ? plan.yearlyMonthlyEquivalent : plan.priceMonthly;

            return (
              <div
                key={plan.name}
                className={`p-7 rounded-3xl flex flex-col justify-between h-full transition-all relative ${
                  plan.popular
                    ? 'border-2 border-primary bg-card shadow-xl shadow-primary/10'
                    : 'border border-border/70 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/70'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-violet-500 text-white text-[10px] font-black tracking-widest uppercase shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="font-bold text-lg text-foreground">{plan.name}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>

                  {/* Fixed min-height container for price to guarantee ZERO vertical jumping */}
                  <div className="mt-5 min-h-[76px] flex flex-col justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                        ${displayPrice}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground font-semibold">
                        /month
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-muted-foreground mt-1">
                      {plan.priceMonthly === 0 ? (
                        <span className="text-emerald-500 font-semibold">Free forever</span>
                      ) : isAnnual ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ${plan.priceYearly}/yr billed annually (Save ${plan.yearlySavings})
                        </span>
                      ) : (
                        <span>Billed monthly</span>
                      )}
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2.5 text-xs sm:text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border/50">
                  <Link href="/auth/register">
                    <Button
                      variant={plan.variant}
                      className={`w-full font-bold h-11 ${plan.popular ? 'shadow-lg shadow-primary/20' : ''}`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FAQ                                                           */}
      {/* ============================================================ */}
      <section id="faq" className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto relative z-10">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-primary border-primary/25 mb-3">
            FAQ
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Common Questions, Straight Answers.</h2>
        </AnimatedSection>

        <div className="space-y-3">
          {[
            { q: 'How fast can I go live?', a: 'Under 2 minutes. Paste one script tag before your closing </body> tag, or install via Google Tag Manager, WordPress, Webflow, or Shopify. Your agent starts engaging visitors immediately.' },
            { q: 'How does the AI learn about my product?', a: 'Upload PDFs, sales decks, pricing sheets, or paste your website URL. LeadAI securely digests your knowledge base and strictly answers within your documented boundaries — zero hallucinations.' },
            { q: 'Can my sales reps take over a live chat?', a: 'Yes. When a visitor asks for a human or their lead score crosses your threshold, your team gets an instant Slack, WhatsApp, or SMS notification and can seamlessly step into any conversation.' },
            { q: 'Does it work with WhatsApp?', a: 'Natively. Connect your official WhatsApp Business API number and continue conversations, send automated follow-up sequences, and link every chat to the same CRM contact record.' },
            { q: 'Is my data used to train public AI models?', a: 'Never. All data is isolated in private tenant containers with zero public LLM training. We are SOC2 Type II certified, GDPR compliant, and offer custom DPA agreements for Enterprise plans.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full px-6 py-4.5 text-left flex items-center justify-between font-bold text-sm sm:text-base text-foreground"
              >
                <span>{item.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-transform duration-200 ${expandedFaq === i ? 'rotate-180 text-primary' : ''}`} />
              </button>
              {expandedFaq === i && (
                <div className="px-6 pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FINAL CTA                                                     */}
      {/* ============================================================ */}
      <section className="py-14 sm:py-16 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto relative z-10">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-16 text-center border border-primary/30 bg-gradient-to-tr from-primary/10 via-violet-600/10 to-indigo-500/10">
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 mb-6">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Limited: First 100 signups get 30 days full Enterprise trial
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Stop Losing Website Visitors.<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
                Start Closing Deals Autonomously.
              </span>
            </h2>

            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Join 2,000+ revenue teams generating qualified pipeline 24/7 with zero SDR overhead.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register">
                <Button variant="gradient" size="lg" className="h-12 px-8 text-base font-bold shadow-xl shadow-primary/25 hover:scale-[1.02] transition-transform gap-2">
                  <Rocket className="h-4.5 w-4.5" />
                  Create Your Free Agent
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="h-12 px-7 font-bold border-border/80">
                  Sign In To Dashboard
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required · Deploy in 2 minutes · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-border/50 bg-muted/15 py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-3">
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
              All Systems Operational · 99.98% SLA
            </div>
          </div>

          {[
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'How It Works', href: '#how-it-works' }, { label: 'ROI Simulator', href: '#calculator' }, { label: 'Pricing', href: '#pricing' }] },
            { title: 'Resources', links: [{ label: 'Dashboard', href: '/auth/login' }, { label: 'FAQ', href: '#faq' }, { label: 'Security', href: '#features' }] },
            { title: 'Company', links: [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Service', href: '#faq' }, { label: 'Sign In', href: '/auth/login' }] },
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

        <div className="w-full max-w-7xl mx-auto mt-10 pt-5 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
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
