'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, Cpu, Mail, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { PlanBadge, StatusBadge, UsageBar, formatNumber } from '@/components/admin/admin-ui';

export default function AdminUsagePage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'usage', period],
    queryFn: () => api.get<any>('/admin/usage', { period }),
  });
  const d = data?.data;
  const rows: any[] = d?.tenants || [];
  const over = rows.filter((r) => r.health === 'over').length;
  const warn = rows.filter((r) => r.health === 'warning').length;

  return (
    <div>
      <PageHeader
        title="Usage & limits"
        description="Consumption per tenant against its plan limits"
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs">Period</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-[170px]" />
          </div>
        }
      />

      {isLoading ? <Loading /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Conversations" value={formatNumber(d?.totals?.conversations)} icon={MessageSquare} description={`in ${d?.period}`} />
            <StatCard title="Leads captured" value={formatNumber(d?.totals?.leads)} icon={Users} description={`in ${d?.period}`} />
            <StatCard title="Messages" value={formatNumber(d?.totals?.messages)} icon={Mail} description={`in ${d?.period}`} />
            <StatCard title="AI tokens" value={formatNumber(d?.totals?.aiTokens)} icon={Cpu} description={`${over} over limit · ${warn} near limit`} />
          </div>

          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Conversations / mo</TableHead>
                    <TableHead>Leads (total)</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>KB sources</TableHead>
                    <TableHead className="text-right">Msgs · AI tokens</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.tenantId}>
                      <TableCell>
                        <Link href={`/dashboard/admin/tenants/${r.tenantId}`} className="font-medium hover:underline">{r.name}</Link>
                        <p className="text-xs text-muted-foreground">/{r.slug} · <StatusBadge status={r.status} /></p>
                      </TableCell>
                      <TableCell><PlanBadge plan={r.plan} /></TableCell>
                      <TableCell><UsageBar used={r.usage.conversations} limit={r.limits.maxConversationsPerMonth} label=" " /></TableCell>
                      <TableCell><UsageBar used={r.usage.leadsTotal} limit={r.limits.maxLeads} label=" " /></TableCell>
                      <TableCell><UsageBar used={r.usage.users} limit={r.limits.maxUsers} label=" " /></TableCell>
                      <TableCell><UsageBar used={r.usage.agents} limit={r.limits.maxAgents} label=" " /></TableCell>
                      <TableCell><UsageBar used={r.usage.knowledgeSources} limit={r.limits.maxKnowledgeSources} label=" " /></TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(r.usage.messages)} · {formatNumber(r.usage.aiTokens)}</TableCell>
                      <TableCell>
                        {r.health === 'over' ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Over</Badge>
                          : r.health === 'warning' ? <Badge variant="warning">Near limit</Badge>
                          : <Badge variant="success">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground h-24">No tenants</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
