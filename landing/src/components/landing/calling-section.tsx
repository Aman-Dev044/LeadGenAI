import { CheckCircle2 } from 'lucide-react';
import { Eyebrow } from '@/components/landing/eyebrow';
import { Reveal } from '@/components/landing/primitives';
import { CALLING_FEATURES, CALLING_FLOW, CALLING_PIPELINE, CALLING_PROOF } from '@/lib/landing-data';
import { BRAND } from '@/lib/brand';
import { PhoneCall } from 'lucide-react';

/**
 * The AI calling engine, shown as the loop it really is: a lead arrives, the
 * agent phones it within seconds, and every branch — no answer, interested,
 * meeting, cold — has an automatic next move. Server component; only the
 * reveal animation hydrates.
 */
export function CallingSection() {
  return (
    <section
      id="calling"
      aria-labelledby="calling-heading"
      className="relative z-10 scroll-mt-20 border-y border-border/50 bg-muted/15 py-14"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Eyebrow icon={PhoneCall}>AI calling &amp; follow-up</Eyebrow>
            <h2 id="calling-heading" className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Add the lead. <span className="text-gradient">The AI picks up the phone.</span>
            </h2>
          </div>
          <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Name, phone and a line about what they want — from a form, a sheet or a chat. Within
            seconds {BRAND.name} is on a call in Hinglish, Hindi or English, qualifying like a human,
            booking the meeting and messaging the details on WhatsApp.
          </p>
        </Reveal>

        {/* Proof strip */}
        <Reveal delay={60}>
          <ul className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm sm:grid-cols-4">
            {CALLING_PROOF.map((p) => (
              <li key={p.label} className="flex items-center gap-3 px-2 py-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-lg font-black tracking-tight">{p.value}</span>
                  <span className="block text-[10.5px] font-semibold text-muted-foreground">{p.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* The loop */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <Reveal delay={80}>
            <p className="mb-4 text-[10.5px] font-black tracking-[0.13em] text-muted-foreground uppercase">
              What happens after you add a lead
            </p>
            <ol className="relative space-y-3 border-l border-border/70 pl-6">
              {CALLING_FLOW.map((step, i) => (
                <li key={step.title} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                      step.branch ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-brand-gradient text-white'
                    }`}
                  >
                    <step.icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="lit-border rounded-xl border border-border/60 bg-card/75 px-4 py-3 backdrop-blur-sm transition-transform duration-300 hover:-translate-x-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13.5px] font-bold">{step.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-wider uppercase ${
                          step.branch ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-primary/8 text-primary'
                        }`}
                      >
                        {step.meta}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                  {i === CALLING_FLOW.length - 1 && (
                    <span aria-hidden="true" className="absolute -left-[25px] top-8 h-full w-px bg-background" />
                  )}
                </li>
              ))}
            </ol>

            {/* Pipeline strip */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
              <p className="mb-3 text-[10.5px] font-black tracking-[0.13em] text-muted-foreground uppercase">
                Every call moves the lead down one pipeline
              </p>
              <ol className="flex flex-wrap items-center gap-1.5">
                {CALLING_PIPELINE.map((stage, i) => (
                  <li key={stage} className="flex items-center gap-1.5">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        i === CALLING_PIPELINE.length - 1
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : i === 0
                            ? 'bg-muted text-foreground'
                            : 'bg-primary/8 text-primary'
                      }`}
                    >
                      {stage}
                    </span>
                    {i < CALLING_PIPELINE.length - 1 && (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          {/* Feature grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {CALLING_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={100 + i * 60} className={f.span || ''}>
                <article
                  className={`lit-border group flex h-full flex-col rounded-2xl border border-border/60 p-4 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${
                    f.accent ? 'bg-gradient-to-br from-primary/10 via-card/80 to-violet-500/10' : 'bg-card/70'
                  }`}
                >
                  <span
                    className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
                      f.accent ? 'bg-brand-gradient text-white shadow-md shadow-primary/25' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    <f.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-[13.5px] font-bold">{f.title}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{f.text}</p>
                  {f.points && (
                    <ul className="mt-3 space-y-1.5">
                      {f.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
