import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Clock, CreditCard, LifeBuoy, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import { LegalFooter } from '@/components/legal/legal-page';
import { BRAND, COMPANY } from '@/lib/brand';
import { ROUTES } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact us',
  description: `Reach ${COMPANY.name} - registered office in Chandigarh, support e-mail, and how to get help with ${BRAND.name}.`,
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    url: '/contact',
    title: `Contact us | ${BRAND.name}`,
    description: `How to reach the team behind ${BRAND.name}.`,
  },
};

/** Where to write, depending on what you need. */
const DESKS = [
  {
    icon: LifeBuoy,
    title: 'Support',
    detail: 'Something is not working, or you need help setting a feature up.',
    action: COMPANY.email,
    note: 'Customers can also raise a ticket from Support Tickets inside the dashboard.',
  },
  {
    icon: MessageSquare,
    title: 'Sales & demo',
    detail: 'You want to see it on your own leads before you commit.',
    action: COMPANY.email,
    note: 'We will show you a live AI call on a number you choose.',
  },
  {
    icon: CreditCard,
    title: 'Billing & refunds',
    detail: 'An invoice, a plan change, or a refund request.',
    action: COMPANY.email,
    note: 'Quote your workspace name and the invoice number.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy & legal',
    detail: 'Data requests, a DPA, or anything about how we handle personal data.',
    action: COMPANY.email,
    note: 'We respond to data-subject requests within 30 days.',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo size="md" showTagline />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Back to home</Link>
            </Button>
            <Button variant="gradient" size="sm" asChild>
              <a href={ROUTES.register}>Start free trial</a>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Badge variant="info" className="gap-1.5 px-3 py-1 text-xs font-semibold text-primary">
            <Mail className="h-3.5 w-3.5" /> Contact us
          </Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Talk to a human</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {BRAND.name} is built and operated by {COMPANY.name} from Chandigarh, India. Write to us and a person reads
            it - there is no ticket maze.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Registered office - the detail a payment aggregator and a customer both look for */}
          <Card className="lg:col-span-1">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <Building2 className="h-4 w-4 text-primary" /> Registered office
                </p>
                <p className="mt-3 font-semibold text-foreground">{COMPANY.name}</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {COMPANY.address.line1}
                    <br />
                    {COMPANY.address.city}
                    {COMPANY.address.postcode ? ` ${COMPANY.address.postcode}` : ''}
                    <br />
                    {COMPANY.address.country}
                  </span>
                </p>
              </div>

              <div className="space-y-2 border-t pt-4">
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" /> {COMPANY.email}
                </a>
                {COMPANY.phone && (
                  <a
                    href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" /> {COMPANY.phone}
                  </a>
                )}
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" /> {COMPANY.supportHours}
                </p>
              </div>

              {(COMPANY.cin || COMPANY.gstin) && (
                <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
                  {COMPANY.cin && (
                    <p>
                      <span className="font-semibold text-foreground">CIN</span> {COMPANY.cin}
                    </p>
                  )}
                  {COMPANY.gstin && (
                    <p>
                      <span className="font-semibold text-foreground">GSTIN</span> {COMPANY.gstin}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <a
                  href={COMPANY.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {COMPANY.url.replace('https://', '')}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Which desk to write to */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {DESKS.map((d) => {
              const Icon = d.icon;
              return (
                <Card key={d.title} className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="pt-1 font-semibold text-foreground">{d.title}</p>
                    <p className="text-sm text-muted-foreground">{d.detail}</p>
                    <a
                      href={`mailto:${d.action}`}
                      className="block text-sm font-semibold text-primary hover:underline"
                    >
                      {d.action}
                    </a>
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="mt-8">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-foreground">Already a customer?</p>
              <p className="text-sm text-muted-foreground">
                Raise a ticket from inside your workspace - it carries your account details, so nobody has to ask which
                one you are on.
              </p>
            </div>
            <Button variant="gradient" asChild>
              <a href={ROUTES.dashboard}>Open the dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  );
}
