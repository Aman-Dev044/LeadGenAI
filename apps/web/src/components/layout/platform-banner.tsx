'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Megaphone, ShieldAlert, UserCog, Wrench, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { exitImpersonation } from '@/lib/impersonation';
import type { PlatformStatus } from '@/types';

const LEVEL_STYLES: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-black',
  critical: 'bg-red-600 text-white',
};

/**
 * Sticky strip above the header: impersonation notice (owner acting as a tenant user),
 * maintenance-mode warning and the platform-wide announcement set by the owner.
 */
export function PlatformBanner() {
  const { impersonation, user, tenant } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['platform', 'status'],
    queryFn: () => api.get<{ data: PlatformStatus }>('/platform/status'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const status = data?.data;
  const isOwner = user?.role === 'SUPER_ADMIN';

  return (
    <div className="sticky top-0 z-40">
      {impersonation && (
        <div className="flex items-center gap-3 bg-violet-700 px-4 py-2 text-sm text-white">
          <UserCog className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            Owner mode: you are viewing <strong>{tenant?.name || 'this workspace'}</strong> as{' '}
            <strong>{user?.email}</strong> ({user?.role}). Every action is recorded in the audit log.
          </span>
          <Button size="sm" variant="secondary" className="h-7" onClick={exitImpersonation}>
            <X className="mr-1 h-3 w-3" /> Exit impersonation
          </Button>
        </div>
      )}

      {status?.maintenanceMode && (
        <div className="flex items-center gap-3 bg-orange-600 px-4 py-2 text-sm text-white">
          <Wrench className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {isOwner ? 'Maintenance mode is ON. Only platform owners can use the dashboard right now.' : status.maintenanceMessage}
          </span>
        </div>
      )}

      {status?.announcement && (
        <div className={cn('flex items-center gap-3 px-4 py-2 text-sm', LEVEL_STYLES[status.announcement.level] || LEVEL_STYLES.info)}>
          {status.announcement.level === 'critical' ? (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          ) : status.announcement.level === 'warning' ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Megaphone className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{status.announcement.message}</span>
          {status.announcement.link && (
            <a href={status.announcement.link} target="_blank" rel="noreferrer" className="underline underline-offset-2 inline-flex items-center gap-1">
              <Info className="h-3 w-3" /> Learn more
            </a>
          )}
        </div>
      )}
    </div>
  );
}
