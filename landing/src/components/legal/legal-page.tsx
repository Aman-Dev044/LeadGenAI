import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Mail, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo, PoweredBy } from '@/components/brand/logo';
import { BRAND, COMPANY } from '@/lib/brand';
import { ROUTES } from '@/lib/site';

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * The shell every legal page shares: the same header, hero, sticky table of
 * contents and footer the privacy policy already uses. Each page supplies only
 * its own sections, so the four of them cannot drift apart in wording or
 * layout - and the footer links stay identical wherever the reader lands.
 */
export function LegalPage({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
  icon: Icon = FileText,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  icon?: typeof FileText;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo size="md" showTagline />
            </Link>
            <Badge
              variant="outline"
              className="hidden py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex"
            >
              Legal
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to home</span>
              </Link>
            </Button>
            <Button variant="gradient" size="sm" asChild>
              <a href={ROUTES.login}>Sign In</a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative border-b bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge variant="info" className="gap-1.5 px-3 py-1 text-xs font-semibold text-primary">
                <Icon className="h-3.5 w-3.5" /> {eyebrow}
              </Badge>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{intro}</p>
            </div>
            <div className="rounded-2xl border bg-card/80 p-4 shadow-xs backdrop-blur">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Document status</p>
              <p className="mt-1 font-semibold text-foreground">Official platform policy</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-xs">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <FileText className="h-4 w-4 text-primary" /> Table of contents
              </p>
              <nav className="mt-4 space-y-1 text-sm">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>

              <div className="mt-6 space-y-2 border-t pt-4">
                <p className="text-xs font-semibold">{COMPANY.name}</p>
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {COMPANY.addressLine}
                </p>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Mail className="h-3 w-3" /> {COMPANY.email}
                </a>
                {COMPANY.phone && (
                  <a
                    href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" /> {COMPANY.phone}
                  </a>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-10 lg:col-span-3">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{s.title}</h2>
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

/** The same footer on every legal page - and the place the policy links live. */
export function LegalFooter() {
  return (
    <footer className="border-t bg-card/60 py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name} &middot; {BRAND.tagline}
          </p>
          <PoweredBy />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {LEGAL_LINKS.map((l, i) => (
            <span key={l.href} className="flex items-center gap-3">
              <Link href={l.href} className="hover:underline">
                {l.label}
              </Link>
              {i < LEGAL_LINKS.length - 1 && <span aria-hidden="true">&middot;</span>}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

/** Every policy page, in the order a reader (and a payment aggregator) expects. */
export const LEGAL_LINKS = [
  { label: 'About us', href: '/about' },
  { label: 'Contact us', href: '/contact' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Terms & conditions', href: '/terms' },
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Refunds & cancellation', href: '/refunds' },
] as const;
