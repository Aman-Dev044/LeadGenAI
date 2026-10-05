'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MessageCircle, Save, CheckCircle2, XCircle, Image as ImageIcon, Trash2, Plus, Upload, Loader2, Link2, ClipboardList, Sparkles, Copy, RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/shared/loading';
import type { BookingForm, WhatsAppAiSettings, WhatsAppMedia, WhatsAppStatus } from '@/types';

function Section({ icon: Icon, title, description, children, footer }: { icon: any; title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
      {footer && <CardFooter className="justify-end border-t pt-4">{footer}</CardFooter>}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const FIELD_TYPES = ['text', 'number', 'date', 'choice', 'phone', 'email'];

const emptyForm = (): BookingForm => ({ key: '', name: '', description: '', fields: [{ key: '', label: '', type: 'text', required: true, options: [], hint: '' }], paymentLink: '', paymentNote: '', notifyUserId: '' });

export function WhatsAppSettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WhatsAppAiSettings | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState({ title: '', description: '', tags: '' });

  const { data, isLoading } = useQuery({ queryKey: ['whatsapp-settings'], queryFn: () => api.get<any>('/whatsapp/settings') });
  const { data: statusData, refetch: refetchStatus } = useQuery({ queryKey: ['whatsapp-status'], queryFn: () => api.get<any>('/whatsapp/status'), staleTime: 15_000 });
  const { data: mediaData } = useQuery({ queryKey: ['whatsapp-media'], queryFn: () => api.get<any>('/whatsapp/media') });
  const { data: usersData } = useQuery({ queryKey: ['users', 'assignable'], queryFn: () => api.get<any>('/users/assignable') });

  useEffect(() => {
    const s = (data as any)?.data || data;
    if (s && !form) setForm(s);
  }, [data, form]);

  const status: WhatsAppStatus | undefined = (statusData as any)?.data || statusData;
  const media: WhatsAppMedia[] = (mediaData as any)?.data || mediaData || [];
  const users: any[] = (usersData as any)?.data?.data || (usersData as any)?.data || [];

  const save = useMutation({
    mutationFn: (body: Partial<WhatsAppAiSettings>) => api.put('/whatsapp/settings', body),
    onSuccess: (res: any) => {
      setForm(res?.data || res);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] });
      toast.success('WhatsApp AI settings saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveAll = () => form && save.mutate(form);

  const configure = useMutation({
    mutationFn: () => api.post<any>('/whatsapp/configure-webhook'),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      r?.ok ? toast.success(r.message) : toast.error(r?.message || 'Could not set the webhook');
      refetchStatus();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadMedia = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', upload.title || file.name);
      fd.append('description', upload.description);
      fd.append('tags', upload.tags);
      return api.upload('/whatsapp/media', fd);
    },
    onSuccess: () => {
      toast.success('Added to the media library');
      setUpload({ title: '', description: '', tags: '' });
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['whatsapp-media'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMedia = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/media/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-media'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateMedia = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/whatsapp/media/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-media'] }),
  });

  if (isLoading || !form) return <Loading />;

  const set = <K extends keyof WhatsAppAiSettings>(k: K, v: WhatsAppAiSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setForms = (forms: BookingForm[]) => setForm((f) => (f ? { ...f, bookings: { ...f.bookings, forms } } : f));
  const updForm = (i: number, patch: Partial<BookingForm>) => setForms(form.bookings.forms.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast.success('Copied'));

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><MessageCircle className="h-5 w-5" /></span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Two-way WhatsApp AI</h3>
                {status?.sender?.configured ? (
                  status.sender.online === false ? <Badge variant="warning">Sender offline</Badge> : <Badge variant="success" dot>Sender {status.sender.number}</Badge>
                ) : (
                  <Badge variant="warning">Twilio WhatsApp not configured</Badge>
                )}
                {status?.sender?.configured && (status.sender.webhookMatches ? <Badge variant="success" dot>Webhook connected</Badge> : <Badge variant="destructive" dot>Webhook not set</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">
                Every message a lead sends to your WhatsApp number is answered by the AI with the full picture: what was said on the calls, meetings on the books, your knowledge base, your pictures and your booking forms. The AI can see pictures the customer sends, send pictures back, book meetings, call the lead, collect booking details and share the payment link. A teammate can take over any chat.
              </p>
              {status?.inboundUrl && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Twilio &quot;message comes in&quot; webhook:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{status.inboundUrl}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(status.inboundUrl)}><Copy className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchStatus()}><RefreshCw className="h-3.5 w-3.5" /> Check</Button>
            <Button variant="gradient" size="sm" onClick={() => configure.mutate()} disabled={configure.isPending || !status?.sender?.configured}>
              {configure.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Set webhook on Twilio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Section icon={Sparkles} title="How the AI chats" description="Persona, language and rules for replies on WhatsApp." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="AI replies on WhatsApp" hint="Off = messages are only logged and your team is notified.">
          <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </Row>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Agent name <span className="text-xs text-muted-foreground">(empty = calling agent)</span></Label>
            <Input value={form.agentName} onChange={(e) => set('agentName', e.target.value)} placeholder="Priya" />
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={form.language} onValueChange={(v) => set('language', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Match the customer</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi-en">Hinglish</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Wait before replying (seconds)</Label>
            <Input type="number" min={0} max={30} value={form.replyDelaySeconds} onChange={(e) => set('replyDelaySeconds', Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">Lets people finish typing 2-3 short lines.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>What you sell & how to talk</Label>
          <Textarea rows={5} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="We are a Goa travel agency. Packages from ₹25,000 per person for 4 nights. Always ask travel dates and number of people before quoting. Push for a video call with a travel expert. Never discount more than 10%." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="Use the knowledge base" hint="Answers come from your uploaded docs/FAQs.">
            <Switch checked={form.useKnowledgeBase} onCheckedChange={(v) => set('useKnowledgeBase', v)} />
          </Row>
          <Row label="Book meetings, callbacks & AI calls" hint="The AI can book a slot, fix a callback, or have the AI call right away.">
            <Switch checked={form.allowBooking} onCheckedChange={(v) => set('allowBooking', v)} />
          </Row>
          <Row label="Pause the AI once a human replies" hint="A teammate's reply in the dashboard takes the chat over.">
            <Switch checked={form.pauseWhenHuman} onCheckedChange={(v) => set('pauseWhenHuman', v)} />
          </Row>
          <div className="space-y-1.5">
            <Label>Hand to a human when the customer says <span className="text-xs text-muted-foreground">(comma separated)</span></Label>
            <Input value={form.handoffKeywords.join(', ')} onChange={(e) => set('handoffKeywords', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          </div>
        </div>
      </Section>

      <Section icon={ImageIcon} title="Media library - pictures the AI can send" description="Package photos, brochures, price lists, sample itineraries. Give each a clear title and description so the AI knows when to send it (e.g. 'Goa 4N/5D package - price list')." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="Send pictures when helpful" hint="JPG / PNG / WEBP / PDF, up to 5MB each.">
            <Switch checked={form.sendMedia} onCheckedChange={(v) => set('sendMedia', v)} />
          </Row>
          <div className="space-y-1.5">
            <Label>Max pictures per reply</Label>
            <Input type="number" min={0} max={5} value={form.maxMediaPerReply} onChange={(e) => set('maxMediaPerReply', Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Title (e.g. Goa package price list)" value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} />
            <Input placeholder="When to send it / what it shows" value={upload.description} onChange={(e) => setUpload({ ...upload, description: e.target.value })} />
            <Input placeholder="Tags (comma separated)" value={upload.tags} onChange={(e) => setUpload({ ...upload, tags: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-xs" />
            <Button size="sm" onClick={() => fileRef.current?.files?.[0] && uploadMedia.mutate(fileRef.current.files[0])} disabled={uploadMedia.isPending}>
              {uploadMedia.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
            </Button>
          </div>
        </div>
        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pictures yet. Upload the ones customers usually ask for.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((m) => (
              <div key={m._id} className="flex gap-3 rounded-lg border p-3">
                {m.mimeType?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">PDF</div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <Input className="h-7 text-xs" defaultValue={m.title} onBlur={(e) => e.target.value !== m.title && updateMedia.mutate({ id: m._id, body: { title: e.target.value } })} />
                  <Input className="h-7 text-xs" defaultValue={m.description} placeholder="When to send it" onBlur={(e) => e.target.value !== m.description && updateMedia.mutate({ id: m._id, body: { description: e.target.value } })} />
                  <p className="text-[10px] text-muted-foreground">Sent {m.sentCount || 0}x</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeMedia.mutate(m._id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={ClipboardList} title="Booking forms - what the AI collects before payment" description="When a customer wants to book (a flight, a hotel, a package, a demo kit), the AI asks for these details one by one, saves them, and then shares the payment link. Add one form per thing you sell." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Bookings on WhatsApp" hint="Submitted bookings appear under Bookings in the sidebar.">
          <Switch checked={form.bookings.enabled} onCheckedChange={(v) => setForm((f) => (f ? { ...f, bookings: { ...f.bookings, enabled: v } } : f))} />
        </Row>
        {form.bookings.forms.map((bf, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Form name</Label>
                  <Input value={bf.name} onChange={(e) => updForm(i, { name: e.target.value })} placeholder="Flight booking" />
                </div>
                <div className="space-y-1.5">
                  <Label>When to use it</Label>
                  <Input value={bf.description} onChange={(e) => updForm(i, { description: e.target.value })} placeholder="Customer wants to book a flight ticket" />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setForms(form.bookings.forms.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fields the AI must collect</Label>
              {bf.fields.map((fld, k) => (
                <div key={k} className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1.4fr_auto_auto] items-center">
                  <Input className="h-8" placeholder="Label (e.g. Travel date)" value={fld.label} onChange={(e) => updForm(i, { fields: bf.fields.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} />
                  <Select value={fld.type} onValueChange={(v) => updForm(i, { fields: bf.fields.map((x, m) => (m === k ? { ...x, type: v } : x)) })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="h-8" placeholder={fld.type === 'choice' ? 'Options: Economy, Business' : 'Hint for the AI (optional)'} value={fld.type === 'choice' ? fld.options.join(', ') : fld.hint} onChange={(e) => updForm(i, { fields: bf.fields.map((x, m) => (m === k ? (fld.type === 'choice' ? { ...x, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : { ...x, hint: e.target.value }) : x)) })} />
                  <label className="flex items-center gap-1 text-xs"><Switch checked={fld.required} onCheckedChange={(v) => updForm(i, { fields: bf.fields.map((x, m) => (m === k ? { ...x, required: v } : x)) })} /> req.</label>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => updForm(i, { fields: bf.fields.filter((_, m) => m !== k) })}><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => updForm(i, { fields: [...bf.fields, { key: '', label: '', type: 'text', required: true, options: [], hint: '' }] })}><Plus className="h-3.5 w-3.5" /> Add field</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payment link <span className="text-xs text-muted-foreground">(optional - sent automatically on submit)</span></Label>
                <Input value={bf.paymentLink} onChange={(e) => updForm(i, { paymentLink: e.target.value })} placeholder="https://rzp.io/l/yourpage?amount={{amount}}" />
                <p className="text-xs text-muted-foreground">Empty = your team adds the link from the Bookings page and it goes out then. Placeholders: {'{{amount}} {{leadName}} {{phone}}'} + any field key.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Payment note</Label>
                <Input value={bf.paymentNote} onChange={(e) => updForm(i, { paymentNote: e.target.value })} placeholder="UPI: travel@upi · link valid 24h" />
                <Label className="mt-2 block">Notify</Label>
                <Select value={bf.notifyUserId || 'owner'} onValueChange={(v) => updForm(i, { notifyUserId: v === 'owner' ? '' : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Lead owner / admins</SelectItem>
                    {users.map((u: any) => <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setForms([...form.bookings.forms, emptyForm()])}><Plus className="h-4 w-4" /> Add booking form</Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> The AI never asks for card numbers, OTPs or passwords - payment only happens on the link.</p>
      </Section>
    </div>
  );
}
