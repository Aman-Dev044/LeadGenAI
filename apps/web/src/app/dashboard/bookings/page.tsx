'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardList, CreditCard, CheckCircle2, XCircle, MessageCircle, Loader2, IndianRupee, Clock } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, ToolbarSpacer } from '@/components/shared/toolbar';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate } from '@/lib/utils';
import type { BookingRequest } from '@/types';

const STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  collecting: { label: 'Collecting details', variant: 'secondary' },
  submitted: { label: 'Needs payment link', variant: 'warning' },
  payment_sent: { label: 'Payment link sent', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-bookings', status],
    queryFn: () => api.get<any>('/whatsapp/bookings', status ? { status } : undefined),
    refetchInterval: 30_000,
  });
  const bookings: BookingRequest[] = (data as any)?.data || data || [];

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/whatsapp/bookings/${id}`, body),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-bookings'] });
      toast.success(vars.body.paymentLink ? 'Payment link sent on WhatsApp' : 'Booking updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = {
    open: bookings.filter((b) => ['submitted', 'payment_sent'].includes(b.status)).length,
    needLink: bookings.filter((b) => b.status === 'submitted').length,
    paid: bookings.filter((b) => ['paid', 'confirmed'].includes(b.status)).length,
    collecting: bookings.filter((b) => b.status === 'collecting').length,
  };

  return (
    <div>
      <PageHeader title="Bookings" description="Orders and bookings the WhatsApp AI collected from customers. Add the payment link when it is not a fixed one, then confirm once paid." icon={ClipboardList} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open" value={counts.open} icon={Clock} tone="primary" description="waiting on payment" />
        <StatCard title="Need payment link" value={counts.needLink} icon={CreditCard} tone="violet" description="send from here" />
        <StatCard title="Paid / confirmed" value={counts.paid} icon={CheckCircle2} tone="success" description="in this list" />
        <StatCard title="Still collecting" value={counts.collecting} icon={MessageCircle} tone="info" description="AI asking for details" />
      </div>

      <Toolbar>
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="px-1 text-xs text-muted-foreground tabular">{bookings.length} booking{bookings.length === 1 ? '' : 's'}</span>
      </Toolbar>

      {isLoading ? (
        <Loading />
      ) : bookings.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No bookings yet" description="Add booking forms under Settings › WhatsApp AI. When a customer books on WhatsApp, it shows up here." />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const s = STATUS[b.status] || STATUS.collecting;
            const lead = b.lead;
            const fields = Object.entries(b.fields || {});
            return (
              <Card key={b._id} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{b.formName || b.formKey}</h3>
                      <Badge variant={s.variant} dot>{s.label}</Badge>
                      {b.amount ? <span className="inline-flex items-center text-sm font-medium"><IndianRupee className="h-3.5 w-3.5" />{b.amount}</span> : null}
                      <span className="text-xs text-muted-foreground">{formatDate(b.submittedAt || b.createdAt)}</span>
                    </div>
                    <button className="mt-1 text-sm text-primary hover:underline" onClick={() => router.push(`/dashboard/leads/${b.leadId}`)}>
                      {lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone : 'Lead'}{lead?.phone ? ` · ${lead.phone}` : ''}
                    </button>
                    <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {fields.length === 0 && <span className="text-muted-foreground">No details yet</span>}
                      {fields.map(([k, v]) => (
                        <div key={k} className="flex gap-2"><span className="text-muted-foreground">{k}:</span><span className="font-medium break-all">{String(v)}</span></div>
                      ))}
                    </div>
                    {b.paymentLink && (
                      <p className="mt-2 text-xs text-muted-foreground break-all">Payment link: <a href={b.paymentLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">{b.paymentLink}</a>{b.paymentLinkSentAt ? ` · sent ${formatDate(b.paymentLinkSentAt)}` : ''}</p>
                    )}
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">Notes: {b.notes}</p>}
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[360px]">
                    {['submitted', 'payment_sent', 'collecting'].includes(b.status) && (
                      <div className="flex gap-2">
                        <Input className="h-9" placeholder="Paste payment link (Razorpay / UPI / Stripe)" value={links[b._id] ?? ''} onChange={(e) => setLinks({ ...links, [b._id]: e.target.value })} />
                        <Button size="sm" onClick={() => links[b._id]?.trim() && update.mutate({ id: b._id, body: { paymentLink: links[b._id].trim() } })} disabled={update.isPending || !links[b._id]?.trim()}>
                          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Send
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {['submitted', 'payment_sent'].includes(b.status) && (
                        <Button size="sm" variant="outline" className="text-emerald-700" onClick={() => update.mutate({ id: b._id, body: { status: 'paid' } })}><CheckCircle2 className="h-3.5 w-3.5" /> Mark paid</Button>
                      )}
                      {['paid', 'payment_sent', 'submitted'].includes(b.status) && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: b._id, body: { status: 'confirmed' } })}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm (lead → Won)</Button>
                      )}
                      {!['cancelled', 'confirmed'].includes(b.status) && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => update.mutate({ id: b._id, body: { status: 'cancelled' } })}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>
                      )}
                      {b.conversationId && (
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/dashboard/conversations/${b.conversationId}`)}><MessageCircle className="h-3.5 w-3.5" /> Open chat</Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
