'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bot, PhoneCall, Clock, MessageCircle, Flame, AlertTriangle, Repeat, Mic, Save, CheckCircle2, XCircle, ExternalLink, Sparkles, Loader2, Info, BellRing,
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
import { cn } from '@/lib/utils';
import type { CallingReadiness, CallingSettings } from '@/types';
import { CallPlaybooksEditor } from '@/components/settings/call-playbooks';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_REMINDERS: CallingSettings['appointmentReminders'] = {
  enabled: true, dayBefore: true, hourBefore: true, minutesBefore: 60, remindSalesperson: true,
  noShowRescue: { enabled: true, askAfterMinutes: 20, autoMarkAfterMinutes: 90, whatsapp: true, aiCall: true, callDelayMinutes: 30 },
};
const VOICES = [
  { value: 'Neha', label: 'Neha — Indian English / Hinglish (female) ★ recommended' },
  { value: 'Naina', label: 'Naina — Indian English / Hinglish (female)' },
  { value: 'Rohan', label: 'Rohan — Indian English / Hinglish (male)' },
  { value: 'Sagar', label: 'Sagar — Indian English (male)' },
  { value: 'Paige', label: 'Paige — US English (female)' },
  { value: 'Elliot', label: 'Elliot — US English (male)' },
  { value: 'Lily', label: 'Lily — UK English (female)' },
  { value: 'Harry', label: 'Harry — UK English (male)' },
];

