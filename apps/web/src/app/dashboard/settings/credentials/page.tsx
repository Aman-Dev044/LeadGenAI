'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  KeyRound, ArrowLeft, ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck,
  Loader2, RotateCcw, Save, Plug, Bot, Radio, MessageSquare, HardDrive, PhoneCall,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { TableSkeleton } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { formatDate, cn } from '@/lib/utils';

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'email' | 'select';
  secret?: boolean;
  placeholder?: string;
  help?: string;
  envKey?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  configured: boolean;
  usingPlatformDefault: boolean;
  /** Secrets only: a mask, never the value. */
  preview?: string;
  /** Non-secrets only. */
  value?: string;
}

interface CredentialProvider {
  id: string;
  label: string;
  category: 'ai' | 'calling' | 'prospecting' | 'messaging' | 'storage';
  description: string;
  docsUrl?: string;
  note?: string;
  testable: boolean;
  configured: boolean;
  usingPlatformDefaults: boolean;
  updatedAt?: string;
  updatedBy?: string;
  lastTest?: { ok?: boolean; message?: string; checkedAt?: string } | null;
  fields: CredentialField[];
}

const CATEGORIES: { id: CredentialProvider['category']; label: string; icon: any; blurb: string }[] = [
  { id: 'ai', label: 'AI', icon: Bot, blurb: 'The model behind chat replies, scoring and every AI feature.' },
  { id: 'calling', label: 'AI calling', icon: PhoneCall, blurb: 'The voice agent that phones and qualifies every new lead.' },
  { id: 'prospecting', label: 'Lead sources', icon: Radio, blurb: 'Where Leads Scrap AI and AI Automation look for prospects.' },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare, blurb: 'How email, SMS and WhatsApp leave the platform.' },
  { id: 'storage', label: 'Storage', icon: HardDrive, blurb: 'Where uploaded files are kept.' },
];

