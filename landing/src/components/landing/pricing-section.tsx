'use client';

import { useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/landing/eyebrow';
import { Reveal } from '@/components/landing/primitives';
import { PLANS, PLAN_EXTRAS } from '@/lib/landing-data';
import { BRAND } from '@/lib/brand';
import { ROUTES } from '@/lib/site';

/**
 * Pricing, with a monthly/annual toggle.
 *
 * Client-side for the toggle alone — the whole table still server-renders at
 * the annual price, so the copy and every feature line are in the HTML the
 * crawler reads, matching the `Offer` entries in the page's JSON-LD.
 */
export function PricingSection() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="relative z-10 mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
    >
      <Reveal className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Eyebrow icon={BarChart3}>Pricing</Eyebrow>
          <h2 id="pricing-heading" className="text-3xl font-black tracking-tight sm:text-4xl">
            Priced per plan. Not per missed lead.
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] text-muted-foreground">
            {BRAND.tagline} — starting at nothing. Upgrade when the pipeline says you should.
          </p>
        </div>

        <div
          role="group"
          aria-label="Billing cycle"
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 backdrop-blur-sm"
        >
          {(['monthly', 'annual'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCycle(option)}
              aria-pressed={cycle === option}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-[13px] font-bold capitalize transition-colors ${
                cycle === option
                  ? 'bg-brand-gradient text-white shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option}
              {option === 'annual' && (
                <span className="ml-1.5 text-[10px] font-black opacity-90">−20%</span>
              )}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, i) => {
          const perMonth = cycle === 'annual' ? Math.round(plan.yearly / 12) : plan.monthly;
          return (
            <Reveal key={plan.name} delay={i * 70}>
              <article
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

                <h3 className="text-[14.5px] font-bold">{plan.name}</h3>
                <p className="text-[11.5px] text-muted-foreground">{plan.tagline}</p>

                <p className="mt-4 flex items-baseline gap-1">
                  <span className="tabular text-4xl font-black tracking-tight">${perMonth}</span>
                  <span className="text-[12.5px] font-semibold text-muted-foreground">/mo</span>
                </p>
                {/* Reserved line keeps every card the same height on both cycles */}
                <p className="mt-1 h-4 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {cycle === 'annual' && plan.yearly > 0
                    ? `$${plan.yearly} billed yearly · save $${plan.monthly * 12 - plan.yearly}`
                    : ' '}
                </p>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12px]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a href={ROUTES.register} className="mt-5 block">
                  <Button variant={plan.variant} className="w-full font-bold">
                    {plan.cta}
                    <span className="sr-only"> — {plan.name} plan</span>
                  </Button>
                </a>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={120}>
        <ul className="mt-3 grid gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_EXTRAS.map((extra) => (
            <li key={extra.label} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <extra.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[12.5px] font-semibold">{extra.label}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
