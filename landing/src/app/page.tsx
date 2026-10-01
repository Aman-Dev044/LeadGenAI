import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  Flame,
  Layers,
  MessageCircle,
  PhoneCall,
  PhoneForwarded,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo, LogoMark, PoweredBy } from '@/components/brand/logo';
import { Eyebrow } from '@/components/landing/eyebrow';
import { CountUp, HeroSpotlight, Reveal, ScrollProgress, WordRotate } from '@/components/landing/primitives';
import { LiveConsole } from '@/components/landing/live-console';
import { CallingSection } from '@/components/landing/calling-section';
import { SiteHeader } from '@/components/landing/site-header';
import { PricingSection } from '@/components/landing/pricing-section';
import { FaqSection } from '@/components/landing/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { landingGraph } from '@/lib/structured-data';
import { BRAND, COMPANY } from '@/lib/brand';
import { ROUTES } from '@/lib/site';
import {
  BENTO,
  CHANNELS_IN,
  CHANNELS_OUT,
  CLOSING_TILES,
  DASHBOARD_POINTS,
  ENTERPRISE,
  HERO_PROOF,
  LEAD_ROWS,
  OUTBOUND,
  STATS,
  STEPS,
  TESTIMONIALS,
  WITH,
  WITHOUT,
} from '@/lib/landing-data';

/**
 * The landing page.
 *
 * A server component: every headline, feature line, price and FAQ answer is in
 * the HTML before any JavaScript runs. Only the pieces that genuinely need
 * state — the scroll bar, the reveal observer, the live console, the theme
 * toggle, the pricing cycle and the FAQ accordion — are client islands.
 */