function Section({ icon: Icon, title, description, children, footer }: { icon: any; title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
      {footer && <CardFooter className="justify-end border-t pt-4">{footer}</CardFooter>}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function CallingSettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CallingSettings | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testName, setTestName] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['calling-settings'], queryFn: () => api.get<any>('/calling/settings') });
  const { data: readinessData, refetch: refetchReadiness } = useQuery({ queryKey: ['calling-readiness'], queryFn: () => api.get<any>('/calling/readiness') });
  const readiness: CallingReadiness | undefined = readinessData?.data;

  useEffect(() => {
    if (data?.data && !form) setForm(data.data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (settings: Partial<CallingSettings>) => api.put('/calling/settings', { settings }),
    onSuccess: (res: any) => {
      setForm(res?.data || null);
      queryClient.invalidateQueries({ queryKey: ['calling-settings'] });
      refetchReadiness();
      toast.success('AI calling settings saved');
    },
    onError: (err: any) => toast.error(err.message || 'Could not save'),
  });

  const test = useMutation({
    mutationFn: () => api.post('/calling/test-call', { phone: testPhone.trim(), name: testName.trim() || undefined }),
    onSuccess: () => toast.success('Test call placed — your phone should ring in a few seconds'),
    onError: (err: any) => toast.error(err.message || 'Test call failed'),
  });

  if (isLoading || !form) return <Loading label="Loading calling settings" />;

  const set = <K extends keyof CallingSettings>(key: K, value: CallingSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setA = <K extends keyof CallingSettings['assistant']>(key: K, value: CallingSettings['assistant'][K]) =>
    setForm((f) => (f ? { ...f, assistant: { ...f.assistant, [key]: value } } : f));
  const setHours = (patch: Partial<CallingSettings['callingHours']>) => setForm((f) => (f ? { ...f, callingHours: { ...f.callingHours, ...patch } } : f));
  const toggleDay = (d: number) => setHours({ days: form.callingHours.days.includes(d) ? form.callingHours.days.filter((x) => x !== d) : [...form.callingHours.days, d].sort() });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  const saveAll = () => save.mutate(form);

  return (
    <div className="space-y-6">
      {/* Readiness */}
      <Card className={cn('border', readiness?.aiCalling.configured && form.enabled ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-amber-500/30 bg-amber-500/[0.05]')}>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" /> AI calling is {form.enabled ? 'ON' : 'OFF'}
              {readiness && <Badge variant={readiness.aiCalling.configured ? 'success' : 'warning'}>{readiness.aiCalling.configured ? 'Vapi connected' : 'Vapi not configured'}</Badge>}
              {readiness && <Badge variant={readiness.humanCalling.configured ? 'success' : 'secondary'}>{readiness.humanCalling.configured ? 'Twilio connected' : 'Twilio not set'}</Badge>}
              {readiness && <Badge variant={readiness.whatsapp.configured ? 'success' : 'secondary'}>{readiness.whatsapp.configured ? 'WhatsApp ready' : 'WhatsApp not set'}</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              Keys live under <Link href="/dashboard/settings/credentials" className="font-medium underline underline-offset-2">API Credentials</Link>. Reports arrive at <code className="rounded bg-muted px-1">{readiness?.webhookUrl}</code>
              {readiness && !readiness.webhookReachable && <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">— not public; set PUBLIC_API_URL (ngrok in dev).</span>}
              {readiness && <span> · {readiness.withinCallingHours ? 'inside' : 'outside'} calling hours now ({readiness.timezone})</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="calling-enabled" className="text-sm">Enable AI calling</Label>
            <Switch id="calling-enabled" checked={form.enabled} onCheckedChange={(v) => { set('enabled', v); save.mutate({ ...form, enabled: v }); }} />
          </div>
        </CardContent>
      </Card>

      {/* Assistant */}
      <Section icon={Mic} title="The AI agent" description="Who calls your leads, in which language, and what it says." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Agent name</Label>
            <Input value={form.assistant.agentName} onChange={(e) => setA('agentName', e.target.value)} placeholder="Priya" />
          </div>
          <div className="space-y-1.5">
            <Label>Company name <span className="text-xs text-muted-foreground">(how the agent says it)</span></Label>
            <Input value={form.assistant.companyName} onChange={(e) => setA('companyName', e.target.value)} placeholder="Cyberbells" />
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={form.assistant.language} onValueChange={(v) => setA('language', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hi-en">Hinglish (Hindi + English)</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Voice</Label>
            <Select value={form.assistant.voiceId} onValueChange={(v) => setA('voiceId', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VOICES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>What you sell <span className="text-xs text-muted-foreground">(the agent's pitch context)</span></Label>
          <Textarea rows={3} value={form.assistant.offerSummary} onChange={(e) => setA('offerSummary', e.target.value)} placeholder="We build websites, mobile apps and CRM software for small businesses in India. Typical projects start at ₹25,000 and take 2-6 weeks." />
        </div>
        <div className="space-y-1.5">
          <Label>Opening line <span className="text-xs text-muted-foreground">— placeholders: {'{{leadName}} {{agentName}} {{companyName}}'}</span></Label>
          <Textarea rows={2} value={form.assistant.firstMessage} onChange={(e) => setA('firstMessage', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Questions the agent must get answered <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <Textarea rows={4} value={form.assistant.qualificationQuestions.join('\n')} onChange={(e) => setA('qualificationQuestions', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />
        </div>
        <div className="space-y-1.5">
          <Label>Extra instructions <span className="text-xs text-muted-foreground">(tone, objections, things never to say)</span></Label>
          <Textarea rows={3} value={form.assistant.extraInstructions} onChange={(e) => setA('extraInstructions', e.target.value)} placeholder="Never quote a final price. If they ask for a discount, say the sales team can discuss it. Mention we have a free 30-minute consultation." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>LLM model behind the voice</Label>
            <Select value={form.assistant.llmModel} onValueChange={(v) => setA('llmModel', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o mini (fast, cheap)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o (smarter)</SelectItem>
                <SelectItem value="gpt-4.1-mini">GPT-4.1 mini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Max call length (seconds)</Label>
            <Input type="number" min={60} max={1800} value={form.assistant.maxDurationSeconds} onChange={(e) => setA('maxDurationSeconds', num(e.target.value))} />
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-muted/30 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Hear it yourself</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Your number</Label>
              <Input className="w-[200px]" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name to use</Label>
              <Input className="w-[160px]" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Aman" />
            </div>
            <Button variant="outline" onClick={() => test.mutate()} disabled={!testPhone.trim() || test.isPending || !readiness?.aiCalling.configured}>
              {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />} Test call me
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Save first — the test uses the saved script. Costs a normal call.</p>
        </div>
      </Section>

      {/* When & how */}
      <Section icon={Clock} title="When the AI calls" description="New-lead timing, calling hours in your timezone, retries and concurrency." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Call every new lead automatically" hint="Any lead with a phone number, from anywhere — manual, Excel/CSV, widget chat, API, AI Automation, Leads Scrap AI. Dialled within seconds.">
          <Switch checked={form.autoCallOnNewLead} onCheckedChange={(v) => set('autoCallOnNewLead', v)} />
        </Row>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Delay before first call (seconds)</Label>
            <Input type="number" min={0} value={form.firstCallDelaySeconds} onChange={(e) => set('firstCallDelaySeconds', num(e.target.value))} />
            <p className="text-xs text-muted-foreground">0 = call the moment the lead lands.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Only these sources <span className="text-xs text-muted-foreground">(comma, empty = all)</span></Label>
            <Input value={form.autoCallSources.join(', ')} onChange={(e) => set('autoCallSources', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="manual, import, widget" />
          </div>
          <div className="space-y-1.5">
            <Label>Calls at the same time</Label>
            <Input type="number" min={1} max={20} value={form.maxConcurrentCalls} onChange={(e) => set('maxConcurrentCalls', num(e.target.value))} />
            <p className="text-xs text-muted-foreground">1 = strictly one by one: the next lead is dialled the moment the current call ends.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Calling hours <span className="text-xs text-muted-foreground">({form.timezone || 'Asia/Kolkata'} — change under AI & Preferences)</span></Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input type="time" className="w-[130px]" value={form.callingHours.start} onChange={(e) => setHours({ start: e.target.value })} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="time" className="w-[130px]" value={form.callingHours.end} onChange={(e) => setHours({ end: e.target.value })} />
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => toggleDay(i)} className={cn('h-8 w-10 rounded-md border text-xs font-medium transition-colors', form.callingHours.days.includes(i) ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}>{d}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Attempts before giving up</Label>
            <Input type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => set('maxAttempts', num(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Wait between attempts (minutes)</Label>
            <Input type="number" min={5} value={form.retryDelayMinutes} onChange={(e) => set('retryDelayMinutes', num(e.target.value))} />
          </div>
        </div>
      </Section>

      {/* No answer */}
      <Section icon={MessageCircle} title="If nobody answers" description="WhatsApp goes out after an unanswered attempt, then the AI retries." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Send a WhatsApp after a missed call" hint={readiness && !readiness.whatsapp.configured ? 'Needs a Twilio WhatsApp number under API Credentials.' : 'One message per unanswered attempt.'}>
          <Switch checked={form.whatsappOnNoAnswer} onCheckedChange={(v) => set('whatsappOnNoAnswer', v)} />
        </Row>
        <div className="space-y-1.5">
          <Label>Message <span className="text-xs text-muted-foreground">— {'{{leadName}} {{agentName}} {{companyName}}'}</span></Label>
          <Textarea rows={3} value={form.whatsappNoAnswerTemplate} onChange={(e) => set('whatsappNoAnswerTemplate', e.target.value)} />
        </div>
      </Section>

      {/* After the call: WhatsApp */}
      <Section icon={MessageCircle} title="WhatsApp after every AI call" description="Right after an answered call the lead gets a thank-you on WhatsApp — with the meeting date, time and who they will meet when one was booked, or the agreed callback time." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Send WhatsApp after every answered AI call" hint={readiness && !readiness.whatsapp.configured ? 'Needs a Twilio WhatsApp sender under API Credentials.' : 'Skipped for wrong numbers and unanswered calls.'}>
          <Switch checked={form.postCallWhatsapp.enabled} onCheckedChange={(v) => setForm((f) => (f ? { ...f, postCallWhatsapp: { ...f.postCallWhatsapp, enabled: v } } : f))} />
        </Row>
        <p className="text-xs text-muted-foreground">Placeholders: {'{{leadName}} {{agentName}} {{companyName}} {{summary}} {{meetingDate}} {{meetingTime}} {{salespersonName}} {{salespersonPhone}} {{callbackDate}} {{callbackTime}}'}</p>
        <div className="space-y-1.5">
          <Label>Thank-you message</Label>
          <Textarea rows={4} value={form.postCallWhatsapp.thankYouTemplate} onChange={(e) => setForm((f) => (f ? { ...f, postCallWhatsapp: { ...f.postCallWhatsapp, thankYouTemplate: e.target.value } } : f))} />
        </div>
        <div className="space-y-1.5">
          <Label>When a meeting was booked</Label>
          <Textarea rows={6} value={form.postCallWhatsapp.appointmentTemplate} onChange={(e) => setForm((f) => (f ? { ...f, postCallWhatsapp: { ...f.postCallWhatsapp, appointmentTemplate: e.target.value } } : f))} />
        </div>
        <div className="space-y-1.5">
          <Label>When a callback was agreed</Label>
          <Textarea rows={3} value={form.postCallWhatsapp.callbackTemplate} onChange={(e) => setForm((f) => (f ? { ...f, postCallWhatsapp: { ...f.postCallWhatsapp, callbackTemplate: e.target.value } } : f))} />
        </div>
      </Section>

      {/* Hot leads & follow-ups */}
      <Section icon={Flame} title="Hot leads & follow-ups" description="When a lead is hot, who gets it, and how fast the team must act." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Hot when interest ≥</Label>
            <Input type="number" min={1} max={100} value={form.hotThreshold} onChange={(e) => set('hotThreshold', num(e.target.value))} />
            <p className="text-xs text-muted-foreground">0-100 from the call analysis. Hot leads are auto-assigned (Settings › Assignment rules) and the owner is alerted.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Hot lead must be called within (hours)</Label>
            <Input type="number" min={0.25} step={0.25} value={form.hotFollowUpHours} onChange={(e) => set('hotFollowUpHours', Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Alert admins when overdue by (hours)</Label>
            <Input type="number" min={0.5} step={0.5} value={form.overdueAlertHours} onChange={(e) => set('overdueAlertHours', Number(e.target.value))} />
          </div>
        </div>
        <Row label="Record & transcribe salesperson calls" hint="Calls placed with “Call via LeadBells” are recorded through Twilio and read by the AI.">
          <Switch checked={form.recordHumanCalls} onCheckedChange={(v) => set('recordHumanCalls', v)} />
        </Row>
      </Section>

      {/* Playbooks */}
      <Section icon={Sparkles} title="Playbooks — different leads, different behaviour" description="The AI already adapts to each lead's stage, history and description. Playbooks let you go further: a specific script, tone, language or opening for a kind of lead. First match wins." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <CallPlaybooksEditor value={form.playbooks || []} onChange={(v) => set('playbooks', v)} />
      </Section>

      {/* Live transfer + in-call booking */}
      <Section icon={PhoneCall} title="Transfer to a human & in-call booking" description="What the AI can do while still on the phone: hand the call to a person, book a meeting, or fix a callback time." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Allow live transfer to a human" hint="The AI announces the transfer, then the call is connected to the number below (or the lead's own salesperson).">
          <Switch checked={form.transfer.enabled} onCheckedChange={(v) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, enabled: v } } : f))} />
        </Row>
        <div className="space-y-2">
          <Label>People / departments the AI can transfer to</Label>
          <p className="text-xs text-muted-foreground">Give each a name and what they handle — the AI picks the right one and tells the caller who it is connecting them to.</p>
          <div className="space-y-2">
            {form.transfer.destinations.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-xl border bg-muted/30 p-2 sm:grid-cols-[1fr_1.1fr_1.6fr_auto]">
                <Input value={d.name} placeholder="Rahul" onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, destinations: f.transfer.destinations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } } : f))} />
                <Input value={d.number} placeholder="+91 98765 43210" onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, destinations: f.transfer.destinations.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)) } } : f))} />
                <Input value={d.description} placeholder="Sales - pricing & new projects" onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, destinations: f.transfer.destinations.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) } } : f))} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-rose-600" onClick={() => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, destinations: f.transfer.destinations.filter((_, j) => j !== i) } } : f))} aria-label="Remove"><XCircle className="h-4 w-4" /></Button>
              </div>
            ))}
            {form.transfer.destinations.length < 10 && (
              <Button variant="outline" size="sm" onClick={() => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, destinations: [...f.transfer.destinations, { name: '', number: '', description: '' }] } } : f))}>+ Add person</Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fallback transfer number <span className="text-xs text-muted-foreground">(if none of the above fit)</span></Label>
            <Input value={form.transfer.number} onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, number: e.target.value } } : f))} placeholder="+91 98765 43210" />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3 sm:mt-6">
            <div>
              <p className="text-sm font-medium">Try the lead's salesperson first</p>
              <p className="text-xs text-muted-foreground">Uses the phone on their profile</p>
            </div>
            <Switch checked={form.transfer.preferAssignedSalesperson} onCheckedChange={(v) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, preferAssignedSalesperson: v } } : f))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>What the AI says before transferring</Label>
          <Input value={form.transfer.message} onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, message: e.target.value } } : f))} />
        </div>
        <div className="space-y-1.5">
          <Label>When to transfer</Label>
          <Textarea rows={2} value={form.transfer.instructions} onChange={(e) => setForm((f) => (f ? { ...f, transfer: { ...f.transfer, instructions: e.target.value } } : f))} />
        </div>
        <Row label="Book meetings & callbacks during the call" hint="The AI confirms a date/time with the person and books it into Appointments + the owner's follow-ups on the spot.">
          <Switch checked={form.inCallBooking.enabled} onCheckedChange={(v) => setForm((f) => (f ? { ...f, inCallBooking: { ...f.inCallBooking, enabled: v } } : f))} />
        </Row>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Meeting length (minutes)</Label>
            <Input type="number" min={10} max={240} value={form.inCallBooking.meetingDurationMinutes} onChange={(e) => setForm((f) => (f ? { ...f, inCallBooking: { ...f.inCallBooking, meetingDurationMinutes: num(e.target.value) } } : f))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking rules <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input value={form.inCallBooking.instructions} onChange={(e) => setForm((f) => (f ? { ...f, inCallBooking: { ...f.inCallBooking, instructions: e.target.value } } : f))} placeholder="Meetings Mon-Sat 11am-6pm only, at our Chandigarh office or on Google Meet" />
          </div>
        </div>
      </Section>

      {/* Meeting reminders + no-show rescue */}
      <Section icon={BellRing} title="Meeting reminders & no-show rescue" description="Booked meetings are not forgotten: the lead is reminded on WhatsApp (and e-mail), the salesperson gets a nudge, and when the lead does not turn up the AI calls to fix a new time. Meetings land in each salesperson's Google Calendar once they connect it on the Appointments page." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        {(() => {
          // Older API builds answer without this block - fall back to the defaults so the page never crashes
          const r: CallingSettings['appointmentReminders'] = {
            ...DEFAULT_REMINDERS,
            ...(form.appointmentReminders || {}),
            noShowRescue: { ...DEFAULT_REMINDERS.noShowRescue, ...(form.appointmentReminders?.noShowRescue || {}) },
          };
          const setR = (patch: Partial<typeof r>) => setForm((f) => (f ? { ...f, appointmentReminders: { ...r, ...patch } } : f));
          const setNs = (patch: Partial<typeof r.noShowRescue>) => setForm((f) => (f ? { ...f, appointmentReminders: { ...r, noShowRescue: { ...r.noShowRescue, ...patch } } } : f));
          return (
            <>
              <Row label="Reminders on" hint={readiness && !readiness.whatsapp.configured ? 'Needs a Twilio WhatsApp sender under API Credentials.' : 'Sent only for meetings that are still scheduled.'}>
                <Switch checked={r.enabled} onCheckedChange={(v) => setR({ enabled: v })} />
              </Row>
              <div className="grid gap-4 sm:grid-cols-3">
                <Row label="Day before" hint="WhatsApp + e-mail with date, time, who they will meet.">
                  <Switch checked={r.dayBefore} onCheckedChange={(v) => setR({ dayBefore: v })} />
                </Row>
                <Row label="Shortly before" hint="A short WhatsApp ping.">
                  <Switch checked={r.hourBefore} onCheckedChange={(v) => setR({ hourBefore: v })} />
                </Row>
                <div className="space-y-1.5">
                  <Label>Minutes before the meeting</Label>
                  <Input type="number" min={10} max={720} value={r.minutesBefore} onChange={(e) => setR({ minutesBefore: num(e.target.value) })} />
                </div>
              </div>
              <Row label="Nudge the salesperson too" hint="In-app + push shortly before, and “did the meeting happen?” afterwards.">
                <Switch checked={r.remindSalesperson} onCheckedChange={(v) => setR({ remindSalesperson: v })} />
              </Row>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <Row label="No-show rescue" hint="When the lead does not turn up: a “we missed you” WhatsApp and an AI call to agree a new time. The AI moves the meeting itself.">
                  <Switch checked={r.noShowRescue.enabled} onCheckedChange={(v) => setNs({ enabled: v })} />
                </Row>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Ask the salesperson after (minutes)</Label>
                    <Input type="number" min={5} max={720} value={r.noShowRescue.askAfterMinutes} onChange={(e) => setNs({ askAfterMinutes: num(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">“Did the meeting with X happen? Mark done / no-show.”</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Auto no-show after (minutes)</Label>
                    <Input type="number" min={0} max={1440} value={r.noShowRescue.autoMarkAfterMinutes} onChange={(e) => setNs({ autoMarkAfterMinutes: num(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">Still unmarked after this → treated as a no-show. 0 = only when marked by the team.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>AI calls after (minutes)</Label>
                    <Input type="number" min={0} max={1440} value={r.noShowRescue.callDelayMinutes} onChange={(e) => setNs({ callDelayMinutes: num(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">Within calling hours; the WhatsApp goes out at once.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Row label="WhatsApp “we missed you”" hint="Uses the missed-meeting template.">
                    <Switch checked={r.noShowRescue.whatsapp} onCheckedChange={(v) => setNs({ whatsapp: v })} />
                  </Row>
                  <Row label="AI reschedule call" hint="Off = a high-priority task for the salesperson instead.">
                    <Switch checked={r.noShowRescue.aiCall} onCheckedChange={(v) => setNs({ aiCall: v })} />
                  </Row>
                </div>
              </div>
            </>
          );
        })()}
      </Section>

      {/* Re-engagement */}
      <Section icon={Repeat} title="Cold leads" description="Leads that go quiet get another touch from the AI, automatically." footer={<Button onClick={saveAll} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>}>
        <Row label="Re-engage cold leads" hint="Contacted / interested / follow-up leads with no activity for the period below.">
          <Switch checked={form.reengageEnabled} onCheckedChange={(v) => set('reengageEnabled', v)} />
        </Row>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Cold after (days without activity)</Label>
            <Input type="number" min={1} max={90} value={form.coldAfterDays} onChange={(e) => set('coldAfterDays', num(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>How</Label>
            <Select value={form.reengageChannel} onValueChange={(v) => set('reengageChannel', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">WhatsApp first, AI call 3h later</SelectItem>
                <SelectItem value="ai_call">AI call only</SelectItem>
                <SelectItem value="whatsapp">WhatsApp only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Max re-engagements per lead</Label>
            <Input type="number" min={0} max={10} value={form.maxReengageAttempts} onChange={(e) => set('maxReengageAttempts', num(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Re-engagement WhatsApp</Label>
          <Textarea rows={3} value={form.reengageWhatsappTemplate} onChange={(e) => set('reengageWhatsappTemplate', e.target.value)} />
        </div>
      </Section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Flow: lead added → AI calls → no answer? WhatsApp + retry → interested? qualified, hot leads assigned to a salesperson with a follow-up task → salesperson calls (recorded &amp; transcribed) → AI plans the next step → overdue follow-ups alert admins → cold leads re-engaged. Won / Lost stops everything.
      </p>
    </div>
  );
}
