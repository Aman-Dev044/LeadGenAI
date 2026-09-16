'use client';

import React, { useState, useMemo } from 'react';
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
  Send,
  Building2,
  Check,
  ChevronDown,
  Moon,
  Sun,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LandingPage() {
  const { theme, setTheme } = useUIStore();

  // ROI Calculator State
  const [monthlyVisitors, setMonthlyVisitors] = useState<number>(25000);
  const [dealValue, setDealValue] = useState<number>(3500);

  // Live Agent Simulator State
  const [activeScenario, setActiveScenario] = useState<number>(0);
  const [customInput, setCustomInput] = useState('');
  const [simulatedChat, setSimulatedChat] = useState<
    Array<{ sender: 'ai' | 'visitor'; text: string; time: string; badge?: string }>
  >([
    {
      sender: 'ai',
      text: 'Hi there! 👋 Welcome to Acme Cloud. Looking to accelerate your team’s deployment speed or reduce cloud spend today?',
      time: '11:42 AM',
      badge: 'Agent Alex · AI Sales Specialist',
    },
    {
      sender: 'visitor',
      text: 'We are spending around $15,000/mo on AWS and deployments are taking too long. Do you have an enterprise integration?',
      time: '11:43 AM',
    },
    {
      sender: 'ai',
      text: 'Absolutely! Our native Kubernetes & AWS engine cuts pipeline times by 68% and typically saves teams 25-40% on compute. With your scale, our Enterprise Tier is ideal.',
      time: '11:43 AM',
      badge: 'Intent Score: 96/100 (Hot Buyer 🔥)',
    },
    {
      sender: 'ai',
      text: 'Would you like to see a tailored 15-minute architecture walkthrough with our Principal Engineer tomorrow at 2:00 PM EST?',
      time: '11:43 AM',
      badge: 'Calendar Slot Proposed',
    },
  ]);

  // Pricing State (Monthly / Annual)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Calculation for ROI
  const estimatedLeads = useMemo(() => {
    return Math.round(monthlyVisitors * 0.024);
  }, [monthlyVisitors]);

  const estimatedPipeline = useMemo(() => {
    return estimatedLeads * dealValue;
  }, [estimatedLeads, dealValue]);

  const scenarios = [
    {
      label: 'Enterprise Qualification',
      query: 'We have 200+ employees and need SOC2 compliance. Can we trial?',
      reply:
        'Yes! We are SOC2 Type II certified with complete end-to-end encryption. I can spin up a sandbox enterprise workspace and connect you with our compliance architect right away.',
      score: '98/100 · Enterprise Tier',
    },
    {
      label: 'Pricing & ROI',
      query: 'What is the cost for 5 agents and 20,000 conversations/month?',
      reply:
        'Our Growth Plan covers unlimited visitor engagement with up to 10 agents at $149/mo (or $119/mo paid annually). That includes full WhatsApp, CRM sync, and custom knowledge ingestion!',
      score: '88/100 · Ready to Purchase',
    },
    {
      label: 'WhatsApp & Omnichannel',
      query: 'Can the same AI agent answer our WhatsApp inbound inquiries?',
      reply:
        'Yes, seamlessly! Any chat started on WhatsApp links directly to the same customer CRM record, with automated message triggers and live human agent handoff.',
      score: '92/100 · High Intent',
    },
  ];

  const handleScenarioClick = (idx: number) => {
    setActiveScenario(idx);
    const s = scenarios[idx];
    setSimulatedChat((prev) => [
      ...prev,
      { sender: 'visitor', text: s.query, time: 'Just now' },
      { sender: 'ai', text: s.reply, time: 'Just now', badge: s.score },
    ]);
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const text = customInput;
    setCustomInput('');
    setSimulatedChat((prev) => [
      ...prev,
      { sender: 'visitor', text, time: 'Just now' },
      {
        sender: 'ai',
        text: `Thanks for asking! Our autonomous agent analyzes "${text}" in real time, applies your company knowledge base, and executes your conversion playbook instantly.`,
        time: 'Just now',
        badge: 'Intent Analyzed · Live Response',
      },
    ]);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary transition-colors duration-300">
      {/* Subtle Background Glow Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-tr from-primary/15 via-violet-500/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[45%] -left-40 w-[600px] h-[500px] bg-primary/10 blur-[130px] rounded-full" />
        <div className="absolute top-[75%] -right-40 w-[600px] h-[500px] bg-violet-600/10 blur-[130px] rounded-full" />
      </div>

      {/* ============================================================ */}
      {/* 1. TOP NAVIGATION BAR                                         */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/60 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Version */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 group-hover:text-primary transition-colors">
                  LeadAI<span className="text-primary font-black">.</span>
                </span>
              </div>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v2.4 Live
            </span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#simulator" className="hover:text-foreground transition-colors">
              Live AI Demo
            </a>
            <a href="#calculator" className="hover:text-foreground transition-colors">
              ROI Calculator
            </a>
            <a href="#integrations" className="hover:text-foreground transition-colors">
              Integrations
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="font-semibold text-sm">
                Sign In
              </Button>
            </Link>

            <Link href="/auth/register">
              <Button
                variant="gradient"
                size="sm"
                className="font-semibold text-sm shadow-md shadow-primary/25 hover:shadow-primary/40 gap-1.5"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION                                              */}
      {/* ============================================================ */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Shimmer Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary/10 border border-primary/25 text-primary mb-8 shadow-sm backdrop-blur-md animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" style={{ animationDuration: '8s' }} />
          <span>Next-Generation Autonomous Inbound AI Platform</span>
          <span className="text-muted-foreground">·</span>
          <a href="#features" className="text-primary underline cursor-pointer">Explore Capabilities &rarr;</a>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.12]">
          Turn Anonymous Website Visitors Into{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-violet-500 to-indigo-400">
            High-Value Paying Deals
          </span>{' '}
          on Autopilot.
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto font-normal leading-relaxed">
          Deploy intelligent AI sales agents trained on your business knowledge. Engage inbound traffic 24/7 across web &
          WhatsApp, automatically qualify enterprise intent, book calendar demos, and close pipeline while you sleep.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link href="/auth/register" className="w-full sm:w-auto">
            <Button
              variant="gradient"
              size="lg"
              className="w-full sm:w-auto text-base font-semibold h-12 px-8 shadow-lg shadow-primary/30 hover:scale-[1.02] transition-transform gap-2"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#simulator" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-base font-semibold h-12 px-6 border-border hover:bg-muted/60 gap-2"
            >
              <Play className="h-4 w-4 fill-current text-primary" />
              <span>Try Live Simulator</span>
            </Button>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>2-minute script embed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>SOC2 Type II & GDPR Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <span className="font-semibold text-foreground">4.9/5</span>
            <span>(850+ reviews)</span>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md text-left shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Conversion Boost</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground">+340%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Average inbound demo jump</div>
          </div>
          <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md text-left shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground">&lt; 1.1s</div>
            <div className="text-xs text-muted-foreground mt-0.5">Instant visitor engagement</div>
          </div>
          <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md text-left shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Leads Qualified</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground">1.8M+</div>
            <div className="text-xs text-muted-foreground mt-0.5">Scored & synced to CRM</div>
          </div>
          <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md text-left shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Global Languages</span>
              <Globe2 className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground">95+</div>
            <div className="text-xs text-muted-foreground mt-0.5">Native multi-language chat</div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. LOGO MARQUEE                                              */}
      {/* ============================================================ */}
      <section className="py-12 border-y border-border/60 bg-muted/20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
            Empowering modern high-growth sales teams & enterprises globally
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-70 grayscale hover:grayscale-0 transition-all duration-300">
            {['TrackBells', 'NexusTech', 'CloudPulse', 'HyperScale', 'FinVantage', 'OmniData', 'CyberFlow'].map(
              (brand, idx) => (
                <div key={idx} className="flex items-center gap-2 font-bold text-lg tracking-tight">
                  <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-xs text-primary font-black">
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
      {/* 4. LIVE INTERACTIVE AGENT SIMULATOR                         */}
      {/* ============================================================ */}
      <section id="simulator" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Interactive Live Sandbox
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            See How Your Autonomous Agent Converts In Real-Time.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Test the live reasoning engine. Watch the agent evaluate buyer intent, calculate lead score, and trigger calendar
            scheduling in split seconds.
          </p>
        </div>

        {/* Simulator Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Chat Window */}
          <div className="lg:col-span-7 rounded-3xl border border-border/90 bg-card shadow-2xl shadow-primary/10 overflow-hidden flex flex-col h-[560px]">
            {/* Window Header */}
            <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white font-bold">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                </div>
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>Alex · Inbound SDR Agent</span>
                    <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.2 rounded font-medium">AI Active</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Trained on Product Docs & Enterprise Playbook</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Active Session #9241</span>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-background/50">
              {simulatedChat.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === 'visitor' ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.sender === 'visitor'
                        ? 'bg-primary text-primary-foreground rounded-br-xs shadow-md'
                        : 'bg-card border border-border/80 text-card-foreground rounded-bl-xs shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground">
                    <span>{msg.time}</span>
                    {msg.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {msg.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Prompt Buttons & Input Form */}
            <div className="p-3 border-t border-border bg-card/90">
              <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 text-xs">
                <span className="text-muted-foreground text-[11px] shrink-0 font-medium">Quick Prompts:</span>
                {scenarios.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => handleScenarioClick(i)}
                    className={`px-2.5 py-1 rounded-full border text-xs whitespace-nowrap transition-all ${
                      activeScenario === i
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCustomSend} className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Type your question or objection here..."
                  className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button type="submit" size="sm" variant="gradient" className="rounded-xl px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right: Telemetry Cards */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-3xl border border-border bg-card/80 backdrop-blur-md shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-rose-500" />
                  Real-time Intent Scoring
                </span>
                <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold">HOT BUYER</Badge>
              </div>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-black text-foreground">96</div>
                <div className="text-sm text-muted-foreground pb-1">/ 100 Intent Confidence</div>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 mt-3 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-primary h-full w-[96%] rounded-full" />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Trigger factors: AWS high spend ($15k/mo), enterprise deployment bottleneck, direct architecture inquiry.
              </div>
            </div>

            <div className="p-5 rounded-3xl border border-border bg-card/80 backdrop-blur-md shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Automated Entity Extraction
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="text-muted-foreground text-[11px]">Estimated Size</div>
                  <div className="font-bold text-foreground mt-0.5">50 - 200 Employees</div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="text-muted-foreground text-[11px]">Primary Tech Stack</div>
                  <div className="font-bold text-foreground mt-0.5">AWS & Kubernetes</div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="text-muted-foreground text-[11px]">Annual Value</div>
                  <div className="font-bold text-foreground mt-0.5">$24,000 ARR</div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="text-muted-foreground text-[11px]">Conversion Step</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Demo Scheduled</div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-3xl border border-border bg-card/80 backdrop-blur-md shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                Autonomous Automation Handshake
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  <span>Google Calendar invite dispatched with Google Meet link</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  <span>Lead record created in HubSpot / Salesforce with 96 score</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  <span>VIP alert triggered in Slack #sales-enterprise channel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. CORE PLATFORM CAPABILITIES                                */}
      {/* ============================================================ */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 border-t border-border/60">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Engineered For Revenue Teams
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Everything You Need To Dominate Inbound Pipeline.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Say goodbye to static forms that kill conversion rates. Replace them with proactive, human-grade conversational AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Custom AI Agent Personas</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Design distinct agents for Sales, Technical Architecture, Pricing, or Customer Support. Set exact tone, guardrails,
              and conversion objectives.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all">
              <Flame className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Predictive Lead Scoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dynamically scores visitors based on BANT criteria (Budget, Authority, Need, Timeline) and website behavior to
              prioritize high-value buyers.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">1-Click Calendar Booking</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connects directly to Google Calendar & Outlook. Proposes real-time availability and confirms appointments directly
              inside the conversation window.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-violet-500 group-hover:text-white transition-all">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">WhatsApp & Multi-Channel</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Never lose a lead who navigates away. Automatically transition website chats to official WhatsApp Business numbers
              with automated follow-up sequences.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Visitor Journey Tracking</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Uncover visitor IP geolocation, referring campaigns, pages visited, time spent, and scroll depth before the AI
              engages.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Enterprise Multi-Tenant Security</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Multi-workspace isolation, strict role-based access control, automated data purge policies, audit trails, and zero
              data leakage guarantees.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. INTERACTIVE PIPELINE & ROI CALCULATOR                     */}
      {/* ============================================================ */}
      <section id="calculator" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto relative z-10">
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card to-background p-8 sm:p-12 shadow-2xl shadow-primary/10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-2">
              ROI Projection Engine
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Calculate Your Revenue Upside With LeadAI.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Adjust your monthly visitor traffic and average deal size to see the immediate pipeline you are leaving on the
              table.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Left: Sliders */}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-foreground">Monthly Website Visitors</label>
                  <span className="text-sm font-bold text-primary">{monthlyVisitors.toLocaleString()} visits/mo</span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="150000"
                  step="1000"
                  value={monthlyVisitors}
                  onChange={(e) => setMonthlyVisitors(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>2,000</span>
                  <span>75,000</span>
                  <span>150,000+</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-foreground">Average Deal Value (ACV)</label>
                  <span className="text-sm font-bold text-primary">${dealValue.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="20000"
                  step="250"
                  value={dealValue}
                  onChange={(e) => setDealValue(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>$500</span>
                  <span>$10,000</span>
                  <span>$20,000+</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Assumes a modest +2.4% net qualification uplift based on 800+ customer data sets.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Saves approximately 320 SDR qualification hours each month.</span>
                </div>
              </div>
            </div>

            {/* Right: Projected Revenue Card */}
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center flex flex-col justify-center items-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Projected Added Pipeline</span>
              <div className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                ${(estimatedPipeline / 1000).toFixed(1)}k
                <span className="text-lg font-bold text-muted-foreground"> / mo</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-6">
                Estimated from <strong className="text-foreground">{estimatedLeads} new qualified buyers</strong> every month.
              </p>

              <div className="w-full pt-4 border-t border-border/80 flex items-center justify-around text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-500">28x</div>
                  <div className="text-[11px] text-muted-foreground">Estimated ROI</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">100%</div>
                  <div className="text-[11px] text-muted-foreground">24/7 Coverage</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">&lt; 2 mins</div>
                  <div className="text-[11px] text-muted-foreground">Deployment Time</div>
                </div>
              </div>

              <Link href="/auth/register" className="w-full mt-6">
                <Button variant="gradient" className="w-full font-semibold shadow-md">
                  Capture This Pipeline Now &rarr;
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. INTEGRATIONS ECOSYSTEM                                    */}
      {/* ============================================================ */}
      <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Connected Everywhere
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Syncs Seamlessly With Your Modern Tech Stack.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            No messy duct-tape scripts. Plug into your favorite CRM, calendar, communication tools, and webhooks in 1 click.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {[
            { name: 'WhatsApp Business', desc: 'Real-time 2-way chat', icon: MessageSquare, color: 'text-emerald-500' },
            { name: 'HubSpot CRM', desc: 'Auto contact & deal sync', icon: Building2, color: 'text-amber-500' },
            { name: 'Salesforce', desc: 'Enterprise lead routing', icon: Layers, color: 'text-sky-500' },
            { name: 'Slack', desc: 'Instant VIP buyer pings', icon: MessageSquare, color: 'text-violet-500' },
            { name: 'Google Calendar', desc: 'Auto demo scheduling', icon: Calendar, color: 'text-rose-500' },
            { name: 'Outlook 365', desc: 'Meeting sync & invites', icon: Calendar, color: 'text-blue-500' },
            { name: 'Zapier', desc: '5,000+ app connectors', icon: Zap, color: 'text-orange-500' },
            { name: 'Custom Webhooks', desc: 'REST JSON payloads', icon: Cpu, color: 'text-indigo-500' },
            { name: 'Stripe', desc: 'In-chat payment links', icon: DollarSign, color: 'text-purple-500' },
            { name: 'Segment', desc: 'Unified customer data', icon: BarChart3, color: 'text-teal-500' },
          ].map((tool, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all text-center flex flex-col items-center"
            >
              <div className={`h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center mb-3 ${tool.color}`}>
                <tool.icon className="h-5 w-5" />
              </div>
              <div className="font-bold text-sm text-foreground">{tool.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{tool.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. CUSTOMER TESTIMONIALS                                     */}
      {/* ============================================================ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 border-t border-border/60">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Customer Success Stories
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Loved By High-Performing Revenue Leaders.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              quote:
                'LeadAI replaced our boring static contact forms. In the very first month, our inbound demo bookings went from 42 to 178 without increasing ad spend by a single dollar.',
              name: 'Sarah Jenkins',
              role: 'VP of Demand Gen, CloudScale',
              metric: '+324% Demos Booked',
            },
            {
              quote:
                'The WhatsApp handoff feature is pure magic. A visitor asks a question on our site at 11 PM, and our agent books a meeting and sends them a WhatsApp confirmation in under 60 seconds.',
              name: 'Marcus Vance',
              role: 'Chief Revenue Officer, FinVantage',
              metric: '4x Faster Pipeline Speed',
            },
            {
              quote:
                'We sell globally across Europe, Japan, and Latin America. Having an agent that speaks fluent French, Japanese, and Spanish with zero latency transformed our international ARR.',
              name: 'Elena Rostova',
              role: 'Head of Global Growth, Nexus Tech',
              metric: '$2.1M Added Pipeline',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl border border-border bg-card/70 flex flex-col justify-between shadow-sm hover:shadow-lg transition-all"
            >
              <div>
                <div className="flex text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground italic leading-relaxed">"{item.quote}"</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/70 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.role}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {item.metric}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 9. TRANSPARENT PRICING                                       */}
      {/* ============================================================ */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Predictable Plans
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Simple Pricing Built For Every Stage.</h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            No hidden setup charges. 14-day free trial on all plans. Cancel anytime.
          </p>

          <div className="mt-8 inline-flex items-center p-1 rounded-full border border-border bg-muted/50">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                billingCycle === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                billingCycle === 'annual' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Starter Plan */}
          <div className="p-8 rounded-3xl border border-border bg-card/60 flex flex-col justify-between shadow-sm">
            <div>
              <div className="font-bold text-lg text-foreground">Starter</div>
              <p className="text-xs text-muted-foreground mt-1">Perfect for founders and single product teams.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">{billingCycle === 'annual' ? '$39' : '$49'}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>

              <div className="mt-6 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>1 Autonomous AI Agent Persona</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>1,500 Inbound Conversations / mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Website Chat Widget</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Basic Lead Scoring & Email Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Knowledge base upload (up to 10 docs)</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/auth/register">
                <Button variant="outline" className="w-full font-semibold">
                  Start Starter Trial
                </Button>
              </Link>
            </div>
          </div>

          {/* Growth Plan */}
          <div className="p-8 rounded-3xl border-2 border-primary bg-card shadow-xl shadow-primary/15 relative flex flex-col justify-between scale-[1.03]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-bold tracking-wide uppercase shadow-sm">
              Most Popular
            </div>
            <div>
              <div className="font-bold text-lg text-foreground">Growth Scale</div>
              <p className="text-xs text-muted-foreground mt-1">For expanding sales & marketing teams.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">{billingCycle === 'annual' ? '$119' : '$149'}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>

              <div className="mt-6 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Up to 5 Specialized AI Agents</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>15,000 Inbound Conversations / mo</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Full WhatsApp Business Integration</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Google & Outlook Calendar Booking</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>HubSpot, Salesforce & Slack Sync</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited Knowledge Docs & Website Crawling</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/auth/register">
                <Button variant="gradient" className="w-full font-semibold shadow-md shadow-primary/30">
                  Start 14-Day Free Trial
                </Button>
              </Link>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="p-8 rounded-3xl border border-border bg-card/60 flex flex-col justify-between shadow-sm">
            <div>
              <div className="font-bold text-lg text-foreground">Enterprise</div>
              <p className="text-xs text-muted-foreground mt-1">For large companies demanding maximum compliance & volume.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">{billingCycle === 'annual' ? '$399' : '$499'}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>

              <div className="mt-6 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited Custom AI Agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited Conversations & Visitors</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Custom LLM Fine-Tuning & Private Models</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>SOC2 Type II & Custom DPA Agreement</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Dedicated Account Manager & 99.99% SLA</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/auth/register">
                <Button variant="outline" className="w-full font-semibold">
                  Contact Enterprise Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 10. FAQ ACCORDION                                            */}
      {/* ============================================================ */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto relative z-10 border-t border-border/60">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-primary border-primary/30 mb-3">
            Got Questions?
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'How fast can I deploy LeadAI on my website?',
              a: 'You can deploy in less than 2 minutes. Just paste a single script tag before the closing </body> tag of your website or install via Google Tag Manager, WordPress, Webflow, or Shopify.',
            },
            {
              q: 'How does the AI know about our specific pricing and product?',
              a: 'You can upload your PDF manuals, sales decks, pricing sheets, or simply paste your website URL. LeadAI securely digests your knowledge base and only gives answers strictly bounded by your documents.',
            },
            {
              q: 'Can human sales reps take over the live chat at any time?',
              a: 'Yes, absolutely. The instant a visitor requests a human or their lead score crosses your threshold, LeadAI notifies your sales team via Slack, WhatsApp, or SMS, allowing a human rep to step in seamlessly.',
            },
            {
              q: 'Does it support WhatsApp and multi-lingual conversations?',
              a: 'Yes! LeadAI natively supports over 95 languages with automatic language detection, and connects directly with official WhatsApp Business API numbers for continuous engagement.',
            },
            {
              q: 'Is my data safe and used to train public models?',
              a: 'Never. All customer data and proprietary knowledge bases are isolated in isolated tenant containers with zero public LLM training, fully adhering to SOC2, GDPR, and enterprise security standards.',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card/60 overflow-hidden transition-colors"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full px-6 py-4 text-left flex items-center justify-between font-bold text-sm sm:text-base text-foreground"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    expandedFaq === i ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>
              {expandedFaq === i && (
                <div className="px-6 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 11. FINAL HIGH-CONVERSION CTA BANNER                         */}
      {/* ============================================================ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-16 text-center border border-primary/40 bg-gradient-to-tr from-primary/20 via-violet-600/20 to-primary/10 backdrop-blur-2xl shadow-2xl">
          <div className="absolute inset-0 bg-radial from-primary/20 to-transparent blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30 mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Start Capturing Inbound Revenue Today
            </span>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Ready To Turn Every Website Visitor Into A Closed Deal?
            </h2>

            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Join 2,000+ fast-moving revenue teams that trust LeadAI to generate qualified pipeline around the clock.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full sm:w-auto font-bold h-12 px-8 text-base shadow-lg shadow-primary/30"
                >
                  Create Your Free AI Agent Now &rarr;
                </Button>
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto font-semibold h-12 px-6">
                  Sign In To Dashboard
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required · 14-day free trial · Setup in 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 12. COMPREHENSIVE FOOTER                                     */}
      {/* ============================================================ */}
      <footer className="border-t border-border/80 bg-muted/20 py-16 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-white font-bold">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                LeadAI<span className="text-primary font-black">.</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              The autonomous AI agent platform that turns anonymous website traffic into verified calendar meetings, qualified
              leads, and accelerated pipeline.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>All Systems Operational (99.98% SLA)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">Product</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Autonomous Agents
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-foreground transition-colors">
                  Live Simulator
                </a>
              </li>
              <li>
                <a href="#calculator" className="hover:text-foreground transition-colors">
                  ROI Calculator
                </a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-foreground transition-colors">
                  WhatsApp & CRM Sync
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground transition-colors">
                  Pricing Plans
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">Resources</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Documentation & FAQ
                </a>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Security & Privacy
                </Link>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  API Reference
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">Company</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  SOC2 Compliance
                </a>
              </li>
              <li>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} LeadAI Technologies Inc. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <a href="#faq" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