export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      <JsonLd data={landingGraph} />
      <ScrollProgress />

      {/* ---------------------------------------------------------------- */}
      {/* Ambient backdrop                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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

      <SiteHeader />

      <main id="main">
        {/* ---------------------------------------------------------------- */}
        {/* Hero — two columns so the full width is actually used              */}
        {/* ---------------------------------------------------------------- */}
        <HeroSpotlight>
          <section
            aria-labelledby="hero-heading"
            className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-10 pb-10 sm:px-6 lg:px-8"
          >
            <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_1fr] lg:gap-10">
              {/* Copy */}
              <div className="text-center lg:text-left">
                <Reveal>
                  <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-[11.5px] font-bold text-primary backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    AI that calls, follows up and books — inbound &amp; outbound
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
                      v3.0
                    </span>
                  </p>
                </Reveal>

                <Reveal delay={60}>
                  <h1
                    id="hero-heading"
                    className="mt-5 text-[2.6rem] leading-[1.05] font-black tracking-tight sm:text-6xl lg:text-[4rem]"
                  >
                    AI Leads Follow up,
                    <br />
                    tracking &amp;{' '}
                    <span className="relative inline-block">
                      <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                        calling software.
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-35"
                      />
                    </span>
                  </h1>
                </Reveal>

                <Reveal delay={110}>
                  <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] font-bold tracking-[0.11em] text-muted-foreground uppercase lg:justify-start">
                    <span>Add a lead from</span>
                    <WordRotate
                      words={['an Excel sheet', 'your website chat', 'WhatsApp', 'Google Maps', 'Reddit & HN']}
                    />
                    <span>— the AI calls it.</span>
                  </p>
                </Reveal>

                <Reveal delay={160}>
                  <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground lg:mx-0">
                    {BRAND.taglineLong} Within seconds of a lead landing, the agent is on the phone in
                    Hinglish, Hindi or English — qualifying, booking the meeting, sending the WhatsApp
                    confirmation and handing hot leads to your team with a due-by task.
                  </p>
                </Reveal>

                <Reveal delay={210}>
                  <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row lg:justify-start">
                    <a href={ROUTES.register} className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="gradient"
                        className="group h-12 w-full gap-2 px-7 text-[15px] font-bold sm:w-auto"
                      >
                        Start free — no card
                        <ArrowRight
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        />
                      </Button>
                    </a>
                    <a href="#calling" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 w-full gap-2 px-7 text-[15px] font-bold sm:w-auto"
                      >
                        <PhoneCall className="h-4 w-4" aria-hidden="true" /> See the AI call
                      </Button>
                    </a>
                  </div>
                </Reveal>

                <Reveal delay={260}>
                  <ul className="mt-7 grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
                    {HERO_PROOF.map((proof) => (
                      <li key={proof.label} className="text-center lg:text-left">
                        <span className="block text-xl font-black tracking-tight">{proof.value}</span>
                        <span className="block text-[10.5px] font-semibold text-muted-foreground">
                          {proof.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal delay={300}>
                  <p className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11.5px] text-muted-foreground lg:justify-start">
                    <span className="flex -space-x-2" aria-hidden="true">
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
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </span>
                    <span className="font-semibold">Trusted by revenue teams in 14 countries</span>
                  </p>
                </Reveal>
              </div>

              {/* Console + floating cards */}
              <Reveal delay={150} className="relative">
                <LiveConsole />

                <div
                  aria-hidden="true"
                  className="animate-float pointer-events-none absolute -top-4 -left-3 hidden rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl xl:block"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/12 text-rose-500">
                      <Flame className="h-3.5 w-3.5" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[11px] font-bold">Hot lead · interest 92</p>
                      <p className="text-[9.5px] text-muted-foreground">Assigned to Rahul · task due 2h</p>
                    </div>
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="animate-float pointer-events-none absolute -right-3 -bottom-4 hidden rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl xl:block"
                  style={{ animationDelay: '-3s' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-500">
                      <Calendar className="h-3.5 w-3.5" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[11px] font-bold">Meeting booked · Tomorrow 11:00</p>
                      <p className="text-[9.5px] text-muted-foreground">WhatsApp confirmation sent</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        </HeroSpotlight>

        {/* ---------------------------------------------------------------- */}
        {/* Channel strip — two marquees: what rings in, what it syncs out to  */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Supported channels and integrations" className="relative z-10 border-y border-border/50 bg-muted/20 py-5">
          <div className="mx-auto mb-3 flex w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <h2 className="text-[10px] font-black tracking-[0.18em] text-muted-foreground uppercase">
              Leads ring in from
            </h2>
            <h2 className="text-[10px] font-black tracking-[0.18em] text-muted-foreground uppercase">
              And sync out to
            </h2>
          </div>

          <div className="relative space-y-2.5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
            <div className="animate-marquee-x flex w-max gap-2.5 px-4">
              {[...CHANNELS_IN, ...CHANNELS_IN].map((channel, i) => (
                <span
                  key={`in-${channel.label}-${i}`}
                  aria-hidden={i >= CHANNELS_IN.length}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-1.5 text-[12px] font-bold whitespace-nowrap backdrop-blur-sm"
                >
                  <channel.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
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
                  aria-hidden={i >= CHANNELS_OUT.length}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Stats                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Results" className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <li key={stat.label}>
                <Reveal delay={i * 70}>
                  <div className="lit-border h-full rounded-2xl border border-border/60 bg-card/65 p-4 backdrop-blur-sm sm:p-5">
                    <p className="flex items-baseline gap-0.5">
                      <CountUp end={stat.value} className="tabular text-3xl font-black tracking-tight sm:text-4xl" />
                      <span className="text-xl font-black text-primary sm:text-2xl">{stat.suffix}</span>
                    </p>
                    <p className="mt-1.5 text-[12.5px] font-bold">{stat.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.sub}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Before / after split                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="gap-heading"
          className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-12 sm:px-6 lg:px-8"
        >
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <Reveal>
              <Eyebrow icon={Bell}>The gap</Eyebrow>
              <h2 id="gap-heading" className="text-3xl font-black tracking-tight sm:text-4xl">
                Most of your traffic never rings at all
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                A form, an inbox and a rep who signs off at six — everything that arrives after that
                simply leaves. {BRAND.name} answers all of it, scores it, and puts it in one place.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {['No lead left unanswered', 'No 14-hour first reply', 'No guessing who to call'].map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-[11.5px] font-semibold text-muted-foreground"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2">
              <Reveal delay={80}>
                <div className="h-full rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/12 text-rose-500">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-[12.5px] font-black tracking-wide uppercase">Without</h3>
                  </div>
                  <ul className="space-y-2">
                    {WITHOUT.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500/70" aria-hidden="true" />
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
                    <h3 className="text-[12.5px] font-black tracking-wide uppercase">
                      With {BRAND.name}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {WITH.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px]">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
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
        {/* AI calling — the core loop                                        */}
        {/* ---------------------------------------------------------------- */}
        <CallingSection />

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="how"
          aria-labelledby="how-heading"
          className="relative z-10 scroll-mt-20 border-y border-border/50 bg-muted/15 py-12"
        >
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
            <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
              <div>
                <Eyebrow icon={Workflow}>From a lead to a booked meeting</Eyebrow>
                <h2 id="how-heading" className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  Four steps. Then it calls without you.
                </h2>
              </div>
              <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                {BRAND.name} is calling leads the same afternoon you sign up — inside the hours you set,
                one lead after another, every day your competitors take off.
              </p>
            </Reveal>

            <ol className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-12 right-12 left-12 hidden h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent lg:block"
              />
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 90}>
                    <div className="lit-border group relative h-full rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/25">
                          <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <span aria-hidden="true" className="tabular text-2xl font-black text-muted-foreground/20">
                          0{i + 1}
                        </span>
                      </div>
                      <h3 className="text-[14.5px] font-bold">{step.title}</h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.text}</p>
                      <p className="mt-3 inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-black tracking-wider text-primary uppercase">
                        {step.meta}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Platform bento                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="platform"
          aria-labelledby="platform-heading"
          className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
        >
          <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <Eyebrow icon={Layers}>The platform</Eyebrow>
              <h2 id="platform-heading" className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
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
                <article
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
                    <cell.icon className="h-4.5 w-4.5" aria-hidden="true" />
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
                        Tools it can call mid-call and mid-chat
                      </p>
                      <ul className="grid grid-cols-2 gap-2">
                        {[
                          { icon: Calendar, label: 'book_appointment' },
                          { icon: PhoneCall, label: 'schedule_callback' },
                          { icon: PhoneForwarded, label: 'transferCall' },
                          { icon: MessageCircle, label: 'send_whatsapp' },
                          { icon: Send, label: 'capture_lead' },
                          { icon: Flame, label: 'update_lead_status' },
                        ].map((tool) => (
                          <li
                            key={tool.label}
                            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2"
                          >
                            <tool.icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            <span className="truncate font-mono text-[10px] font-semibold text-muted-foreground">
                              {tool.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* The inbox — the tagline, shown rather than claimed                 */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="inbox"
          aria-labelledby="inbox-heading"
          className="relative z-10 scroll-mt-20 border-y border-border/50 bg-muted/15 py-12"
        >
          <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-8 lg:px-8">
            <Reveal>
              <Eyebrow icon={Bell}>One inbox</Eyebrow>
              <h2 id="inbox-heading" className="text-3xl font-black tracking-tight sm:text-4xl">
                Chat, Maps, Reddit, tenders — <span className="text-gradient">one table</span>
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                No tab-hopping between a chat tool, a scraper spreadsheet and a CRM. Every lead lands
                in the same row format, scored and owned, whatever door it came through.
              </p>
              <ul className="mt-5 space-y-2.5">
                {DASHBOARD_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[13px]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
              <a href={ROUTES.register} className="mt-6 inline-flex">
                <Button variant="gradient" className="gap-2 font-bold">
                  Open your own inbox <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </a>
            </Reveal>

            <Reveal delay={120}>
              {/* A static picture of the product's Leads table, not a live one. */}
              <div
                aria-label="Preview of the LeadBells leads inbox"
                role="img"
                className="lit-border overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-float backdrop-blur-xl"
              >
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
        <section
          id="outbound"
          aria-labelledby="outbound-heading"
          className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
        >
          <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <Eyebrow icon={Radar}>Outbound AI</Eyebrow>
              <h2 id="outbound-heading" className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
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
                <article className="lit-border group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  />

                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md shadow-primary/25">
                      <card.icon className="h-5 w-5" aria-hidden="true" />
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
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>

                  <ul className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-4">
                    {card.chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Enterprise + testimonials, stacked in one band to keep it dense   */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="enterprise-heading"
          className="relative z-10 border-y border-border/50 bg-muted/15 py-12"
        >
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
            <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
              <div>
                <Eyebrow icon={ShieldCheck}>Built for real companies</Eyebrow>
                <h2 id="enterprise-heading" className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  Enterprise bones, startup setup time
                </h2>
              </div>
              <Link href="/privacy">
                <Button variant="outline" className="gap-2 font-bold">
                  Read the privacy policy <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </Reveal>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ENTERPRISE.map((item, i) => (
                <li key={item.label}>
                  <Reveal delay={i * 60}>
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="leading-snug">
                        <h3 className="text-[13px] font-bold">{item.label}</h3>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {TESTIMONIALS.map((item, i) => (
                <Reveal key={item.name} delay={i * 90}>
                  <figure className="lit-border flex h-full flex-col rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex gap-0.5" aria-hidden="true">
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
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-black text-white"
                      >
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

        <PricingSection />
        <FaqSection />

        {/* ---------------------------------------------------------------- */}
        {/* Closing CTA                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="cta-heading"
          className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8"
        >
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-primary/25 px-6 py-10 sm:px-12 sm:py-12">
              <div
                aria-hidden="true"
                className="animate-gradient-pan absolute inset-0 -z-10 bg-[linear-gradient(120deg,#4F46E5,#7C3AED,#C026D3,#7C3AED,#4F46E5)] opacity-95"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]"
              />

              <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="text-center lg:text-left">
                  <LogoMark className="mx-auto h-12 w-12 lg:mx-0" />
                  <h2
                    id="cta-heading"
                    className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
                  >
                    Your next customer is on the site right now.
                  </h2>
                  <p className="mt-3 max-w-xl text-[14.5px] text-white/85">
                    {BRAND.signature}. Switch it on in two minutes and let the agent take the first
                    conversation — tonight, while you sleep.
                  </p>

                  <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row lg:justify-start">
                    <a href={ROUTES.register} className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="group h-12 w-full gap-2 bg-white px-8 text-[15px] font-black text-indigo-700 shadow-lg hover:bg-white/90 sm:w-auto"
                      >
                        Start free
                        <ArrowRight
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        />
                      </Button>
                    </a>
                    <a href={ROUTES.login} className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 w-full border-white/35 bg-white/10 px-8 text-[15px] font-bold text-white hover:bg-white/20 hover:text-white sm:w-auto"
                      >
                        Sign in
                      </Button>
                    </a>
                  </div>

                  <p className="mt-5 text-[11.5px] text-white/70">
                    No credit card required · Deploy in two minutes · Cancel anytime
                  </p>
                </div>

                <ul className="grid grid-cols-2 gap-2.5">
                  {CLOSING_TILES.map((tile) => (
                    <li
                      key={tile.label}
                      className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
                    >
                      <tile.icon className="mb-2 h-4 w-4 text-white/80" aria-hidden="true" />
                      <span className="tabular block text-2xl font-black text-white">{tile.value}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-tight text-white/70">
                        {tile.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

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
            <ul className="flex flex-wrap gap-1.5">
              {['Multi-tenant', 'RBAC', 'Audit trail', 'Webhooks', 'REST API'].map((badge) => (
                <li
                  key={badge}
                  className="rounded-md border border-border/60 bg-card/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {badge}
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              All systems operational · 99.98% uptime
            </p>
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
                { label: 'Dashboard', href: ROUTES.dashboard },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Create account', href: ROUTES.register },
              ],
            },
            {
              title: 'Company',
              links: [
                { label: COMPANY.shortName, href: COMPANY.url },
                { label: 'Privacy policy', href: '/privacy' },
                { label: 'Sign in', href: ROUTES.login },
              ],
            },
          ].map((column) => (
            <nav key={column.title} aria-label={column.title} className="space-y-2.5">
              <h2 className="text-[9.5px] font-black tracking-[0.15em] uppercase">{column.title}</h2>
              <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                {column.links.map((link) => {
                  const external = link.href.startsWith('http');
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith(COMPANY.url) ? '_blank' : undefined}
                          rel={link.href.startsWith(COMPANY.url) ? 'noopener noreferrer' : undefined}
                          className="transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="transition-colors hover:text-foreground">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
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
