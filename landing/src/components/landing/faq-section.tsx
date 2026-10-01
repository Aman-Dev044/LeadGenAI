'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { Eyebrow } from '@/components/landing/eyebrow';
import { Reveal } from '@/components/landing/primitives';
import { FAQS } from '@/lib/landing-data';

/**
 * Two-column FAQ accordion.
 *
 * The answers are always in the DOM — collapsing is a `grid-rows-[0fr]`
 * animation, not a mount — so every answer is indexable and matches the
 * `FAQPage` JSON-LD emitted from the same array.
 */
export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative z-10 scroll-mt-20 border-t border-border/50 bg-muted/15 py-12"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Eyebrow icon={MessageSquare}>Questions</Eyebrow>
            <h2 id="faq-heading" className="text-3xl font-black tracking-tight sm:text-4xl">
              Straight answers
            </h2>
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
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-answer-${i}`}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-left text-[13.5px] font-bold"
                    >
                      {faq.q}
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                          open ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>
                  </h3>
                  <div
                    id={`faq-answer-${i}`}
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
  );
}
