'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users, Eye, CalendarDays, Link2, TrendingUp, Trophy } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Toolbar, SearchInput, ToolbarSpacer } from '@/components/shared/toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CHART_COLORS } from '@/components/charts/chart-kit';
import { cn } from '@/lib/utils';

function splitUrl(raw: string) {
  try {
    const u = new URL(raw);
    return { host: u.host, path: `${u.pathname}${u.search}` || '/' };
  } catch {
    return { host: '', path: raw || '/' };
  }
}

export default function VisitorTrackingPage() {
  const [days, setDays] = useState('30');
  const [filter, setFilter] = useState('');

  const { data: topPages, isLoading } = useQuery({
    queryKey: ['visitor-tracking', 'top-pages', days],
    queryFn: () => api.get<any>('/visitor-tracking/top-pages', { days }),
  });

  const { data: visitorCount } = useQuery({
    queryKey: ['visitor-tracking', 'count', days],
    queryFn: () => api.get<any>('/visitor-tracking/visitor-count', { days }),
  });

  const pages = (topPages as any)?.data || [];

  // Backend returns { uniqueVisitors: N } (not "count")
  const countRaw = (visitorCount as any)?.data || {};
  const uniqueVisitorCount = countRaw.uniqueVisitors ?? countRaw.count ?? 0;

  // Backend returns "views" (not "totalViews")
  const getViews = (p: any) => p.views ?? p.totalViews ?? 0;
  const getUniqueVisitors = (p: any) => p.uniqueVisitors ?? 0;
  const totalViews = pages.reduce((sum: number, p: any) => sum + getViews(p), 0);
  const maxViews = pages.length > 0 ? Math.max(...pages.map((p: any) => getViews(p))) : 1;
  const avgViewsPerVisitor = uniqueVisitorCount > 0 ? (totalViews / uniqueVisitorCount).toFixed(1) : '0';

  const visible = filter.trim()
    ? pages.filter((p: any) => String(p._id || p.url || '').toLowerCase().includes(filter.toLowerCase()))
    : pages;
  const topThree = pages.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe}
        title="Visitor Tracking"
        description="Which pages bring people in and where they spend their time before talking to your agent."
        actions={
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1 shadow-card">
            <CalendarDays className="ml-2 h-4 w-4 text-muted-foreground" />
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[112px]" />)}
          </div>
          <Skeleton className="h-[360px]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Unique Visitors" value={uniqueVisitorCount} icon={Users} tone="primary" description={`last ${days} days`} />
            <StatCard title="Page Views" value={totalViews} icon={Eye} tone="info" description="across tracked pages" />
            <StatCard title="Pages Tracked" value={pages.length} icon={Globe} tone="violet" description="with at least one view" />
            <StatCard title="Views / Visitor" value={avgViewsPerVisitor} icon={TrendingUp} tone="success" description="average depth" />
          </div>

          {pages.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No page views recorded yet"
              description="Install the chat widget on your website to start tracking which pages your visitors land on."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Top pages table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Ranked by total page views in the selected period</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Toolbar className="mb-3 border-0 bg-transparent p-0 shadow-none">
                    <SearchInput value={filter} onChange={setFilter} placeholder="Filter by URL…" />
                    <ToolbarSpacer />
                    <span className="px-1 text-xs text-muted-foreground tabular">{visible.length} page{visible.length === 1 ? '' : 's'}</span>
                  </Toolbar>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[48px]">#</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Unique</TableHead>
                        <TableHead className="w-[180px]">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">No pages match that filter.</TableCell>
                        </TableRow>
                      ) : (
                        visible.map((page: any, i: number) => {
                          const url = page._id || page.url || '';
                          const { host, path } = splitUrl(url);
                          const views = getViews(page);
                          const share = totalViews ? Math.round((views / totalViews) * 100) : 0;
                          const rank = pages.indexOf(page) + 1;
                          return (
                            <TableRow key={page._id || url}>
                              <TableCell>
                                <span
                                  className={cn(
                                    'inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold tabular',
                                    rank <= 3 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {rank}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[320px]">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Link2 className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-mono text-[13px] font-medium" title={url}>{path}</p>
                                    {host && <p className="truncate text-xs text-muted-foreground">{host}</p>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular">{views}</TableCell>
                              <TableCell className="text-right tabular text-muted-foreground">{getUniqueVisitors(page)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${(views / maxViews) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                                    />
                                  </div>
                                  <span className="w-9 text-right text-xs text-muted-foreground tabular">{share}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Right rail */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top performers</CardTitle>
                    <CardDescription>Your three most visited pages</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topThree.map((page: any, i: number) => {
                      const url = page._id || page.url || '';
                      const { path, host } = splitUrl(url);
                      const views = getViews(page);
                      const share = totalViews ? Math.round((views / totalViews) * 100) : 0;
                      return (
                        <div key={url} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          >
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[13px] font-medium" title={url}>{path}</p>
                            <p className="truncate text-xs text-muted-foreground">{host || 'tracked page'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular">{views}</p>
                            <p className="text-[11px] text-muted-foreground tabular">{share}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-gradient opacity-15 blur-3xl" />
                  <CardHeader className="pb-3">
                    <CardTitle>Period summary</CardTitle>
                    <CardDescription>Last {days} days at a glance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-0 text-sm">
                    {[
                      { label: 'Unique visitors', value: uniqueVisitorCount },
                      { label: 'Total page views', value: totalViews },
                      { label: 'Pages tracked', value: pages.length },
                      { label: 'Avg. views per visitor', value: avgViewsPerVisitor },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between border-b py-2.5 last:border-0">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold tabular">{row.value}</span>
                      </div>
                    ))}
                    <div className="pt-3">
                      <Badge variant="info" dot>Tracked by the chat widget</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
