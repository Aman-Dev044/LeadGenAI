'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { cn, getInitials } from '@/lib/utils';

/**
 * The workspace's own logo and name in the header - what an admin or
 * salesperson sees as "their" product once logged in.
 *
 * Reads the tenant document (not the login snapshot) so a logo or name saved
 * under Settings > Organization shows up immediately: the settings page
 * invalidates the `tenant` query on save, and the socket refresh keeps other
 * tabs in step.
 */
export function WorkspaceIdentity({ className }: { className?: string }) {
  const { user, impersonation, tenant: sessionTenant } = useAuthStore();
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;
  const browsingAll = isOwner && (!activeTenantId || activeTenantId === 'all');
  const [imgFailed, setImgFailed] = useState(false);

  const { data } = useQuery({
    queryKey: ['tenant', activeTenantId],
    queryFn: () => api.get<any>('/tenant'),
    enabled: !!user && !browsingAll,
    staleTime: 30_000,
  });
  const tenant = (data as any)?.data || null;

  const name: string = tenant?.name || sessionTenant?.name || 'Workspace';
  const logo: string | undefined = tenant?.logo || tenant?.branding?.logo || undefined;
  const showLogo = !!logo && !imgFailed;

  if (browsingAll) {
    return (
      <Link href="/dashboard/admin" className={cn('flex min-w-0 items-center gap-2', className)}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-semibold">All tenants</span>
      </Link>
    );
  }

  return (
    <Link href="/dashboard" className={cn('flex min-w-0 items-center gap-2.5', className)} title={name}>
      {showLogo ? (
        <span className="flex h-8 max-w-[140px] shrink-0 items-center overflow-hidden rounded-lg bg-card/60 ring-1 ring-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={logo}
            src={logo}
            alt={`${name} logo`}
            className="h-8 w-auto max-w-[140px] object-contain px-1"
            onError={() => setImgFailed(true)}
            onLoad={() => setImgFailed(false)}
          />
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[11px] font-black text-white shadow-sm shadow-primary/25">
          {getInitials(name)}
        </span>
      )}
      <span className="truncate text-sm font-semibold leading-none">{name}</span>
    </Link>
  );
}
