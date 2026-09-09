'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/shared/stat-card';
import { Users, MessageSquare, Target, TrendingUp, UserCheck, ArrowLeftRight, Calendar, Zap } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

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

  if (isLoading) return <Loading />;

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

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Track your lead generation performance"
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Visitors" value={stats.visitors} icon={Users} />
        <StatCard title="Conversations" value={stats.conversations} icon={MessageSquare} />
        <StatCard title="Leads Captured" value={stats.leads} icon={Target} />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Qualified" value={stats.qualified} icon={UserCheck} />
        <StatCard title="Hot Leads" value={stats.hot} icon={Zap} />
        <StatCard title="Handoffs" value={stats.handoffs} icon={ArrowLeftRight} />
        <StatCard title="Appointments" value={stats.appointments} icon={Calendar} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="conversations" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name">
                    {sourceData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leads by Status</CardTitle></CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byStatus.map((s: any) => ({ status: s._id || 'unknown', count: s.count || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Leads by Temperature</CardTitle></CardHeader>
          <CardContent>
            {byTemp.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byTemp.map((t: any) => ({ temp: t._id || 'unknown', count: t.count || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="temp" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
