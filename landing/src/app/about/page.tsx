import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Building2, MapPin, MessageCircle, PhoneCall, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import { LegalFooter } from '@/components/legal/legal-page';
import { BRAND, COMPANY } from '@/lib/brand';
import { ROUTES } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About us',
  description: `${BRAND.name} is built by ${COMPANY.name} in Chandigarh, India - AI that calls, follows up and books meetings so no lead goes cold.`,
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    url: '/about',
    title: `About us | ${BRAND.name}`,
    description: `The team behind ${BRAND.name}.`,
  },
};

const WHAT_WE_BUILD = [
  {
    icon: PhoneCall,
    title: 'It calls, in your language',
    body: 'A new lead is phoned within minutes - in Hindi, English or Hinglish, with an Indian voice that gets the grammar right.',
  },
  {
    icon: MessageCircle,
    title: 'It answers on WhatsApp',
    body: 'Customers reply where they already are. The AI answers with the full history, looks at pictures they send, and books the meeting.',
  },
  {
    icon: Bot,
    title: 'It learns your business',
    body: 'Give it your website and it reads every page - what you sell, your prices, your cities - and answers in your own words.',
  },
  {
    icon: Target,
    title: 'Nothing goes cold',
    body: 'Reminders before meetings, a rescue call after a no-show, and a task for your rep with the next step already decided.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo size="md" showTagline />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contact">Contact</Link>
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
            <Sparkles className="h-3.5 w-3.5" /> About us
          </Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Most leads are not lost. They are just never followed up.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            A customer fills your form at 11 at night. Nobody calls back until Tuesday. By then they have bought from
            somebody who answered first. {BRAND.name} exists to close that gap - automatically, in the languages Indian
            customers actually speak.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold tracking-tight">Who we are</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                {BRAND.name} is built and operated by <strong className="text-foreground">{COMPANY.name}</strong>, a
                software company based in Chandigarh, India. We build business software for Indian companies - and we
                built this one because our own customers kept describing the same problem.
              </p>
              <p>
                Small sales teams do not lose deals because they are bad at selling. They lose them because a lead came
                in on a Sunday, because the one person who knew the pricing was on another call, because a follow-up
                was promised and then forgotten. The work is not hard. It is just relentless.
              </p>
              <p>
                So we built software that does the relentless part. It calls every new lead within minutes, speaks the
                customer&rsquo;s language, writes down what was said, books the meeting, follows up on WhatsApp, and
                hands your salesperson only the conversations worth their time.
              </p>
              <p>
                We are not trying to replace your sales team. We are trying to make sure they never again find out
                about a hot lead three days late.
              </p>
            </div>
          </div>

          <Card className="h-fit">
            <CardContent className="space-y-4 p-6">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <Building2 className="h-4 w-4 text-primary" /> The company
              </p>
              <div>
                <p className="font-semibold text-foreground">{COMPANY.name}</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{COMPANY.addressLine}</span>
                </p>
              </div>
              <div className="border-t pt-4">
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {COMPANY.email}
                </a>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/contact">Contact us</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">What we build</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {WHAT_WE_BUILD.map((w) => {
              const Icon = w.icon;
              return (
                <Card key={w.title} className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="pt-1 font-semibold text-foreground">{w.title}</p>
                    <p className="text-sm text-muted-foreground">{w.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">What we will not do</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Train on your data',
                body: 'Your conversations and leads never train a public or foundational model. Ever.',
              },
              {
                title: 'Mix your data with anyone else&rsquo;s',
                body: 'Workspaces are isolated at the database level, not by a filter in the application.',
              },
              {
                title: 'Let the AI invent answers',
                body: 'It answers from your material. When something is not covered it says so and offers a human.',
              },
            ].map((c) => (
              <Card key={c.title}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <p
                    className="pt-1 font-semibold text-foreground"
                    dangerouslySetInnerHTML={{ __html: c.title }}
                  />
                  <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: c.body }} />
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            The detail is in our{' '}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <Card className="mt-14">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-bold text-foreground">See it call one of your own leads</p>
              <p className="text-sm text-muted-foreground">
                14 days free, every feature unlocked, no card. Then from &#8377;444 a month.
              </p>
            </div>
            <Button variant="gradient" size="lg" asChild>
              <a href={ROUTES.register}>Start free trial</a>
            </Button>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  );
}
