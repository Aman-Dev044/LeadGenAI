'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Key, Copy, Trash2, ShieldCheck, ShieldX, Clock, Info, AlertTriangle, Lock, CalendarClock, Activity, Terminal, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate, cn } from '@/lib/utils';

const AVAILABLE_PERMISSIONS = ['read', 'write', 'leads', 'conversations', 'agents', 'webhooks'];

export default function ApiKeysPage() {
  const queryClient = useQueryClient();

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [form, setForm] = useState({ name: '', permissions: ['read'] as string[], expiresAt: '' });

  // Revoke
  const [revokeKey, setRevokeKey] = useState<any>(null);

  // Usage guide
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<any>('/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/api-keys', body),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      const resData = (res as any)?.data || res;
      const key = resData?.key || '';
      if (key) setNewKey(key);
      setForm({ name: '', permissions: ['read'], expiresAt: '' });
      toast.success('API key created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setRevokeKey(null);
      toast.success('Key revoked');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const keys = (data as any)?.data?.data || (data as any)?.data || [];
  const allKeys = Array.isArray(keys) ? keys : [];

  const activeCount = allKeys.filter((k: any) => k.isActive).length;
  const revokedCount = allKeys.filter((k: any) => !k.isActive).length;
  const expiredCount = allKeys.filter((k: any) => k.expiresAt && new Date(k.expiresAt) < new Date()).length;

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.permissions.length === 0) { toast.error('Select at least one permission'); return; }
    const payload: Record<string, any> = {
      name: form.name.trim(),
      permissions: form.permissions,
    };
    if (form.expiresAt) payload.expiresAt = form.expiresAt;
    createMutation.mutate(payload);
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  };

  const isExpired = (k: any) => k.expiresAt && new Date(k.expiresAt) < new Date();

  const statusOf = (k: any): { label: string; variant: 'success' | 'warning' | 'destructive' } => {
    if (!k.isActive) return { label: 'Revoked', variant: 'destructive' };
    if (isExpired(k)) return { label: 'Expired', variant: 'warning' };
    return { label: 'Active', variant: 'success' };
  };

  return (
    <div>
      <PageHeader
        icon={Key}
        title="API Keys"
        description="Authenticate external integrations, scripts and no-code tools with scoped access keys."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGuide(true)}>
              <Info className="h-4 w-4" /> Usage Guide
            </Button>
            <Button variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Key
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard title="Total Keys" value={allKeys.length} icon={Key} tone="primary" description="ever created" />
        <StatCard title="Active" value={activeCount} icon={ShieldCheck} tone="success" description="usable right now" />
        <StatCard title="Revoked" value={revokedCount} icon={ShieldX} tone="danger" description="permanently disabled" />
        <StatCard title="Expired" value={expiredCount} icon={Clock} tone="warning" description="past expiry date" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
              </div>
              <div className="flex gap-1.5"><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-14" /></div>
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : allKeys.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys yet"
          description="Create a key to connect your CRM, Zapier or custom scripts to LeadAI."
          actionLabel="Create Key"
          onAction={() => setShowCreate(true)}
          secondary={<Button variant="outline" onClick={() => setShowGuide(true)}><Info className="h-4 w-4" /> Usage Guide</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {allKeys.map((k: any) => {
            const st = statusOf(k);
            const usable = st.variant === 'success';
            return (
              <Card key={k._id} className={cn('flex flex-col p-5', !usable && 'opacity-80')}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    usable ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    <Key className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{k.name}</p>
                      <Badge variant={st.variant} dot>{st.label}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground tracking-wide">
                        {k.keyPrefix}••••••••••••
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Copy key prefix" onClick={() => copyKey(k.keyPrefix)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(k.permissions || []).map((p: string) => (
                    <Badge key={p} variant="outline" className="normal-case">{p}</Badge>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-[11px] text-muted-foreground">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium uppercase tracking-wider text-[10px]"><CalendarClock className="h-3 w-3" /> Expires</p>
                    <p className="mt-0.5 truncate text-foreground/80">{k.expiresAt ? formatDate(k.expiresAt) : 'Never'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium uppercase tracking-wider text-[10px]"><Activity className="h-3 w-3" /> Last used</p>
                    <p className="mt-0.5 truncate text-foreground/80">{k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium uppercase tracking-wider text-[10px]"><Clock className="h-3 w-3" /> Created</p>
                    <p className="mt-0.5 truncate text-foreground/80">{formatDate(k.createdAt)}</p>
                  </div>
                </div>

                {k.isActive && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="xs" className="text-rose-600 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => setRevokeKey(k)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setNewKey(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'API key created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {newKey
                ? 'Copy your key now — for security it will never be shown again.'
                : 'Give the key a name and pick only the permissions the integration needs.'}
            </DialogDescription>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Lock className="h-4 w-4" /> Your new API key
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={newKey} className="font-mono text-xs bg-card" />
                  <Button variant="outline" size="icon" onClick={() => copyKey(newKey)} aria-label="Copy key">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Store it somewhere safe like a secrets manager. Anyone with this key can access your workspace data within its permissions.</span>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreate(false); setNewKey(''); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Integration Key" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Permissions *</Label>
                    <span className="text-xs text-muted-foreground tabular">{form.permissions.length} selected</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border bg-muted/30 p-2">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const checked = form.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={cn(
                            'flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2 py-1.5 transition-colors capitalize',
                            checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(perm)}
                            className="accent-[var(--color-primary)]"
                          />
                          {perm}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Expiry Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for a key that never expires.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create key'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeKey} onOpenChange={() => setRevokeKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke <strong>{revokeKey?.name}</strong> ({revokeKey?.keyPrefix}...)?
              Any integrations using this key will immediately stop working. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeKey(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeKey && revokeMutation.mutate(revokeKey._id)} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>How to use API keys</DialogTitle>
            <DialogDescription>Use API keys to authenticate external integrations with your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <GuideCard icon={Lock} title="Authentication" description="Include your API key in the request header:">
              <CodeBlock>{`GET /api/v1/leads
Host: your-api-domain.com
X-API-Key: ak_your_api_key_here
Content-Type: application/json`}</CodeBlock>
            </GuideCard>

            <GuideCard icon={Terminal} title="Example: Fetch Leads">
              <CodeBlock>{`curl -X GET \\
  https://your-api-domain.com/api/v1/leads \\
  -H "X-API-Key: ak_your_api_key_here" \\
  -H "Content-Type: application/json"`}</CodeBlock>
            </GuideCard>

            <GuideCard icon={Terminal} title="Example: Create Lead">
              <CodeBlock>{`curl -X POST \\
  https://your-api-domain.com/api/v1/leads \\
  -H "X-API-Key: ak_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"John","email":"john@example.com"}'`}</CodeBlock>
            </GuideCard>

            <GuideCard icon={Lightbulb} title="Common Use Cases">
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li><strong className="text-foreground">Widget Integration</strong> — Embed chat widget on your website</li>
                <li><strong className="text-foreground">CRM Sync</strong> — Sync leads with Salesforce, HubSpot etc.</li>
                <li><strong className="text-foreground">Zapier / Make.com</strong> — Automate workflows with no-code tools</li>
                <li><strong className="text-foreground">Custom Scripts</strong> — Export data or bulk operations</li>
                <li><strong className="text-foreground">Mobile App</strong> — Authenticate mobile app requests</li>
              </ul>
            </GuideCard>

            <GuideCard icon={ShieldCheck} title="Security Tips">
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>Never share API keys in public repos or client-side code</li>
                <li>Use minimum required permissions (read-only when possible)</li>
                <li>Set expiry dates for temporary integrations</li>
                <li>Revoke unused keys immediately</li>
                <li>Rotate keys periodically for long-term integrations</li>
              </ul>
            </GuideCard>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuideCard({ icon: Icon, title, description, children }: { icon: any; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border bg-slate-950 text-slate-100 dark:bg-black/40 p-3 text-xs font-mono overflow-x-auto scrollbar-thin leading-relaxed">
      {children}
    </pre>
  );
}
