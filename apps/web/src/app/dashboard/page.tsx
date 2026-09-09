'use client';
import { useQuery } from '@tanstack/react-query';
import { Users, MessageSquare, Bot, Target, TrendingUp, ArrowLeftRight, Ticket, Calendar } from 'lucide-react';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/shared/loading';
import { LeadsByStatusChart } from '@/components/charts/leads-by-status-chart';
import { ConversationTrendChart } from '@/components/charts/conversation-trend-chart';

export default function DashboardPage() {
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

  if (isLoading) return <Loading />;

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

  // convStats returns: { dailyConversations, byStatus (object), averageMessagesPerConversation }
  const convStatsData = (convStats as any)?.data || {};

  // Convert leadsByStatus object to array for chart: { new: 5, qualified: 3 } → [{ _id: 'new', count: 5 }, ...]
  const statusChartData = Object.entries(leadsByStatus).map(([key, val]) => ({ _id: key, count: val as number }));

  // dailyConversations is array of { _id: "2025-01-01", count: 5 }
  const dailyConversations = convStatsData.dailyConversations || [];

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your lead generation performance" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Leads" value={raw.totalLeads || 0} icon={Users} description="all time" />
        <StatCard title="Conversations" value={raw.totalConversations || 0} icon={MessageSquare} description="total" />
        <StatCard title="Hot Leads" value={hotLeads} icon={Target} description="high intent" />
        <StatCard title="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} icon={TrendingUp} description="leads to converted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Avg. Lead Score" value={averageScore} icon={Target} />
        <StatCard title="Active Agents" value={raw.activeAgents || 0} icon={Bot} />
        <StatCard title="Total Users" value={raw.totalUsers || 0} icon={Users} />
        <StatCard title="Qualified Leads" value={qualifiedLeads} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsByStatusChart data={statusChartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversations Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationTrendChart data={dailyConversations} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
