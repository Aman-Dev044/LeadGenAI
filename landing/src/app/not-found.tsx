import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo, PoweredBy } from '@/components/brand/logo';
import { ROUTES } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Page not found',
  // A 404 must never be indexed, whatever the layout defaults say.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center text-foreground">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,#000_25%,transparent_75%)]" />
        <div className="animate-aurora absolute -top-40 left-[20%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/20 blur-[110px]" />
        <div
          className="animate-aurora absolute top-[45%] right-[12%] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/16 blur-[110px]"
          style={{ animationDelay: '-6s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5">
        <Link href="/">
          <Logo size="lg" showTagline />
        </Link>

        <p className="text-gradient text-7xl font-black tracking-tight">404</p>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          This one didn&apos;t ring through.
        </h1>
        <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
          The page you were after has moved or never existed. Everything else is one click away.
        </p>

        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <Link href="/">
            <Button variant="gradient" className="gap-2 font-bold">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
            </Button>
          </Link>
          <a href={ROUTES.register}>
            <Button variant="outline" className="font-bold">
              Start free
            </Button>
          </a>
        </div>

        <PoweredBy className="mt-6 text-[11.5px] text-muted-foreground" />
      </div>
    </div>
  );
}
