'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/shared/stat-card';
import { CHART_COLORS, ChartEmpty, ChartTooltip } from '@/components/charts/chart-kit';
import { Users, MessageSquare, Target, TrendingUp, UserCheck, ArrowLeftRight, Calendar, Zap, BarChart3, CalendarDays, Flame } from 'lucide-react';

const PERIOD_LABEL: Record<string, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

const STATUS_COLOR: Record<string, string> = {
  new: '#6366f1', contacted: '#0ea5e9', qualified: '#22c55e', unqualified: '#f59e0b', converted: '#14b8a6', lost: '#f43f5e',
};
const TEMP_COLOR: Record<string, string> = { hot: '#f43f5e', warm: '#f59e0b', cold: '#0ea5e9' };

function RankedList({ items, total, colorAt }: { items: { name: string; value: number }[]; total: number; colorAt: (i: number) => string }) {
  return (
    <ul className="space-y-3">
      {items.map((s, i) => {
        const pct = total ? Math.round((s.value / total) * 100) : 0;
        return (
          <li key={s.name} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorAt(i) }} />
              <span className="flex-1 truncate capitalize">{s.name}</span>
              <span className="font-semibold tabular">{s.value}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colorAt(i) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => api.get<any>('/analytics/overview', { period }),
    refetchInterval: 15000,
  });

  const { data: leadAnalytics } = useQuery({
    queryKey: ['analytics', 'leads', period],
    queryFn: () => api.get<any>('/analytics/leads', { period }),
    refetchInterval: 15000,
  });

  const { data: trends } = useQuery({
    queryKey: ['analytics', 'trends', period],
    queryFn: () => api.get<any>('/analytics/trends', { period }),
    refetchInterval: 15000,
  });

  const { data: sources } = useQuery({
    queryKey: ['analytics', 'sources', period],
    queryFn: () => api.get<any>('/analytics/sources', { period }),
    refetchInterval: 15000,
  });

  if (isLoading) return <Loading label="Crunching numbers" />;

  // Backend returns: totalVisitors, totalConversations, totalLeads, qualifiedLeads, hotLeads, handoffCount, appointmentCount, conversionRate
  const raw = (overview as any)?.data || {};
  const stats = {
    visitors: raw.totalVisitors ?? raw.visitors ?? 0,
    conversations: raw.totalConversations ?? raw.conversations ?? 0,
    leads: raw.totalLeads ?? raw.leads ?? 0,
    conversionRate: raw.conversionRate ?? 0,
    qualified: raw.qualifiedLeads ?? raw.qualified ?? 0,
    hot: raw.hotLeads ?? raw.hot ?? 0,
    handoffs: raw.handoffCount ?? raw.handoffs ?? 0,
    appointments: raw.appointmentCount ?? raw.appointments ?? 0,
  };

  const leadData = (leadAnalytics as any)?.data || {};
  const byStatus = leadData.byStatus || [];
  const byTemp = leadData.byTemperature || [];

  // Backend trends returns { leadTrend: [...], conversationTrend: [...] } - merge them by date
  const trendsRaw = (trends as any)?.data || {};
  const leadTrend = trendsRaw.leadTrend || trendsRaw || [];
  const convTrend = trendsRaw.conversationTrend || [];

  const trendMap = new Map<string, { date: string; leads: number; conversations: number }>();
  if (Array.isArray(leadTrend)) {
    leadTrend.forEach((t: any) => {
      const date = t._id || t.date;
      if (date) trendMap.set(date, { date, leads: t.leads || 0, conversations: 0 });
    });
  }
  if (Array.isArray(convTrend)) {
    convTrend.forEach((t: any) => {
      const date = t._id || t.date;
      if (date) {
        const existing = trendMap.get(date) || { date, leads: 0, conversations: 0 };
        existing.conversations = t.conversations || 0;
        trendMap.set(date, existing);
      }
    });
  }
  const trendData = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const sourceRaw = (sources as any)?.data || [];
  const sourceData = Array.isArray(sourceRaw)
    ? sourceRaw.map((s: any) => ({ name: s._id || 'Direct', value: s.count || 0 }))
    : [];
  const sourceTotal = sourceData.reduce((s: number, d: any) => s + d.value, 0);

  const statusData = byStatus.map((s: any) => ({ status: s._id || 'unknown', count: s.count || 0 }));
  const tempData = byTemp.map((t: any) => ({ temp: t._id || 'unknown', count: t.count || 0 }));
  const tempTotal = tempData.reduce((s: number, d: any) => s + d.count, 0);

  // Funnel derived from data already loaded
  const funnel = [
    { label: 'Visitors', value: stats.visitors, color: '#6366f1' },
    { label: 'Conversations', value: stats.conversations, color: '#8b5cf6' },
    { label: 'Leads', value: stats.leads, color: '#0ea5e9' },
    { label: 'Qualified', value: stats.qualified, color: '#22c55e' },
    { label: 'Appointments', value: stats.appointments, color: '#f59e0b' },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="How your AI agents are performing across traffic, conversations and pipeline."
        actions={
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1 shadow-card">
            <CalendarDays className="ml-2 h-4 w-4 text-muted-foreground" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Visitors" value={stats.visitors} icon={Users} tone="primary" description={PERIOD_LABEL[period]} />
        <StatCard title="Conversations" value={stats.conversations} icon={MessageSquare} tone="info" description="started by visitors" />
        <StatCard title="Leads Captured" value={stats.leads} icon={Target} tone="violet" description="new contacts" />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} icon={TrendingUp} tone="success" description="visitors → leads" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Qualified" value={stats.qualified} icon={UserCheck} tone="success" description="sales-ready leads" />
        <StatCard title="Hot Leads" value={stats.hot} icon={Zap} tone="danger" description="high intent" />
        <StatCard title="Handoffs" value={stats.handoffs} icon={ArrowLeftRight} tone="warning" description="passed to humans" />
        <StatCard title="Appointments" value={stats.appointments} icon={Calendar} tone="neutral" description="booked by the AI" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Trends</CardTitle>
              <CardDescription>Leads vs conversations per day</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[0] }} /> Leads</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[1] }} /> Conversations</span>
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <ChartEmpty height={300} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="an-leads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="an-convs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS[0], strokeOpacity: 0.3 }} />
                  <Area type="monotone" dataKey="conversations" name="Conversations" stroke={CHART_COLORS[1]} strokeWidth={2.5} fill="url(#an-convs)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke={CHART_COLORS[0]} strokeWidth={2.5} fill="url(#an-leads)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>From first visit to booked meeting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((f, i) => {
              const pct = Math.round((f.value / funnelMax) * 100);
              const prev = i > 0 ? funnel[i - 1].value : 0;
              const stepRate = i > 0 && prev > 0 ? Math.round((f.value / prev) * 100) : null;
              return (
                <div key={f.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="flex items-center gap-2">
                      {stepRate != null && <span className="text-[11px] text-muted-foreground tabular">{stepRate}% of prev</span>}
                      <span className="font-semibold tabular">{f.value}</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, f.value > 0 ? 3 : 0)}%`, background: f.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Where your leads come from</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <ChartEmpty height={260} />
            ) : (
              <div className="space-y-4">
                <div className="relative mx-auto h-[180px] w-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius="64%" outerRadius="92%" paddingAngle={3} cornerRadius={6} dataKey="value" nameKey="name" stroke="none">
                        {sourceData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular leading-none">{sourceTotal}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">leads</span>
                  </div>
                </div>
                <RankedList items={sourceData} total={sourceTotal} colorAt={(i) => CHART_COLORS[i % CHART_COLORS.length]} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Leads by Status</CardTitle>
            <CardDescription>Pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <ChartEmpty height={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }} />
                  <Bar dataKey="count" name="Leads" radius={[8, 8, 4, 4]}>
                    {statusData.map((d: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLOR[d.status] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Leads by Temperature</CardTitle>
            <CardDescription>Intent level of captured leads</CardDescription>
          </CardHeader>
          <CardContent>
            {tempData.length === 0 ? (
              <ChartEmpty height={260} />
            ) : (
              <div className="space-y-5">
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={tempData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="temp" tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }} />
                    <Bar dataKey="count" name="Leads" radius={[4, 8, 8, 4]}>
                      {tempData.map((d: any, i: number) => (
                        <Cell key={i} fill={TEMP_COLOR[d.temp] || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2">
                  {tempData.map((d: any) => {
                    const pct = tempTotal ? Math.round((d.count / tempTotal) * 100) : 0;
                    const color = TEMP_COLOR[d.temp] || '#64748b';
                    return (
                      <div key={d.temp} className="rounded-xl border p-3 text-center">
                        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `${color}1f`, color }}>
                          <Flame className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-lg font-bold tabular leading-none">{d.count}</p>
                        <p className="mt-1 text-[11px] capitalize text-muted-foreground">{d.temp} · {pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
