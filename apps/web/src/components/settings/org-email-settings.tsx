'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Save, Send, PlugZap, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type Field = { key: string; label: string; value?: string; preview?: string; configured?: boolean; usingPlatformDefault?: boolean };

const PRESETS: Record<string, { host: string; port: string; note: string }> = {
  gmail: { host: 'smtp.gmail.com', port: '587', note: 'Use a Google App Password, not your account password.' },
  outlook: { host: 'smtp.office365.com', port: '587', note: 'Works with Microsoft 365 / Outlook business accounts.' },
  zoho: { host: 'smtp.zoho.in', port: '587', note: 'Zoho Mail India. Use smtp.zoho.com outside India.' },
  ses: { host: 'email-smtp.ap-south-1.amazonaws.com', port: '587', note: 'Amazon SES SMTP credentials (not your AWS keys).' },
};

const empty = { host: '', port: '587', user: '', pass: '', fromEmail: '', fromName: '' };

/**
 * The workspace's own outgoing mail server. Once saved, every e-mail the
 * platform sends on this workspace's behalf - lead alerts, appointment
 * confirmations, post-call summaries, reminders - leaves from this address
 * instead of the platform's.
 */
export function OrgEmailSettings() {
  const queryClient = useQueryClient();
  const myEmail = useAuthStore((s) => s.user?.email) || '';
  const [form, setForm] = useState({ ...empty });
  const [loaded, setLoaded] = useState(false);
  const [testTo, setTestTo] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['credentials'], queryFn: () => api.get<any>('/credentials') });

  useEffect(() => {
    if (loaded) return;
    const providers = (data as any)?.data?.providers || (data as any)?.providers;
    if (!providers) return;
    const smtp = providers.find((p: any) => p.id === 'smtp');
    if (!smtp) return;
    const byKey: Record<string, Field> = Object.fromEntries(smtp.fields.map((f: Field) => [f.key, f]));
    setForm({
      host: byKey.host?.usingPlatformDefault ? '' : byKey.host?.value || '',
      port: byKey.port?.usingPlatformDefault ? '587' : String(byKey.port?.value || '587'),
      user: byKey.user?.usingPlatformDefault ? '' : byKey.user?.value || '',
      pass: '',
      fromEmail: byKey.fromEmail?.usingPlatformDefault ? '' : byKey.fromEmail?.value || '',
      fromName: byKey.fromName?.usingPlatformDefault ? '' : byKey.fromName?.value || '',
    });
    setLoaded(true);
  }, [data, loaded]);

  useEffect(() => {
    if (!testTo && myEmail) setTestTo(myEmail);
  }, [myEmail, testTo]);

  const providers = (data as any)?.data?.providers || (data as any)?.providers || [];
  const smtp = providers.find((p: any) => p.id === 'smtp');
  const hostField: Field | undefined = smtp?.fields?.find((f: Field) => f.key === 'host');
  const passField: Field | undefined = smtp?.fields?.find((f: Field) => f.key === 'pass');
  const usingOwn = !!hostField?.configured && !hostField?.usingPlatformDefault;

  const save = useMutation({
    mutationFn: () =>
      api.put('/credentials/smtp', {
        values: {
          host: form.host.trim(),
          port: form.port.trim(),
          user: form.user.trim(),
          // Blank leaves the stored password untouched
          ...(form.pass ? { pass: form.pass } : {}),
          fromEmail: form.fromEmail.trim(),
          fromName: form.fromName.trim(),
        },
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, pass: '' }));
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Email settings saved — your mail now goes out from this address');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => api.post<any>('/credentials/smtp/test'),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      r?.ok ? toast.success(r.message || 'Connected') : toast.error(r?.message || 'Could not connect');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: () => api.post<any>('/credentials/smtp/send-test', { to: testTo.trim() }),
    onSuccess: (res: any) => {
      const r = res?.data || res;
      r?.ok ? toast.success(r.message) : toast.error(r?.message || 'Could not send');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => api.delete('/credentials/smtp'),
    onSuccess: () => {
      setForm({ ...empty });
      setLoaded(false);
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Removed — mail goes out from the platform address again');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyPreset = (k: string) => setForm((f) => ({ ...f, host: PRESETS[k].host, port: PRESETS[k].port }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Email sending
            {usingOwn ? (
              <Badge variant="success" dot>Your own address</Badge>
            ) : (
              <Badge variant="secondary">Platform default</Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-0.5">
            Your own mail server for everything this workspace sends — lead alerts, appointment confirmations, post-call
            summaries and reminders all arrive from your address instead of ours.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick fill:</span>
              {Object.keys(PRESETS).map((k) => (
                <Button key={k} type="button" variant="outline" size="sm" className="h-7 capitalize" onClick={() => applyPreset(k)}>
                  {k === 'ses' ? 'Amazon SES' : k}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP host</Label>
                <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="587" />
                <p className="text-xs text-muted-foreground">587 for STARTTLS, 465 for TLS.</p>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="you@yourdomain.com" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  placeholder={passField?.preview ? `${passField.preview} — leave blank to keep` : 'App password'}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Gmail needs an App Password, not your account password.</p>
              </div>
              <div className="space-y-2">
                <Label>From address</Label>
                <Input value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="hello@yourdomain.com" />
                <p className="text-xs text-muted-foreground">What your customers see as the sender.</p>
              </div>
              <div className="space-y-2">
                <Label>From name</Label>
                <Input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="Cyberbells Travels" />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                {usingOwn ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>
                      Mail for this workspace goes out through <strong>{hostField?.value || form.host}</strong>. Send yourself a test to
                      see exactly what your customers will see.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>No mail server saved yet, so e-mails still go out from the platform address. Fill the fields above and save.</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-9 max-w-[280px]" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@yourdomain.com" />
                <Button variant="outline" size="sm" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !testTo.trim()}>
                  {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test email
                </Button>
                <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />} Test connection
                </Button>
                {usingOwn && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => clear.mutate()} disabled={clear.isPending}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="justify-end border-t bg-muted/30 py-3 mt-2 rounded-b-xl">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.host.trim()}>
          <Save className="h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save email settings'}
        </Button>
      </CardFooter>
    </Card>
  );
}
