'use client';
import { Building2, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';

/**
 * The platform owner browses across every tenant (`tenantId: 'all'`) until they
 * pick one in the header switcher. Anything that belongs to exactly one
 * workspace - a campaign, for instance - cannot be created in that mode, and the
 * API answers with a 400.
 *
 * True when the current session is in that state, so a page can say so up front
 * instead of letting someone fill in a whole form and then fail on submit.
 */
export function useWorkspaceRequired(): boolean {
  const user = useAuthStore((s) => s.user);
  const impersonation = useAuthStore((s) => s.impersonation);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);

  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;
  return isOwner && (!activeTenantId || activeTenantId === 'all');
}

/** Banner telling the owner to pick a workspace in the header switcher. */
export function WorkspaceRequiredNotice({ feature }: { feature: string }) {
  return (
    <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
      <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="text-sm">
        <p className="font-semibold">Pick a workspace first</p>
        <p className="mt-1 text-muted-foreground">
          You are signed in as the platform owner and currently viewing{' '}
          <strong className="text-foreground">All Tenants</strong>. A {feature} campaign belongs to one
          workspace, so it cannot be created in this mode.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          Use the amber <strong className="text-foreground">Tenant</strong> selector at the top of the page
          and choose a workspace.
        </p>
      </div>
    </Card>
  );
}
