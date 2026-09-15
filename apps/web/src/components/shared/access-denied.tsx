'use client';
import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown inside the dashboard shell when the signed-in role cannot open the current page. */
export function AccessDenied({ homeHref = '/dashboard' }: { homeHref?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <ShieldOff className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">You don&apos;t have access to this page</h2>
          <p className="text-sm text-muted-foreground">
            Your role doesn&apos;t include this area of the workspace. Ask an admin if you think you need it.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href={homeHref}>Go to my workspace</Link>
        </Button>
      </div>
    </div>
  );
}
