'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Zap, XCircle, FileText, CreditCard, ArrowUp, ArrowDown, Sparkles, CalendarDays, Receipt, Gauge, Crown, Rocket, Building2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise'];

const PLAN_META: Record<string, { icon: any; tagline: string }> = {
  free: { icon: Sparkles, tagline: 'Try the basics' },
  starter: { icon: Zap, tagline: 'For small teams' },
  professional: { icon: Rocket, tagline: 'Most popular' },
  enterprise: { icon: Building2, tagline: 'Scale without limits' },
};

const planFeatures: Record<string, string[]> = {
  free: ['1 Agent', '100 Leads', '500 Conversations/mo', '5 Knowledge Sources', '2 Users'],
  starter: ['3 Agents', '1,000 Leads', '2,000 Conversations/mo', '20 Knowledge Sources', '5 Users'],
  professional: ['10 Agents', '10,000 Leads', '10,000 Conversations/mo', '50 Knowledge Sources', '20 Users'],
  enterprise: ['50 Agents', '100,000 Leads', '50,000 Conversations/mo', '200 Knowledge Sources', '100 Users'],
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  active: 'success', trialing: 'warning', cancelled: 'destructive', past_due: 'destructive', paused: 'secondary',
};

const invoiceStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  paid: 'success', pending: 'warning', failed: 'destructive', refunded: 'secondary', draft: 'default',
};

