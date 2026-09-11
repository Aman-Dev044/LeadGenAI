'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import {
  Users, MessageSquare, Bot, Target, TrendingUp, Flame, Sparkles, ArrowRight,
  Plus, CalendarDays, Gauge, UserCheck, Globe,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/shared/loading';
import { LeadsByStatusChart } from '@/components/charts/leads-by-status-chart';
import { ConversationTrendChart } from '@/components/charts/conversation-trend-chart';
import { ChartEmpty } from '@/components/charts/chart-kit';
import { cn } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TEMP_STYLES: Record<string, { bar: string; label: string; icon: React.ReactNode }> = {
  hot: { bar: 'bg-rose-500', label: 'Hot', icon: <Flame className="h-3.5 w-3.5 text-rose-500" /> },
  warm: { bar: 'bg-amber-500', label: 'Warm', icon: <Flame className="h-3.5 w-3.5 text-amber-500" /> },
  cold: { bar: 'bg-sky-500', label: 'Cold', icon: <Flame className="h-3.5 w-3.5 text-sky-500" /> },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, tenant, impersonation } = useAuthStore();
  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;

  // The owner's home is the console, not their (empty) own workspace
  useEffect(() => {
    if (isOwner) router.replace('/dashboard/admin');
  }, [isOwner, router]);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.get<any>('/dashboard/overview'),
    refetchInterval: 10000,
  });

  const { data: leadStats } = useQuery({
    queryKey: ['dashboard', 'lead-stats'],
    queryFn: () => api.get<any>('/dashboard/leads/stats'),
    refetchInterval: 15000,
  });

  const { data: convStats } = useQuery({
    queryKey: ['dashboard', 'conversation-stats'],
    queryFn: () => api.get<any>('/dashboard/conversations/stats'),
    refetchInterval: 15000,
  });

  if (isLoading || isOwner) return <Loading label="Loading your dashboard" />;

  // Backend overview returns: totalLeads, totalConversations, activeAgents, totalUsers, leadsByStatus (object), leadsByTemperature (object)
  const raw = (overview as any)?.data || {};
  const leadsByTemp = raw.leadsByTemperature || {};
  const leadsByStatus = raw.leadsByStatus || {};

  // Derive stats from available data
  const hotLeads = leadsByTemp.hot || 0;
  const qualifiedLeads = leadsByStatus.qualified || 0;
  const convertedLeads = leadsByStatus.converted || 0;
  const conversionRate = raw.totalLeads > 0 ? ((convertedLeads / raw.totalLeads) * 100) : 0;

  // leadStats returns: { dailyLeads, topSources, averageScore }
  const leadStatsData = (leadStats as any)?.data || {};
  const averageScore = Math.round(leadStatsData.averageScore || 0);
  const topSources: { _id?: string; source?: string; count: number }[] = Array.isArray(leadStatsData.topSources) ? leadStatsData.topSources : [];
  const topSourcesMax = topSources.reduce((m, s) => Math.max(m, s.count || 0), 0);

  // convStats returns: { dailyConversations, byStatus (object), averageMessagesPerConversation }
  const convStatsData = (convStats as any)?.data || {};

  // Convert leadsByStatus object to array for chart: { new: 5, qualified: 3 } → [{ _id: 'new', count: 5 }, ...]
  const statusChartData = Object.entries(leadsByStatus).map(([key, val]) => ({ _id: key, count: val as number }));

  // dailyConversations is array of { _id: "2025-01-01", count: 5 }
  const dailyConversations = convStatsData.dailyConversations || [];

  const tempTotal = ['hot', 'warm', 'cold'].reduce((s, k) => s + (leadsByTemp[k] || 0), 0);
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 md:p-8 text-white shadow-lg shadow-primary/30">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-8 top-6 h-24 w-24 rounded-full border border-white/20" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3 w-3" /> {tenant?.name || 'Your workspace'}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {greeting()}, {user?.firstName || 'there'} 👋
            </h1>
            <p className="mt-1.5 text-sm text-white/80 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {today}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white text-primary hover:bg-white/90 shadow-md shadow-black/10"
              onClick={() => router.push('/dashboard/leads')}
            >
              <Plus className="h-4 w-4" /> Add lead
            </Button>
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur"
              onClick={() => router.push('/dashboard/conversations')}
            >
              <MessageSquare className="h-4 w-4" /> View conversations <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <PageHeader
        title="Overview"
        description="A live snapshot of your lead generation performance."
        icon={Gauge}
        className="mb-0"
      />

      {/* KPI row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Leads" value={raw.totalLeads || 0} icon={Users} description="all time" tone="primary" onClick={() => router.push('/dashboard/leads')} />
        <StatCard title="Conversations" value={raw.totalConversations || 0} icon={MessageSquare} description="total chats" tone="info" onClick={() => router.push('/dashboard/conversations')} />
        <StatCard title="Hot Leads" value={hotLeads} icon={Flame} description="high intent" tone="danger" />
        <StatCard title="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} icon={TrendingUp} description="leads → converted" tone="success" />
      </div>

      {/* KPI row 2 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Avg. Lead Score" value={averageScore} icon={Target} description="out of 100" tone="violet" />
        <StatCard title="Active Agents" value={raw.activeAgents || 0} icon={Bot} description="AI agents live" tone="info" onClick={() => router.push('/dashboard/agents')} />
        <StatCard title="Team Members" value={raw.totalUsers || 0} icon={UserCheck} description="workspace users" tone="neutral" onClick={() => router.push('/dashboard/users')} />
        <StatCard title="Qualified Leads" value={qualifiedLeads} icon={TrendingUp} description="ready for sales" tone="success" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Leads by status</CardTitle>
            <CardDescription>How your pipeline is distributed right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsByStatusChart data={statusChartData} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Conversations trend</CardTitle>
            <CardDescription>New conversations started per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversationTrendChart data={dailyConversations} height={260} />
          </CardContent>
        </Card>
      </div>

      {/* Temperature + sources */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Leads by temperature</CardTitle>
            <CardDescription>Intent split across hot, warm and cold leads.</CardDescription>
          </CardHeader>
          <CardContent>
            {tempTotal === 0 ? (
              <ChartEmpty height={160} />
            ) : (
              <div className="space-y-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {(['hot', 'warm', 'cold'] as const).map((k) => {
                    const pct = ((leadsByTemp[k] || 0) / tempTotal) * 100;
                    return pct > 0 ? (
                      <div key={k} className={cn('h-full transition-all', TEMP_STYLES[k].bar)} style={{ width: `${pct}%` }} title={`${TEMP_STYLES[k].label}: ${leadsByTemp[k] || 0}`} />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['hot', 'warm', 'cold'] as const).map((k) => {
                    const count = leadsByTemp[k] || 0;
                    const pct = Math.round((count / tempTotal) * 100);
                    return (
                      <div key={k} className="rounded-xl border bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          {TEMP_STYLES[k].icon} {TEMP_STYLES[k].label}
                        </div>
                        <p className="mt-1.5 text-xl font-bold tabular leading-none">{count}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground tabular">{pct}% of leads</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Top sources</CardTitle>
            <CardDescription>Where your leads are coming from.</CardDescription>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <ChartEmpty height={160} message="No source data yet" />
            ) : (
              <ul className="space-y-3">
                {topSources.slice(0, 6).map((s, i) => {
                  const name = s._id || s.source || 'unknown';
                  const pct = topSourcesMax ? Math.round(((s.count || 0) / topSourcesMax) * 100) : 0;
                  return (
                    <li key={`${name}-${i}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 capitalize">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Globe className="h-3.5 w-3.5" />
                          </span>
                          {name}
                        </span>
                        <span className="font-semibold tabular">{s.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
