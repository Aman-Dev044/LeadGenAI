'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarCheck2, Link2, Loader2, Unplug } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CalendarStatus {
  provider: 'google';
  configured: boolean;
  redirectUri: string;
  connected: boolean;
  email?: string;
  lastError?: string;
  lastSyncedAt?: string;
  team: { userId: string; name: string; role: string; connected: boolean; email?: string; lastError?: string }[];
}

/**
 * "Connect Google Calendar" for the signed-in salesperson, plus a team
 * overview for managers. Meetings the AI books land in the connected calendar
 * with a Google Meet link, and the AI only offers slots that are free there.
 */
export function GoogleCalendarCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => api.get<any>('/calendar/status'),
    staleTime: 30_000,
  });
  const status: CalendarStatus | undefined = (data as any)?.data || (data as any);

  // Back from Google: show the result once, then clean the URL
  useEffect(() => {
    const result = params.get('calendar');
    if (!result) return;
    if (result === 'connected') toast.success(`Google Calendar connected${params.get('email') ? ` (${params.get('email')})` : ''}`);
    else toast.error(params.get('message') || 'Could not connect Google Calendar');
    queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
    router.replace('/dashboard/appointments');
  }, [params, queryClient, router]);

  const connect = useMutation({
    mutationFn: async () => {
      const res: any = await api.get<any>('/calendar/google/connect', { returnTo: '/dashboard/appointments' });
      const url = res?.data?.url || res?.url;
      if (!url) throw new Error('No sign-in link returned');
      window.location.href = url;
    },
    onError: (err: any) => toast.error(err.message || 'Could not start Google sign-in'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete('/calendar/google'),
    onSuccess: () => {
      toast.success('Google Calendar disconnected');
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading || !status) return null;

  const connectedTeam = status.team?.filter((t) => t.connected) || [];

  return (
    <Card className="mb-6 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Google Calendar</h3>
              {status.connected ? (
                <Badge variant="success" dot>Connected{status.email ? ` · ${status.email}` : ''}</Badge>
              ) : status.configured ? (
                <Badge variant="secondary">Not connected</Badge>
              ) : (
                <Badge variant="warning">Needs setup</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Every meeting the AI books on a call (and every one created here) goes straight into your Google Calendar with a Google Meet link, and the AI only offers slots that are free there.
            </p>
            {status.lastError && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Last sync problem: {status.lastError}
              </p>
            )}
            {!status.configured && canManage && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Add a Google OAuth client under <span className="font-medium">Settings › API Credentials › Google Calendar</span>. Authorised redirect URI:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{status.redirectUri}</code>
              </p>
            )}
            {canManage && status.team?.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Team:</span>
                {status.team.map((t) => (
                  <span
                    key={t.userId}
                    title={t.connected ? `${t.email || 'connected'}${t.lastError ? ` · ${t.lastError}` : ''}` : 'Not connected'}
                    className={`rounded-full border px-2 py-0.5 ${t.connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-border text-muted-foreground'}`}
                  >
                    {t.name}
                  </span>
                ))}
                <span className="ml-1">({connectedTeam.length}/{status.team.length} connected)</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {status.connected ? (
            <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Disconnect
            </Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={() => connect.mutate()} disabled={connect.isPending || !status.configured}>
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect Google Calendar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
