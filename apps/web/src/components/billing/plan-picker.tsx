'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, SlidersHorizontal, ShieldCheck, Zap } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loading } from '@/components/shared/loading';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface PlanSpec {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  quota: Record<string, number>;
  highlights: string[];
  popular?: boolean;
}

interface Catalogue {
  currency: string;
  gstRate: number;
  trialDays: number;
  yearlyMonths: number;
  plans: PlanSpec[];
  unitPrices: any;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const qty = (n: number) => (n < 0 ? 'Unlimited' : n.toLocaleString('en-IN'));

/** Loads Razorpay's checkout script once, when it is actually needed. */
function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Choosing and paying for a plan. Also the page a workspace lands on when its
 * trial has ended, so it has to work on its own, with nothing else reachable.
 */
export function PlanPicker({ compact }: { compact?: boolean } = {}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({
    aiCalls: 50,
    leads: 5000,
    users: 10,
    whatsappMessages: 3000,
    agents: 3,
    inboundReceptionist: true,
    prospecting: false,
    whiteLabel: false,
  });

  const { data: cat, isLoading } = useQuery({
    queryKey: ['billing-catalogue'],
    queryFn: () => api.get<any>('/billing/catalogue'),
    staleTime: 10 * 60_000,
  });
  const catalogue: Catalogue | undefined = (cat as any)?.data || (cat as any);

  const { data: subData } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get<any>('/billing/subscription'),
  });
  const sub = (subData as any)?.data || (subData as any);

  // The custom plan is priced on the server so the GST and the rules always match
  const [quote, setQuote] = useState<any>(null);
  const quoteMutation = useMutation({
    mutationFn: (body: any) => api.post<any>('/billing/quote', body),
    onSuccess: (res: any) => setQuote(res?.data || res),
  });
  useEffect(() => {
    if (!showCustom) return;
    const t = setTimeout(() => quoteMutation.mutate({ planId: 'custom', billingInterval: interval, custom }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustom, interval, JSON.stringify(custom)]);

  const checkout = useMutation({
    mutationFn: (body: any) => api.post<any>('/billing/checkout', body),
    onSuccess: async (res: any, vars: any) => {
      const r = res?.data || res;
      if (!r?.gateway) {
        toast.info(r?.message || 'Invoice created - our team will activate the plan once payment is received.');
        return;
      }
      const ok = await loadRazorpay();
      if (!ok) return toast.error('Could not open the payment window. Check your connection and try again.');

      const rzp = new window.Razorpay({
        key: r.keyId,
        order_id: r.orderId,
        amount: r.amount,
        currency: r.currency,
        name: 'LeadBells',
        description: `${vars.planId === 'custom' ? 'Custom' : vars.planId} plan · ${r.quote.billingInterval}`,
        prefill: { name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(), email: user?.email || '' },
        notes: { workspace: r.workspace },
        theme: { color: '#4F46E5' },
        handler: async (resp: any) => {
          try {
            await api.post('/billing/confirm', {
              invoiceId: r.invoiceId,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            toast.success('Payment received - your workspace is active again 🎉');
            queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
            setTimeout(() => window.location.reload(), 1200);
          } catch (e: any) {
            toast.error(e.message || 'We could not confirm the payment. Please contact support with your payment id.');
          }
        },
        modal: { ondismiss: () => toast.info('Payment cancelled - nothing was charged.') },
      });
      rzp.open();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const buy = (planId: string) =>
    checkout.mutate({ planId, billingInterval: interval, ...(planId === 'custom' ? { custom } : {}) });

  const gstPct = useMemo(() => Math.round((catalogue?.gstRate ?? 0.18) * 100), [catalogue]);

  if (isLoading || !catalogue) return <Loading label="Loading plans" />;

  const currentPlan = sub?.plan;

  return (
    <div className="space-y-6">
      {/* Monthly / yearly */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-xl border bg-card p-1">
          {(['monthly', 'yearly'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setInterval(k)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                interval === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k}
            </button>
          ))}
        </div>
        {interval === 'yearly' && (
          <Badge variant="success" dot>
            {12 - catalogue.yearlyMonths} months free
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">All prices exclude {gstPct}% GST</span>
      </div>

      {/* The four plans */}
      <div className={cn('grid gap-4', compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {catalogue.plans.map((p) => {
          const price = interval === 'yearly' ? p.priceYearly : p.priceMonthly;
          const isCurrent = currentPlan === p.id;
          return (
            <Card
              key={p.id}
              className={cn(
                'relative flex flex-col overflow-hidden',
                p.popular && 'border-primary/50 shadow-lg shadow-primary/10',
                isCurrent && 'ring-2 ring-emerald-500/40',
              )}
            >
              {p.popular && (
                <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </div>
              )}
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    {isCurrent && <Badge variant="success">Current</Badge>}
                  </div>
                  <p className="mt-1 min-h-[32px] text-xs text-muted-foreground">{p.tagline}</p>
                </div>

                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-black tracking-tight">{inr(price)}</span>
                    <span className="mb-1 text-xs text-muted-foreground">/{interval === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    + {gstPct}% GST = {inr(price * (1 + catalogue.gstRate))}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xl font-bold text-primary">{qty(p.quota.aiCalls)}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">AI calls a month</p>
                </div>

                <ul className="flex-1 space-y-1.5">
                  {p.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={p.popular ? 'gradient' : 'outline'}
                  className="w-full"
                  disabled={checkout.isPending}
                  onClick={() => buy(p.id)}
                >
                  {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {isCurrent ? 'Renew' : 'Choose'} {p.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Build your own */}
      <Card>
        <CardContent className="p-5">
          <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setShowCustom((v) => !v)}>
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span className="font-semibold">Build your own plan</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Pick exactly how many calls, leads and users you need - we price it line by line
              </span>
            </span>
            <Badge variant={showCustom ? 'secondary' : 'outline'}>{showCustom ? 'Hide' : 'Open'}</Badge>
          </button>

          {showCustom && (
            <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                {[
                  { key: 'aiCalls', label: 'AI calls a month', min: 0, max: 2000, step: 5 },
                  { key: 'leads', label: 'Leads', min: 500, max: 200000, step: 500 },
                  { key: 'users', label: 'Team members', min: 1, max: 200, step: 1 },
                  { key: 'whatsappMessages', label: 'WhatsApp messages a month', min: 0, max: 100000, step: 500 },
                  { key: 'agents', label: 'Website chat agents', min: 0, max: 50, step: 1 },
                ].map((f) => (
                  <div key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <Label className="text-sm">{f.label}</Label>
                      <input
                        type="range"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={(custom as any)[f.key]}
                        onChange={(e) => setCustom({ ...custom, [f.key]: Number(e.target.value) })}
                        className="mt-1.5 w-full accent-[var(--color-primary)]"
                      />
                    </div>
                    <Input
                      className="h-9 w-28 text-right"
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={(custom as any)[f.key]}
                      onChange={(e) => setCustom({ ...custom, [f.key]: Number(e.target.value) || 0 })}
                    />
                  </div>
                ))}

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key: 'inboundReceptionist', label: 'Inbound AI receptionist' },
                    { key: 'prospecting', label: 'Leads Scrap AI' },
                    { key: 'whiteLabel', label: 'White label' },
                  ].map((a) => (
                    <label key={a.key} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                      <span>{a.label}</span>
                      <Switch
                        checked={(custom as any)[a.key]}
                        onCheckedChange={(v) => setCustom({ ...custom, [a.key]: v })}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* The bill */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Your price
                </h4>
                {quoteMutation.isPending && !quote ? (
                  <p className="mt-3 text-sm text-muted-foreground">Calculating…</p>
                ) : quote ? (
                  <>
                    <div className="mt-3 space-y-1.5">
                      {quote.lines.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between gap-3 text-xs">
                          <span className="min-w-0">
                            <span className="font-medium">{l.label}</span>
                            <span className="block text-[11px] text-muted-foreground">{l.detail}</span>
                          </span>
                          <span className="tabular shrink-0">{inr(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{inr(quote.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">GST @ {gstPct}%</span><span className="tabular">{inr(quote.gst)}</span></div>
                      <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular">{inr(quote.total)}</span></div>
                      <p className="text-[11px] text-muted-foreground">
                        Billed {quote.billingInterval}{quote.billingInterval === 'yearly' ? ` · ${quote.months} months charged` : ''}
                      </p>
                    </div>
                    <Button variant="gradient" className="mt-4 w-full" onClick={() => buy('custom')} disabled={checkout.isPending}>
                      {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Pay {inr(quote.total)}
                    </Button>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Move a slider to see the price.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Payments are handled by Razorpay. We never see your card details. GST invoice is issued for every payment.
      </p>
    </div>
  );
}
