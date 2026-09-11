'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, Cpu, Mail, AlertTriangle, Gauge, CheckCircle2, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { TableSkeleton } from '@/components/shared/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanBadge, StatusBadge, formatNumber } from '@/components/admin/admin-ui';
import { getInitials, cn } from '@/lib/utils';

/** Compact usage meter for a table cell: value / limit + tone-coloured bar. */
function Meter({ used, limit }: { used: number; limit?: number }) {
  const unlimited = !limit || limit <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && used > limit;
  const tone = over || pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
  return (
    <div className="min-w-[130px] space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn('font-semibold tabular', over ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{formatNumber(used)}</span>
        <span className="text-muted-foreground tabular">/ {unlimited ? '∞' : formatNumber(limit)}</span>
      </div>
      <Progress value={unlimited ? 0 : pct} tone={tone} className="h-1.5" />
    </div>
  );
}

function HealthBadge({ health }: { health?: string }) {
  if (health === 'over') return <Badge variant="destructive"><AlertTriangle className="h-3 w-3" /> Over limit</Badge>;
  if (health === 'warning') return <Badge variant="warning" dot>Near limit</Badge>;
  return <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>;
}

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
  const healthy = rows.length - over - warn;

  return (
    <div>
      <PageHeader
        eyebrow="Owner console"
        icon={Gauge}
        title="Usage & limits"
        description="Consumption per tenant against its plan limits for the selected month"
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-card">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Period</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-[150px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)}
          </div>
          <TableSkeleton cols={8} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Conversations" value={formatNumber(d?.totals?.conversations)} icon={MessageSquare} tone="primary" description={`in ${d?.period}`} />
            <StatCard title="Leads captured" value={formatNumber(d?.totals?.leads)} icon={Users} tone="success" description={`in ${d?.period}`} />
            <StatCard title="Messages" value={formatNumber(d?.totals?.messages)} icon={Mail} tone="info" description={`in ${d?.period}`} />
            <StatCard
              title="AI tokens"
              value={formatNumber(d?.totals?.aiTokens)}
              icon={Cpu}
              tone={over ? 'danger' : warn ? 'warning' : 'violet'}
              description={`${over} over limit · ${warn} near limit`}
              footer={
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {healthy} healthy</span>
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {warn} near</span>
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {over} over</span>
                </div>
              }
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                <TableRow key={r.tenantId} className={cn(r.health === 'over' && 'bg-rose-500/[0.03]')}>
                  <TableCell>
                    <Link href={`/dashboard/admin/tenants/${r.tenantId}`} className="group flex items-center gap-3">
                      <Avatar className="h-9 w-9"><AvatarFallback className="text-[11px]">{getInitials(r.name || 'W')}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold group-hover:text-primary transition-colors">{r.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>/{r.slug}</span>
                          <StatusBadge status={r.status} />
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell><PlanBadge plan={r.plan} /></TableCell>
                  <TableCell><Meter used={r.usage.conversations} limit={r.limits.maxConversationsPerMonth} /></TableCell>
                  <TableCell><Meter used={r.usage.leadsTotal} limit={r.limits.maxLeads} /></TableCell>
                  <TableCell><Meter used={r.usage.users} limit={r.limits.maxUsers} /></TableCell>
                  <TableCell><Meter used={r.usage.agents} limit={r.limits.maxAgents} /></TableCell>
                  <TableCell><Meter used={r.usage.knowledgeSources} limit={r.limits.maxKnowledgeSources} /></TableCell>
                  <TableCell className="text-right">
                    <p className="text-sm font-semibold tabular">{formatNumber(r.usage.messages)}</p>
                    <p className="text-xs text-muted-foreground tabular">{formatNumber(r.usage.aiTokens)} tokens</p>
                  </TableCell>
                  <TableCell><HealthBadge health={r.health} /></TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Gauge className="h-5 w-5" /></div>
                      <p className="text-sm font-medium text-foreground">No tenants</p>
                      <p className="text-xs">Nothing consumed in this period.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
