'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, MessageSquare, Bot, Cpu, Ticket, Search, ArrowRight, Activity as ActivityIcon,
  Trophy, UserPlus, Flame, Sparkles, Mail, CalendarClock, BookOpen, Loader2,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChartEmpty, ChartTooltip } from '@/components/charts/chart-kit';
import { PlanBadge, StatusBadge, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { OwnerHero } from '@/components/admin/owner-hero';
import { TenantMixCard } from '@/components/admin/tenant-mix';
import { formatDate, getInitials, cn } from '@/lib/utils';

const SERIES = [
  { key: 'conversations', label: 'Conversations', color: '#6366f1' },
  { key: 'leads', label: 'Leads', color: '#22c55e' },
  { key: 'signups', label: 'Signups', color: '#f59e0b' },
];

const RANK_STYLES = [
  'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30',
  'bg-slate-400/15 text-slate-600 dark:text-slate-300 ring-1 ring-slate-400/30',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30',
];

function SearchColumn({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </p>
        <Badge variant="secondary" className="tabular">{count}</Badge>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function OwnerOverviewPage() {
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<any>('/admin/overview'),
    refetchInterval: 30_000,
  });
  const { data: activity } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: () => api.get<any>('/admin/activity'),
    refetchInterval: 30_000,
  });
  const { data: search, isFetching: searching } = useQuery({
    queryKey: ['admin', 'search', searchTerm],
    queryFn: () => api.get<any>('/admin/search', { q: searchTerm }),
    enabled: searchTerm.length >= 2,
  });

  if (isLoading) return <Loading label="Loading platform overview" />;
  const o = data?.data || {};
  const feed: any[] = activity?.data || [];
  const results = search?.data;

  const series = (o.series?.leads || []).map((d: any, i: number) => ({
    date: d._id.slice(5),
    leads: d.count,
    conversations: o.series?.conversations?.[i]?.count ?? 0,
    signups: o.series?.signups?.[i]?.count ?? 0,
  }));

  const topMax = Math.max(1, ...(o.topTenants || []).map((t: any) => t.leads || 0));

  return (
    <div className="space-y-6">
      <OwnerHero
        maintenanceMode={o.platform?.maintenanceMode}
        signupEnabled={o.platform?.signupEnabled}
        announcement={o.platform?.announcement}
        generatedAt={o.generatedAt}
      />

      {/* Global search */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-3 md:w-64 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/30">
                <Search className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Global search</p>
                <p className="text-xs text-muted-foreground">Tenants, users and leads</p>
              </div>
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search any tenant, user email or lead across the platform..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearchTerm(q.trim()); }}
                className="pl-9 h-11"
              />
            </div>
            <Button variant="gradient" className="h-11 px-5" onClick={() => setSearchTerm(q.trim())} disabled={q.trim().length < 2}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
            </Button>
          </div>

          {searchTerm && (
            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm animate-in fade-in-0 slide-in-from-bottom-2">
              <SearchColumn title="Tenants" icon={Building2} count={results?.tenants?.length || 0}>
                {results?.tenants?.length ? results.tenants.map((t: any) => (
                  <Link key={t._id} href={`/dashboard/admin/tenants/${t._id}`} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2 shadow-xs transition-colors hover:bg-primary/5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{getInitials(t.name || 'W')}</AvatarFallback></Avatar>
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="truncate text-xs text-muted-foreground">/{t.slug}</span>
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                )) : <p className="px-1 py-2 text-xs text-muted-foreground">No match</p>}
              </SearchColumn>
              <SearchColumn title="Users" icon={Users} count={results?.users?.length || 0}>
                {results?.users?.length ? results.users.map((u: any) => (
                  <Link key={u._id} href={`/dashboard/admin/users?search=${encodeURIComponent(u.email)}`} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 shadow-xs transition-colors hover:bg-primary/5">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{getInitials(`${u.firstName || ''} ${u.lastName || ''}`.trim() || 'U')}</AvatarFallback></Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.firstName} {u.lastName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email} · {u.role} · {u.tenantName}</span>
                    </span>
                  </Link>
                )) : <p className="px-1 py-2 text-xs text-muted-foreground">No match</p>}
              </SearchColumn>
              <SearchColumn title="Leads" icon={Flame} count={results?.leads?.length || 0}>
                {results?.leads?.length ? results.leads.map((l: any) => (
                  <Link key={l._id} href={`/dashboard/admin/tenants/${l.tenantId}`} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 shadow-xs transition-colors hover:bg-primary/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{[l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed'}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.email || l.phone} · {l.tenantName}</span>
                    </span>
                    <Badge variant={l.temperature === 'hot' ? 'destructive' : l.temperature === 'warm' ? 'warning' : 'info'} dot>{l.temperature}</Badge>
                  </Link>
                )) : <p className="px-1 py-2 text-xs text-muted-foreground">No match</p>}
              </SearchColumn>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tenants" value={formatNumber(o.tenants?.total)} icon={Building2} tone="primary" description={`+${o.tenants?.last7d || 0} this week · +${o.tenants?.last30d || 0} this month`} />
        <StatCard title="Users" value={formatNumber(o.users?.total)} icon={Users} tone="info" description={`${o.users?.active || 0} active`} />
        <StatCard title="Leads" value={formatNumber(o.leads?.total)} icon={Flame} tone="success" description={`+${o.leads?.last30d || 0} last 30 days`} />
        <StatCard title="Conversations" value={formatNumber(o.conversations?.total)} icon={MessageSquare} tone="violet" description={`${o.conversations?.active || 0} active · ${o.conversations?.handedOff || 0} handed off`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="AI tokens this month" value={formatNumber(o.ai?.tokensThisMonth)} icon={Cpu} tone="warning" description={`${formatNumber(o.ai?.tokensTotal)} all time`} />
        <StatCard title="Messages this month" value={formatNumber(o.messages?.thisMonth)} icon={Mail} tone="info" description={`${formatNumber(o.messages?.total)} total`} />
        <StatCard title="Active agents" value={formatNumber(o.agentsActive)} icon={Bot} tone="primary" description={`${formatNumber(o.knowledgeSources)} knowledge sources`} />
        <StatCard title="Open tickets" value={formatNumber(o.ticketsOpen)} icon={Ticket} tone="danger" description={`${formatNumber(o.appointmentsUpcoming)} upcoming appointments`} />
      </div>

      <TenantMixCard
        byPlan={o.tenants?.byPlan}
        byStatus={o.tenants?.byStatus}
        byPlanAndStatus={o.tenants?.byPlanAndStatus}
        leadsByTemperature={o.leads?.byTemperature}
        totalTenants={o.tenants?.total || 0}
      />

      {/* Growth chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Platform growth & activity</CardTitle>
            <CardDescription>Daily leads captured, conversations and new workspace signups across all tenants, last 30 days</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <ChartEmpty height={280} message="No activity in the last 30 days" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`owner-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                {SERIES.map((s) => (
                  <Area key={s.key} type="monotone" name={s.label} dataKey={s.key} stroke={s.color} strokeWidth={2.25} fill={`url(#owner-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top tenants</CardTitle>
              <CardDescription>Leads captured in the last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {o.topTenants?.length ? o.topTenants.map((t: any, i: number) => (
              <Link key={t.tenantId} href={`/dashboard/admin/tenants/${t.tenantId}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular', RANK_STYLES[i] || 'bg-muted text-muted-foreground')}>
                  {i + 1}
                </span>
                <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{getInitials(t.name || 'W')}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">{t.name}</p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.max(6, Math.round((t.leads / topMax) * 100))}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular">{formatNumber(t.leads)}</span>
              </Link>
            )) : (
              <EmptyState compact icon={Trophy} title="No leads yet" description="No leads captured in the last 30 days." />
            )}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Recent signups</CardTitle>
              <CardDescription>Newest workspaces on the platform</CardDescription>
            </div>
            <Button asChild variant="ghost" size="xs">
              <Link href="/dashboard/admin/tenants">All tenants <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {o.recentTenants?.length ? o.recentTenants.map((t: any) => (
              <Link key={t._id} href={`/dashboard/admin/tenants/${t._id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{getInitials(t.name || 'W')}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">/{t.slug} · {formatDate(t.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1"><PlanBadge plan={t.plan} /><StatusBadge status={t.status} /></div>
              </Link>
            )) : (
              <EmptyState compact icon={UserPlus} title="No signups yet" description="New workspaces will appear here." />
            )}
          </CardContent>
        </Card>

        {/* Live activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-emerald-500" /> Live activity</CardTitle>
              <CardDescription>Refreshes every 30 seconds</CardDescription>
            </div>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto scrollbar-thin">
            {feed.length ? (
              <ol className="relative ml-2 border-l border-border/70 pl-4 space-y-4">
                {feed.map((item, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary ring-4 ring-card" />
                    <p className="truncate text-sm capitalize">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.tenantName ? `${item.tenantName} · ` : ''}{item.subtitle ? `${item.subtitle} · ` : ''}{timeAgo(item.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState compact icon={Sparkles} title="Nothing yet" description="Platform events will stream in here." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick footnotes */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: BookOpen, label: 'Knowledge sources', value: formatNumber(o.knowledgeSources) },
          { icon: CalendarClock, label: 'Upcoming appointments', value: formatNumber(o.appointmentsUpcoming) },
          { icon: Ticket, label: 'Open support tickets', value: formatNumber(o.ticketsOpen) },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border bg-card/70 px-4 py-3 shadow-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><k.icon className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-semibold tabular leading-tight">{k.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