export default function ApiCredentialsPage() {
  const queryClient = useQueryClient();
  const needsWorkspace = useWorkspaceRequired();

  /** Pending edits per provider. Secrets stay blank until deliberately retyped. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => api.get<any>('/credentials'),
    enabled: !needsWorkspace,
  });
  const providers: CredentialProvider[] = data?.data?.providers || data?.providers || [];

  // Seed the non-secret inputs once the server state arrives.
  useEffect(() => {
    if (!providers.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of providers) {
        if (next[p.id]) continue;
        const seeded: Record<string, string> = {};
        for (const f of p.fields) {
          if (!f.secret) seeded[f.key] = f.value ?? '';
        }
        next[p.id] = seeded;
      }
      return next;
    });
  }, [providers]);

  const setField = (providerId: string, key: string, value: string) =>
    setDrafts((d) => ({ ...d, [providerId]: { ...(d[providerId] || {}), [key]: value } }));

  const saveMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) =>
      api.put(`/credentials/${id}`, { values }),
    onSuccess: (_res, vars) => {
      // Clear typed secrets from memory the moment they are stored.
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.invalidateQueries({ queryKey: ['leads-scrap-ai-sources'] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-sources'] });
      toast.success('Saved');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not save'),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/credentials/${id}`),
    onSuccess: (_res, id) => {
      setDrafts((d) => {
        const next = { ...d };
        delete next[id as string];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Reset to platform defaults');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not reset'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post<any>(`/credentials/${id}/test`, {}),
    onSuccess: (res: any) => {
      const result = res?.data || res;
      if (result?.ok) toast.success(result.message || 'Connection works');
      else toast.error(result?.message || 'Connection failed');
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Test failed'),
    onSettled: () => setTesting(null),
  });

  const grouped = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        providers: providers.filter((p) => p.category === c.id),
      })).filter((c) => c.providers.length > 0),
    [providers],
  );

  return (
    <div>
      <Link
        href="/dashboard/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>

      <PageHeader
        icon={KeyRound}
        eyebrow="Admin only"
        title="API Credentials"
        description="Point each integration at your own accounts. Keys are encrypted before they are stored and are never sent back to the browser - you can replace one, but nobody can read it again."
      />

      {needsWorkspace ? (
        <WorkspaceRequiredNotice feature="API credentials" />
      ) : (
        <>
          <Card className="mb-6 flex items-start gap-3 border-emerald-500/30 bg-emerald-500/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <p className="font-semibold">How your keys are protected</p>
              <ul className="mt-1.5 space-y-1 text-muted-foreground">
                <li>Encrypted with AES-256-GCM before they touch the database.</li>
                <li>
                  Write-only: the server never returns a saved key, so it cannot be recovered from this
                  page, the network tab or the page source - only the last few characters are shown.
                </li>
                <li>Each workspace uses its own keys and its own quota. Leave a field empty to keep using the platform default.</li>
              </ul>
            </div>
          </Card>

          {isLoading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : (
            <div className="space-y-10">
              {grouped.map((category) => (
                <section key={category.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <category.icon className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide">{category.label}</h2>
                    <span className="text-xs text-muted-foreground">· {category.blurb}</span>
                  </div>

                  <div className="space-y-4">
                    {category.providers.map((provider) => {
                      const draft = drafts[provider.id] || {};
                      const isSaving = saveMutation.isPending && saveMutation.variables?.id === provider.id;

                      return (
                        <Card key={provider.id} className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{provider.label}</h3>
                                {provider.configured ? (
                                  provider.usingPlatformDefaults ? (
                                    <Badge variant="info" dot>Platform default</Badge>
                                  ) : (
                                    <Badge variant="success" dot>Your key</Badge>
                                  )
                                ) : (
                                  <Badge variant="warning" dot>Not configured</Badge>
                                )}
                                {provider.lastTest?.checkedAt && (
                                  <Badge variant={provider.lastTest.ok ? 'success' : 'destructive'}>
                                    {provider.lastTest.ok ? 'Test passed' : 'Test failed'}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                                {provider.description}
                              </p>
                              {provider.note && (
                                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  {provider.note}
                                </p>
                              )}
                            </div>
                            {provider.docsUrl && (
                              <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                  Get key
                                </Button>
                              </a>
                            )}
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {provider.fields.map((field) => {
                              const inputId = `${provider.id}-${field.key}`;
                              const value = draft[field.key] ?? '';

                              return (
                                <div key={field.key}>
                                  <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor={inputId} className="text-xs">
                                      {field.label}
                                    </Label>
                                    {field.secret && field.preview && (
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {field.preview}
                                      </span>
                                    )}
                                  </div>

                                  {field.type === 'select' ? (
                                    <Select
                                      value={value || field.options?.[0]?.value || ''}
                                      onValueChange={(v) => setField(provider.id, field.key, v)}
                                    >
                                      <SelectTrigger id={inputId}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(field.options || []).map((o) => (
                                          <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      id={inputId}
                                      // A saved secret is never placed in the DOM, so there is
                                      // nothing here to read, copy or inspect.
                                      type={field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'}
                                      value={value}
                                      min={field.min}
                                      max={field.max}
                                      autoComplete={field.secret ? 'new-password' : 'off'}
                                      spellCheck={false}
                                      placeholder={
                                        field.secret && field.configured
                                          ? 'Saved - type to replace'
                                          : field.placeholder || ''
                                      }
                                      onChange={(e) => setField(provider.id, field.key, e.target.value)}
                                    />
                                  )}

                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {field.help && (
                                      <p className="text-[11px] text-muted-foreground">{field.help}</p>
                                    )}
                                    {field.usingPlatformDefault && (
                                      <span className="text-[11px] text-sky-600 dark:text-sky-400">
                                        Using platform default
                                      </span>
                                    )}
                                    {field.secret && field.configured && !field.usingPlatformDefault && (
                                      <button
                                        type="button"
                                        onClick={() => setField(provider.id, field.key, '__clear__')}
                                        className={cn(
                                          'text-[11px] hover:underline',
                                          value === '__clear__'
                                            ? 'font-semibold text-rose-600 dark:text-rose-400'
                                            : 'text-muted-foreground',
                                        )}
                                      >
                                        {value === '__clear__' ? 'Will be removed on save' : 'Remove key'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                            <Button
                              size="sm"
                              onClick={() => saveMutation.mutate({ id: provider.id, values: draft })}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Save
                            </Button>

                            {provider.testable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTesting(provider.id);
                                  testMutation.mutate(provider.id);
                                }}
                                disabled={testing === provider.id}
                              >
                                {testing === provider.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Test connection
                              </Button>
                            )}

                            {!provider.usingPlatformDefaults && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => resetMutation.mutate(provider.id)}
                                disabled={resetMutation.isPending}
                              >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                Reset to platform default
                              </Button>
                            )}

                            <div className="ml-auto text-right text-[11px] text-muted-foreground">
                              {provider.lastTest?.checkedAt && (
                                <p
                                  className={cn(
                                    'flex items-center justify-end gap-1',
                                    provider.lastTest.ok
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400',
                                  )}
                                >
                                  {provider.lastTest.ok ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3" />
                                  )}
                                  {provider.lastTest.message}
                                </p>
                              )}
                              {provider.updatedAt && <p>Updated {formatDate(provider.updatedAt)}</p>}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
