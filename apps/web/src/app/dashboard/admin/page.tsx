'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, MessageSquare, Bot, Cpu, Ticket, Search, ArrowRight, Activity as ActivityIcon,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlanBadge, StatusBadge, formatNumber, timeAgo } from '@/components/admin/admin-ui';
import { OwnerHero } from '@/components/admin/owner-hero';
import { TenantMixCard } from '@/components/admin/tenant-mix';
import { formatDate } from '@/lib/utils';

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

  if (isLoading) return <Loading />;
  const o = data?.data || {};
  const feed: any[] = activity?.data || [];
  const results = search?.data;

  const series = (o.series?.leads || []).map((d: any, i: number) => ({
    date: d._id.slice(5),
    leads: d.count,
    conversations: o.series?.conversations?.[i]?.count ?? 0,
    signups: o.series?.signups?.[i]?.count ?? 0,
  }));

  return (
    <div>
      <OwnerHero
        maintenanceMode={o.platform?.maintenanceMode}
        signupEnabled={o.platform?.signupEnabled}
        announcement={o.platform?.announcement}
        generatedAt={o.generatedAt}
      />

      {/* Global search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Search any tenant, user email or lead across the platform..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearchTerm(q.trim()); }}
            />
            <Button onClick={() => setSearchTerm(q.trim())} disabled={q.trim().length < 2}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>
          {searchTerm && (
            <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="mb-2 font-semibold">Tenants {searching && '…'}</p>
                {results?.tenants?.length ? results.tenants.map((t: any) => (
                  <Link key={t._id} href={`/dashboard/admin/tenants/${t._id}`} className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent">
                    <span>{t.name} <span className="text-muted-foreground">/{t.slug}</span></span>
                    <StatusBadge status={t.status} />
                  </Link>
                )) : <p className="text-muted-foreground">No match</p>}
              </div>
              <div>
                <p className="mb-2 font-semibold">Users</p>
                {results?.users?.length ? results.users.map((u: any) => (
                  <Link key={u._id} href={`/dashboard/admin/users?search=${encodeURIComponent(u.email)}`} className="block rounded px-2 py-1 hover:bg-accent">
                    <span>{u.firstName} {u.lastName}</span> <span className="text-muted-foreground">{u.email}</span>
                    <p className="text-xs text-muted-foreground">{u.role} · {u.tenantName}</p>
                  </Link>
                )) : <p className="text-muted-foreground">No match</p>}
              </div>
              <div>
                <p className="mb-2 font-semibold">Leads</p>
                {results?.leads?.length ? results.leads.map((l: any) => (
                  <Link key={l._id} href={`/dashboard/admin/tenants/${l.tenantId}`} className="block rounded px-2 py-1 hover:bg-accent">
                    <span>{[l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed'}</span>
                    <p className="text-xs text-muted-foreground">{l.email || l.phone} · {l.temperature} · {l.tenantName}</p>
                  </Link>
                )) : <p className="text-muted-foreground">No match</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard title="Tenants" value={formatNumber(o.tenants?.total)} icon={Building2} description={`+${o.tenants?.last7d || 0} this week · +${o.tenants?.last30d || 0} this month`} />
        <StatCard title="Users" value={formatNumber(o.users?.total)} icon={Users} description={`${o.users?.active || 0} active`} />
        <StatCard title="Leads" value={formatNumber(o.leads?.total)} icon={Users} description={`+${o.leads?.last30d || 0} last 30 days`} />
        <StatCard title="Conversations" value={formatNumber(o.conversations?.total)} icon={MessageSquare} description={`${o.conversations?.active || 0} active · ${o.conversations?.handedOff || 0} handed off`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="AI tokens this month" value={formatNumber(o.ai?.tokensThisMonth)} icon={Cpu} description={`${formatNumber(o.ai?.tokensTotal)} all time`} />
        <StatCard title="Messages this month" value={formatNumber(o.messages?.thisMonth)} icon={MessageSquare} description={`${formatNumber(o.messages?.total)} total`} />
        <StatCard title="Active agents" value={formatNumber(o.agentsActive)} icon={Bot} description={`${formatNumber(o.knowledgeSources)} knowledge sources`} />
        <StatCard title="Open tickets" value={formatNumber(o.ticketsOpen)} icon={Ticket} description={`${formatNumber(o.appointmentsUpcoming)} upcoming appointments`} />
      </div>

      <div className="mb-6">
        <TenantMixCard
          byPlan={o.tenants?.byPlan}
          byStatus={o.tenants?.byStatus}
          byPlanAndStatus={o.tenants?.byPlanAndStatus}
          leadsByTemperature={o.leads?.byTemperature}
          totalTenants={o.tenants?.total || 0}
        />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform Growth & Activity (Last 30 days)</CardTitle>
            <CardDescription>Daily leads captured, active conversations, and new workspace signups across all tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="conversations" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} />
                <Area type="monotone" dataKey="leads" stroke="#22c55e" fill="#22c55e" fillOpacity={0.12} />
                <Area type="monotone" dataKey="signups" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top tenants (30d leads)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.topTenants?.length ? o.topTenants.map((t: any, i: number) => (
              <Link key={t.tenantId} href={`/dashboard/admin/tenants/${t.tenantId}`} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-accent">
                <span><span className="mr-2 text-muted-foreground">#{i + 1}</span>{t.name}</span>
                <span className="font-semibold">{t.leads}</span>
              </Link>
            )) : <p className="text-muted-foreground">No leads captured in the last 30 days.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent signups
              <Link href="/dashboard/admin/tenants" className="text-xs font-normal text-primary inline-flex items-center">All tenants <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.recentTenants?.map((t: any) => (
              <Link key={t._id} href={`/dashboard/admin/tenants/${t._id}`} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-accent">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">/{t.slug} · {formatDate(t.createdAt)}</p>
                </div>
                <div className="flex gap-1"><PlanBadge plan={t.plan} /><StatusBadge status={t.status} /></div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ActivityIcon className="h-4 w-4" /> Live activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm max-h-[360px] overflow-y-auto">
            {feed.length ? feed.map((item, i) => (
              <div key={i} className="flex items-start gap-2 border-b pb-2 last:border-0">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate capitalize">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.tenantName ? `${item.tenantName} · ` : ''}{item.subtitle ? `${item.subtitle} · ` : ''}{timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            )) : <p className="text-muted-foreground">Nothing yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
