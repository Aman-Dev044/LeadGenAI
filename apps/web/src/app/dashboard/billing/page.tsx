'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Zap, XCircle, FileText, CreditCard, ArrowUp, ArrowDown } from 'lucide-react';
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
import { formatCurrency, formatDate } from '@/lib/utils';

const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise'];

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

  if (isLoading) return <Loading />;

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

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowInvoices(true); setInvoicePage(1); }}>
              <FileText className="mr-2 h-4 w-4" /> Invoices
            </Button>
            {currentPlan !== 'free' && subStatus === 'active' && (
              <Button variant="outline" className="text-destructive" onClick={() => setShowCancel(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel Subscription
              </Button>
            )}
          </div>
        }
      />

      {/* Current Subscription Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
              <CardDescription className="mt-1">
                <span className="capitalize font-medium text-foreground">{currentPlan}</span> Plan
                {' - '}
                {formatCurrency(getPlanPrice(currentPlan))}/mo
              </CardDescription>
            </div>
            <Badge variant={statusVariant[subStatus] || 'default'} className="capitalize">{subStatus.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        {(subscription.currentPeriodStart || subscription.currentPeriodEnd || subscription.cancelledAt) && (
          <CardContent>
            <div className="flex gap-6 text-sm">
              {subscription.currentPeriodStart && (
                <div>
                  <span className="text-muted-foreground">Period Start: </span>
                  <span>{formatDate(subscription.currentPeriodStart)}</span>
                </div>
              )}
              {subscription.currentPeriodEnd && (
                <div>
                  <span className="text-muted-foreground">Period End: </span>
                  <span>{formatDate(subscription.currentPeriodEnd)}</span>
                </div>
              )}
              {subscription.cancelledAt && (
                <div>
                  <span className="text-muted-foreground">Cancelled: </span>
                  <span className="text-destructive">{formatDate(subscription.cancelledAt)}</span>
                </div>
              )}
              {subscription.trialEndsAt && (
                <div>
                  <span className="text-muted-foreground">Trial Ends: </span>
                  <span>{formatDate(subscription.trialEndsAt)}</span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage */}
      {usageBars.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Current Usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {usageBars.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.used.toLocaleString()}
                    {item.limit > 0 ? ` / ${item.limit.toLocaleString()}` : ''}
                  </span>
                </div>
                {item.limit > 0 ? (
                  <Progress
                    value={Math.min((item.used / item.limit) * 100, 100)}
                    className={`h-2 ${item.used / item.limit > 0.9 ? '[&>div]:bg-destructive' : ''}`}
                  />
                ) : (
                  <div className="h-2 bg-muted rounded" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {PLAN_ORDER.map((plan) => {
          const planIndex = PLAN_ORDER.indexOf(plan);
          const isCurrent = currentPlan === plan;
          const isUpgrade = planIndex > currentIndex;
          const isDowngrade = planIndex < currentIndex;
          const bl = getPlanLimits(plan);

          return (
            <Card key={plan} className={isCurrent ? 'border-primary ring-2 ring-primary' : ''}>
              <CardHeader>
                <CardTitle className="capitalize">{plan}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{formatCurrency(getPlanPrice(plan))}</span>
                  <span className="text-muted-foreground">/mo</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(bl ? [
                    `${bl.maxAgents} Agent${bl.maxAgents > 1 ? 's' : ''}`,
                    `${bl.maxLeads?.toLocaleString()} Leads`,
                    `${bl.maxConversationsPerMonth?.toLocaleString()} Conversations/mo`,
                    `${bl.maxKnowledgeSources} Knowledge Sources`,
                    `${bl.maxUsers} Users`,
                  ] : planFeatures[plan] || []).map((feature: string) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : isUpgrade ? (
                  <Button className="w-full" onClick={() => setChangePlan({ plan, direction: 'upgrade' })}>
                    <ArrowUp className="mr-2 h-4 w-4" /> Upgrade
                  </Button>
                ) : isDowngrade ? (
                  <Button variant="outline" className="w-full" onClick={() => setChangePlan({ plan, direction: 'downgrade' })}>
                    <ArrowDown className="mr-2 h-4 w-4" /> Downgrade
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
            <Label>Reason for cancellation (optional)</Label>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoices</DialogTitle>
            <DialogDescription>Your billing history and invoices</DialogDescription>
          </DialogHeader>

          {invoicesLoading ? (
            <Loading />
          ) : !Array.isArray(invoices) || invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invoices yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell className="capitalize">{inv.plan}</TableCell>
                      <TableCell>{formatCurrency(inv.amount, inv.currency || 'INR')}</TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusVariant[inv.status] || 'default'} className="capitalize">{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv.periodStart && inv.periodEnd
                          ? `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(inv.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {invoicesTotalPages > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  <Button size="sm" variant="outline" disabled={invoicePage <= 1} onClick={() => setInvoicePage(invoicePage - 1)}>Prev</Button>
                  <span className="text-sm text-muted-foreground flex items-center">Page {invoicePage} of {invoicesTotalPages}</span>
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
