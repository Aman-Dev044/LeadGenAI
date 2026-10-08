'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Globe, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Trash2, Sparkles, FileText, Wand2, ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface SiteProfile {
  businessName: string;
  oneLiner: string;
  whatWeSell: string;
  services: string[];
  pricing: string;
  locations: string[];
  hours: string;
  usps: string[];
  faqs: { q: string; a: string }[];
  contact: { phone?: string; email?: string; whatsapp?: string; address?: string };
  doNotSay: string[];
}

interface SiteStatus {
  url: string;
  domain: string;
  title: string;
  description: string;
  status: 'none' | 'verified' | 'crawling' | 'ready' | 'failed';
  verifiedAt: string | null;
  lastCrawledAt: string | null;
  pagesFound: number;
  pages: { url: string; title: string }[];
  error: string;
  profile: SiteProfile | null;
  brief: string;
  crawling: boolean;
}

/**
 * The workspace's own website, taught to the AI.
 *
 * Verify the address, let us read every page we can reach, and what the site
 * says becomes the briefing the calling agent speaks from and the knowledge the
 * chat and WhatsApp agents search.
 */
export function WebsiteSettings() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['website'],
    queryFn: () => api.get<any>('/website'),
    // While a crawl runs, keep the page counter moving
    refetchInterval: (q) => ((q.state.data as any)?.data?.crawling ? 4000 : false),
  });
  const site: SiteStatus | undefined = (data as any)?.data || (data as any);

  useEffect(() => {
    if (!touched && site?.url) setUrl(site.url);
  }, [site?.url, touched]);

  const verify = useMutation({
    mutationFn: () => api.post<any>('/website/verify', { url: url.trim() }),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      toast.success(r.message || `Found ${r.domain}`);
      queryClient.invalidateQueries({ queryKey: ['website'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const crawl = useMutation({
    mutationFn: () => api.post<any>('/website/crawl', { applyToAgents: true }),
    onSuccess: (res: any) => {
      toast.success((res?.data || res)?.message || 'Reading your website');
      queryClient.invalidateQueries({ queryKey: ['website'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: () => api.post<any>('/website/apply'),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      toast.success(r.applied?.length ? 'Copied into your AI agents' : 'Your agents already have their own wording - nothing was overwritten');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => api.delete('/website'),
    onSuccess: () => {
      setUrl('');
      setTouched(false);
      queryClient.invalidateQueries({ queryKey: ['website'] });
      toast.success('Website removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const status = site?.status || 'none';
  const verified = status !== 'none' && !!site?.verifiedAt;
  const ready = status === 'ready';
  const busy = !!site?.crawling || status === 'crawling';
  const p = site?.profile;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Your website
            {ready ? (
              <Badge variant="success" dot>{site?.pagesFound} pages learned</Badge>
            ) : busy ? (
              <Badge variant="info" dot>Reading…</Badge>
            ) : verified ? (
              <Badge variant="warning">Verified, not read yet</Badge>
            ) : (
              <Badge variant="secondary">Not added</Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-0.5">
            Give us your site and we read every page on it. After that your AI agents answer from your own words - what you sell,
            your prices, your cities, the questions your customers actually ask.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Website address</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[240px] flex-1"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setTouched(true);
                  }}
                  placeholder="yourcompany.com"
                  onKeyDown={(e) => e.key === 'Enter' && url.trim() && verify.mutate()}
                />
                <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending || !url.trim()}>
                  {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify
                </Button>
                <Button variant="gradient" onClick={() => crawl.mutate()} disabled={crawl.isPending || busy || !verified}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {ready ? 'Read again' : 'Read my website'}
                </Button>
              </div>
              {site?.title && (
                <p className="text-xs text-muted-foreground">
                  {site.title}
                  {site.description ? ` — ${site.description.slice(0, 140)}` : ''}
                </p>
              )}
            </div>

            {busy && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading {site?.domain}…
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {site?.pagesFound || 0} pages so far. You can leave this page - we will carry on.
                </p>
              </div>
            )}

            {status === 'failed' && site?.error && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {site.error}
              </p>
            )}

            {/* What we understood */}
            {p && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Wand2 className="h-4 w-4 text-primary" /> What your AI agents now know
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Read {site?.lastCrawledAt ? formatDate(site.lastCrawledAt) : 'just now'} from {site?.pagesFound} pages.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
                    {apply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Copy into my agents
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Business', value: p.businessName },
                    { label: 'In one line', value: p.oneLiner },
                    { label: 'What you sell', value: p.whatWeSell },
                    { label: 'Services', value: p.services.join(' · ') },
                    { label: 'Pricing on the site', value: p.pricing || 'Nothing stated - the agent will not quote a price' },
                    { label: 'Where you are', value: p.locations.join('; ') },
                    { label: 'Hours', value: p.hours },
                    { label: 'Why people choose you', value: p.usps.join(' · ') },
                  ]
                    .filter((x) => x.value)
                    .map((x) => (
                      <div key={x.label} className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{x.label}</p>
                        <p className="text-sm">{x.value}</p>
                      </div>
                    ))}
                </div>

                {p.faqs.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Questions it can already answer ({p.faqs.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {p.faqs.slice(0, 5).map((f, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-medium">{f.q}</span>
                          <span className="text-muted-foreground"> — {f.a.slice(0, 160)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {p.doNotSay.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      The agent will never promise
                    </p>
                    <p className="text-xs text-muted-foreground">{p.doNotSay.join(' · ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pages we read */}
            {ready && site!.pages?.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  <FileText className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                  Pages we read ({site!.pages.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {site!.pages.map((pg) => (
                    <li key={pg.url} className="truncate text-xs">
                      <a href={pg.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {pg.title || pg.url} <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {verified && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => clear.mutate()} disabled={clear.isPending}>
                <Trash2 className="h-3.5 w-3.5" /> Remove website
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