export default function BillingPage() {
  const queryClient = useQueryClient();

  // Plan change confirmation
  const [changePlan, setChangePlan] = useState<{ plan: string; direction: 'upgrade' | 'downgrade' } | null>(null);

  // Cancel
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Invoices
  const [showInvoices, setShowInvoices] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);

  const { data: subData, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get<any>('/billing/current'),
  });

  const { data: usageData } = useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: () => api.get<any>('/billing/usage'),
  });

  const { data: plansData } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<any>('/billing/plans'),
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing', 'invoices', invoicePage],
    queryFn: () => api.get<any>('/billing/invoices', { page: invoicePage, limit: 10 }),
    enabled: showInvoices,
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) => api.patch('/billing/upgrade', { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setChangePlan(null);
      toast.success('Plan upgraded successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const downgradeMutation = useMutation({
    mutationFn: (plan: string) => api.patch('/billing/downgrade', { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setChangePlan(null);
      toast.success('Plan downgraded');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => api.post('/billing/cancel', reason ? { reason } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setShowCancel(false);
      setCancelReason('');
      toast.success('Subscription cancelled. Reverted to Free plan.');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <Loading label="Loading billing" />;

  const subscription = (subData as any)?.data || {};
  const usageRaw = (usageData as any)?.data || {};
  const usage = usageRaw?.usage || {};
  const limits = usageRaw?.limits || {};
  const backendPlans = (plansData as any)?.data || [];
  const currentPlan = subscription.plan || 'free';
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const subStatus = subscription.status || 'active';

  // Build plans with backend data if available
  const getPlanPrice = (plan: string) => {
    const bp = Array.isArray(backendPlans) ? backendPlans.find((p: any) => p.name === plan) : null;
    return bp?.priceMonthly ?? { free: 0, starter: 1999, professional: 4999, enterprise: 14999 }[plan] ?? 0;
  };

  const getPlanLimits = (plan: string) => {
    const bp = Array.isArray(backendPlans) ? backendPlans.find((p: any) => p.name === plan) : null;
    return bp?.limits || null;
  };

  const handlePlanChange = () => {
    if (!changePlan) return;
    if (changePlan.direction === 'upgrade') {
      upgradeMutation.mutate(changePlan.plan);
    } else {
      downgradeMutation.mutate(changePlan.plan);
    }
  };

  const invoices = (invoicesData as any)?.data?.data || (invoicesData as any)?.data || [];
  const invoicesTotalPages = (invoicesData as any)?.data?.totalPages || 1;

  // Usage bars data
  const usageBars = [
    { label: 'Conversations', used: usage.conversations ?? 0, limit: limits.maxConversationsPerMonth ?? 0 },
    { label: 'Leads', used: usage.leads ?? 0, limit: limits.maxLeads ?? 0 },
    { label: 'Knowledge Sources', used: usage.kbSources ?? 0, limit: limits.maxKnowledgeSources ?? 0 },
    { label: 'Agents', used: usage.agents ?? 0, limit: limits.maxAgents ?? 0 },
    { label: 'Users', used: usage.users ?? 0, limit: limits.maxUsers ?? 0 },
    { label: 'AI Tokens', used: usage.aiTokensUsed ?? 0, limit: 0 },
    { label: 'Emails Sent', used: usage.emailsSent ?? 0, limit: 0 },
    { label: 'SMS Sent', used: usage.smsSent ?? 0, limit: 0 },
  ].filter((item) => item.limit > 0 || item.used > 0);

  const CurrentIcon = PLAN_META[currentPlan]?.icon || Sparkles;
  const usageTone = (pct: number): 'success' | 'warning' | 'danger' => (pct < 70 ? 'success' : pct < 90 ? 'warning' : 'danger');

  return (
    <div>
      <PageHeader
        icon={CreditCard}
        title="Billing"
        description="Your plan, monthly usage and invoices in one place."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowInvoices(true); setInvoicePage(1); }}>
              <FileText className="h-4 w-4" /> Invoices
            </Button>
            {currentPlan !== 'free' && subStatus === 'active' && (
              <Button variant="outline" className="text-rose-600 hover:text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/40" onClick={() => setShowCancel(true)}>
                <XCircle className="h-4 w-4" /> Cancel Subscription
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Current Subscription hero */}
        <Card className="relative overflow-hidden lg:col-span-1 border-0 text-white shadow-glow">
          <div className="absolute inset-0 bg-brand-gradient" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-16 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
          <div className="relative p-6 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
                <Crown className="h-3.5 w-3.5" /> Current plan
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize backdrop-blur',
                subStatus === 'active' ? 'bg-emerald-400/25 text-white' : subStatus === 'trialing' ? 'bg-amber-300/30 text-white' : 'bg-rose-400/30 text-white',
              )}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> {subStatus.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <CurrentIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-bold capitalize leading-none tracking-tight">{currentPlan}</p>
                <p className="mt-1 text-sm text-white/80">{PLAN_META[currentPlan]?.tagline}</p>
              </div>
            </div>
            <p className="mt-5 text-4xl font-bold tabular leading-none">
              {formatCurrency(getPlanPrice(currentPlan))}
              <span className="text-base font-medium text-white/75">/mo</span>
            </p>
            <div className="mt-auto pt-6 space-y-2 text-sm text-white/85">
              {subscription.currentPeriodStart && (
                <div className="flex items-center justify-between"><span className="text-white/70">Period start</span><span className="font-medium">{formatDate(subscription.currentPeriodStart)}</span></div>
              )}
              {subscription.currentPeriodEnd && (
                <div className="flex items-center justify-between"><span className="text-white/70">Renews on</span><span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span></div>
              )}
              {subscription.trialEndsAt && (
                <div className="flex items-center justify-between"><span className="text-white/70">Trial ends</span><span className="font-medium">{formatDate(subscription.trialEndsAt)}</span></div>
              )}
              {subscription.cancelledAt && (
                <div className="flex items-center justify-between"><span className="text-white/70">Cancelled</span><span className="font-medium">{formatDate(subscription.cancelledAt)}</span></div>
              )}
              {!subscription.currentPeriodStart && !subscription.currentPeriodEnd && !subscription.trialEndsAt && !subscription.cancelledAt && (
                <p className="flex items-center gap-2 text-white/75"><CalendarDays className="h-4 w-4" /> No billing period yet</p>
              )}
            </div>
          </div>
        </Card>

        {/* Usage */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Current usage</CardTitle>
              <CardDescription>Consumption this billing period against your plan limits.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {usageBars.length === 0 ? (
              <EmptyState compact icon={Gauge} title="No usage yet" description="Usage meters appear once your agents start handling conversations." />
            ) : (
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {usageBars.map((item) => {
                  const pct = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
                  const tone = usageTone(pct);
                  return (
                    <div key={item.label}>
                      <div className="flex items-baseline justify-between text-sm mb-1.5">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground tabular">
                          <span className="font-semibold text-foreground">{item.used.toLocaleString()}</span>
                          {item.limit > 0 ? ` / ${item.limit.toLocaleString()}` : ''}
                          {item.limit > 0 && (
                            <span className={cn(
                              'ml-2 rounded-full px-1.5 py-px text-[10px] font-semibold',
                              tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                              tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                              tone === 'danger' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                            )}>{Math.round(pct)}%</span>
                          )}
                        </span>
                      </div>
                      {item.limit > 0 ? (
                        <Progress value={pct} tone={tone} />
                      ) : (
                        <Progress value={100} tone="primary" className="opacity-40" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans Grid */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight">Available plans</h3>
        <p className="text-sm text-muted-foreground">Upgrade or downgrade any time. Changes apply immediately.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        {PLAN_ORDER.map((plan) => {
          const planIndex = PLAN_ORDER.indexOf(plan);
          const isCurrent = currentPlan === plan;
          const isUpgrade = planIndex > currentIndex;
          const isDowngrade = planIndex < currentIndex;
          const bl = getPlanLimits(plan);
          const meta = PLAN_META[plan];
          const PlanIcon = meta?.icon || Sparkles;
          const highlight = plan === 'professional' && !isCurrent;

          return (
            <Card
              key={plan}
              className={cn(
                'relative flex flex-col transition-all',
                isCurrent && 'ring-2 ring-primary border-primary/40 shadow-glow',
                highlight && 'border-violet-500/40',
              )}
            >
              {isCurrent && (
                <Badge variant="solid" className="absolute -top-2.5 left-4 shadow-sm"><Check className="h-3 w-3" /> Current</Badge>
              )}
              {highlight && (
                <Badge variant="violet" className="absolute -top-2.5 left-4 shadow-sm"><Sparkles className="h-3 w-3" /> Popular</Badge>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', isCurrent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                    <PlanIcon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <CardTitle className="capitalize">{plan}</CardTitle>
                    <CardDescription className="text-xs">{meta?.tagline}</CardDescription>
                  </div>
                </div>
                <div className="pt-3">
                  <span className="text-3xl font-bold tabular tracking-tight">{formatCurrency(getPlanPrice(plan))}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2.5">
                  {(bl ? [
                    `${bl.maxAgents} Agent${bl.maxAgents > 1 ? 's' : ''}`,
                    `${bl.maxLeads?.toLocaleString()} Leads`,
                    `${bl.maxConversationsPerMonth?.toLocaleString()} Conversations/mo`,
                    `${bl.maxKnowledgeSources} Knowledge Sources`,
                    `${bl.maxUsers} Users`,
                  ] : planFeatures[plan] || []).map((feature: string) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="soft" className="w-full" disabled>Current Plan</Button>
                ) : isUpgrade ? (
                  <Button variant={highlight ? 'gradient' : 'default'} className="w-full" onClick={() => setChangePlan({ plan, direction: 'upgrade' })}>
                    <ArrowUp className="h-4 w-4" /> Upgrade
                  </Button>
                ) : isDowngrade ? (
                  <Button variant="outline" className="w-full" onClick={() => setChangePlan({ plan, direction: 'downgrade' })}>
                    <ArrowDown className="h-4 w-4" /> Downgrade
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Plan Change Confirmation */}
      <Dialog open={!!changePlan} onOpenChange={() => setChangePlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{changePlan?.direction === 'upgrade' ? 'Upgrade' : 'Downgrade'} Plan</DialogTitle>
            <DialogDescription>
              {changePlan?.direction === 'upgrade'
                ? `Are you sure you want to upgrade from ${currentPlan} to ${changePlan?.plan}? You will be charged ${formatCurrency(getPlanPrice(changePlan?.plan || ''))}/mo.`
                : `Are you sure you want to downgrade from ${currentPlan} to ${changePlan?.plan}? Your limits will be reduced. If current usage exceeds the new limits, some features may be restricted.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <span className="capitalize font-semibold">{currentPlan}</span>
            <span className="text-muted-foreground">→</span>
            <span className="capitalize font-semibold text-primary">{changePlan?.plan}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlan(null)}>Cancel</Button>
            <Button
              variant={changePlan?.direction === 'upgrade' ? 'default' : 'outline'}
              onClick={handlePlanChange}
              disabled={upgradeMutation.isPending || downgradeMutation.isPending}
            >
              {(upgradeMutation.isPending || downgradeMutation.isPending)
                ? 'Processing...'
                : changePlan?.direction === 'upgrade' ? 'Confirm Upgrade' : 'Confirm Downgrade'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure? Your subscription will be cancelled immediately and you will be reverted to the Free plan. All data will be preserved but limits will be reduced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for cancellation <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Tell us why you're cancelling..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancel(false); setCancelReason(''); }}>Keep Subscription</Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate(cancelReason.trim() || undefined)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoices Dialog */}
      <Dialog open={showInvoices} onOpenChange={setShowInvoices}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoices</DialogTitle>
            <DialogDescription>Your billing history and invoices</DialogDescription>
          </DialogHeader>

          {invoicesLoading ? (
            <Loading label="Loading invoices" />
          ) : !Array.isArray(invoices) || invoices.length === 0 ? (
            <EmptyState compact icon={Receipt} title="No invoices yet" description="Invoices will show up here after your first paid billing cycle." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv._id}>
                      <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                      <TableCell><Badge variant="outline">{inv.plan}</Badge></TableCell>
                      <TableCell className="font-semibold tabular">{formatCurrency(inv.amount, inv.currency || 'INR')}</TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusVariant[inv.status] || 'default'} dot>{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.periodStart && inv.periodEnd
                          ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
                          : '—'
                        }
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {invoicesTotalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" disabled={invoicePage <= 1} onClick={() => setInvoicePage(invoicePage - 1)}>Prev</Button>
                  <span className="text-xs text-muted-foreground tabular">Page {invoicePage} of {invoicesTotalPages}</span>
                  <Button size="sm" variant="outline" disabled={invoicePage >= invoicesTotalPages} onClick={() => setInvoicePage(invoicePage + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
