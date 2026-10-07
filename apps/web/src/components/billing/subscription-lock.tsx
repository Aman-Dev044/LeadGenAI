'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, LogOut, LifeBuoy } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { PlanPicker } from '@/components/billing/plan-picker';
import { BRAND } from '@/lib/brand';

/**
 * What a workspace sees once its free trial - or its subscription - has run out.
 *
 * People can still sign in, because somebody has to be able to pay. Everything
 * else is behind this screen until they do. A salesperson who cannot pay is
 * told who can, rather than being bounced to a dead end.
 */
export function SubscriptionLock({ onSignOut }: { onSignOut: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get<any>('/billing/subscription'),
  });
  const sub = (data as any)?.data || (data as any);
  const trial = sub?.trial ?? sub?.plan === 'trial';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {trial ? 'Your free trial has ended' : 'Your subscription has ended'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {trial
              ? `Your ${BRAND.name} workspace, your leads and every call recording are safe. Pick a plan and everything switches back on straight away.`
              : `Nothing has been deleted. Renew your plan and your team is back to work in seconds.`}
          </p>
          {!isAdmin && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
              Ask an admin of your workspace to choose a plan - only they can pay.
            </p>
          )}
        </div>

        {isAdmin ? (
          <PlanPicker compact />
        ) : (
          <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
            <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Once your admin renews, sign in again and carry on exactly where you left off.
            </p>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
