'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Globe, Loader2, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const DISMISS_KEY = 'leadbells.websitePrompt.dismissed';

/**
 * The first thing a brand-new workspace should do: hand us its website.
 *
 * Until it does, the AI agents only know what somebody types into Settings.
 * Shown on the dashboard until the site is read, or until the admin waves it
 * away - one line, their URL, done.
 */
export function WebsitePrompt() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const [url, setUrl] = useState('');
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const { data } = useQuery({
    queryKey: ['website'],
    queryFn: () => api.get<any>('/website'),
    enabled: role === 'ADMIN',
    staleTime: 60_000,
    retry: false,
  });
  const site = (data as any)?.data || (data as any);

  const start = useMutation({
    mutationFn: async () => {
      await api.post('/website/verify', { url: url.trim() });
      return api.post('/website/crawl', { applyToAgents: true });
    },
    onSuccess: () => {
      toast.success('Reading your website now - your agents will know your business in a minute');
      queryClient.invalidateQueries({ queryKey: ['website'] });
      router.push('/dashboard/settings?tab=organization');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (role !== 'ADMIN' || hidden || !site) return null;
  // Already done, or already running
  if (site.status === 'ready' || site.status === 'crawling') return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* a refusal to remember is not worth an error */
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/[0.06] to-transparent">
      <button
        onClick={dismiss}
        aria-label="Hide"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Teach your AI your business — paste your website</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              We read every page and your agents start answering from your own words: what you sell, your prices, your cities,
              the questions customers actually ask. Takes about a minute.
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 gap-2 lg:w-auto">
          <Input
            className="min-w-[200px] lg:w-[260px]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourcompany.com"
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && start.mutate()}
          />
          <Button variant="gradient" onClick={() => start.mutate()} disabled={start.isPending || !url.trim()}>
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Read it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
