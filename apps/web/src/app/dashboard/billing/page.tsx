'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CreditCard, FileText, Gauge, PhoneCall, Users, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { PlanPicker } from '@/components/billing/plan-picker';
import { formatDate, cn } from '@/lib/utils';

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** One quota line: how much of the month's allowance is gone. */
function UsageBar({ icon: Icon, label, used, quota }: { icon: any; label: string; used: number; quota: number }) {
  const unlimited = quota < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, quota)) * 100));
  const tone = pct >= 100 ? 'text-destructive' : pct >= 80 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</span>
        <span className={cn('tabular text-xs', tone)}>
          {used.toLocaleString('en-IN')} {unlimited ? '· unlimited' : `/ ${quota.toLocaleString('en-IN')}`}
        </span>
      </div>
      {!unlimited && <Progress value={pct} className={cn(pct >= 100 && '[&>div]:bg-destructive', pct >= 80 && pct < 100 && '[&>div]:bg-amber-500')} />}
    </div>
  );
}

export default function BillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get<any>('/billing/subscription'),
  });
  const sub = (data as any)?.data || (data as any);

  const { data: invData } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => api.get<any>('/billing/invoices', { limit: 10 }),
  });
  const invoices = (invData as any)?.data?.data || (invData as any)?.data || [];

  if (isLoading) return <Loading label="Loading your plan" />;

  const locked = sub?.requiresPayment;
  const trial = sub?.trial;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & billing"
        description="What your workspace is on, how much of it you have used, and how to change it."
        icon={CreditCard}
      />

      {/* Where they stand */}
      <Card className={cn(locked && 'border-destructive/50', trial && !locked && 'border-amber-500/40')}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{sub?.planName || 'No plan'}</h2>
              {locked ? (
                <Badge variant="destructive" dot>Payment needed</Badge>
              ) : trial ? (
                <Badge variant="warning" dot>Free trial</Badge>
              ) : (
                <Badge variant="success" dot>Active</Badge>
              )}
            </div>
            {locked ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {trial ? 'Your free trial has ended.' : 'Your subscription has ended.'} Pick a plan below to switch everything back on.
              </p>
            ) : sub?.expiresAt ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {trial ? 'Trial ends' : 'Renews'} on {formatDate(sub.expiresAt)} · {sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'} left
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-muted/50 px-5 py-3 text-center">
            <p className="text-2xl font-black text-primary">{sub?.quota?.aiCalls < 0 ? '∞' : sub?.quota?.aiCalls ?? 0}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">AI calls a month</p>
          </div>
        </CardContent>
      </Card>

      {/* This month */}
      {sub?.usage && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-primary" /> This month</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageBar icon={PhoneCall} label="AI calls" used={sub.usage.aiCalls} quota={sub.quota.aiCalls} />
              <UsageBar icon={MessageCircle} label="WhatsApp messages" used={sub.usage.whatsappMessages} quota={sub.quota.whatsappMessages} />
              <UsageBar icon={Users} label="Team members" used={sub.usage.users} quota={sub.quota.users} />
              <UsageBar icon={FileText} label="Leads" used={sub.usage.leads} quota={sub.quota.leads} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-lg font-bold">{locked ? 'Choose a plan to carry on' : 'Plans'}</h2>
        <PlanPicker />
      </div>

      {/* Invoices */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Invoices</h3>
          {invoices.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" description="Your first invoice appears here once you pay for a plan." compact />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="tabular text-sm">{inr(inv.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'failed' ? 'destructive' : 'warning'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
