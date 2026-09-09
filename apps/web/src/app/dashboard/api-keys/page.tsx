'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Key, Copy, Trash2, Shield, ShieldCheck, ShieldX, Clock, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDate } from '@/lib/utils';

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

  const columns = [
    {
      key: 'name', label: 'Name', render: (k: any) => (
        <div>
          <span className="font-medium">{k.name}</span>
          <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}...</p>
        </div>
      ),
    },
    {
      key: 'permissions', label: 'Permissions', render: (k: any) => (
        <div className="flex gap-1 flex-wrap">
          {(k.permissions || []).map((p: string) => (
            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive', label: 'Status', render: (k: any) => {
        if (!k.isActive) return <Badge variant="destructive">Revoked</Badge>;
        if (isExpired(k)) return <Badge variant="warning">Expired</Badge>;
        return <Badge variant="success">Active</Badge>;
      },
    },
    {
      key: 'expiresAt', label: 'Expires', render: (k: any) =>
        k.expiresAt
          ? <span className="text-xs">{formatDate(k.expiresAt)}</span>
          : <span className="text-xs text-muted-foreground">Never</span>,
    },
    {
      key: 'lastUsedAt', label: 'Last Used', render: (k: any) =>
        k.lastUsedAt
          ? <span className="text-xs">{formatDate(k.lastUsedAt)}</span>
          : <span className="text-xs text-muted-foreground">Never</span>,
    },
    { key: 'createdAt', label: 'Created', render: (k: any) => <span className="text-xs">{formatDate(k.createdAt)}</span> },
    {
      key: 'actions', label: '', render: (k: any) =>
        k.isActive ? (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setRevokeKey(k); }}>
            <Trash2 className="mr-1 h-3 w-3" /> Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Manage API access keys for external integrations"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGuide(true)}>
              <Info className="mr-2 h-4 w-4" /> Usage Guide
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Key
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Total Keys" value={allKeys.length} icon={Key} />
        <StatCard title="Active" value={activeCount} icon={ShieldCheck} />
        <StatCard title="Revoked" value={revokedCount} icon={ShieldX} />
        <StatCard title="Expired" value={expiredCount} icon={Clock} />
      </div>

      <DataTable columns={columns} data={allKeys} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setNewKey(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'API Key Created - Save Your Key' : 'Create API Key'}</DialogTitle>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy your API key now. You won't be able to see it again.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={newKey} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyKey(newKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
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
                  <Label>Permissions * ({form.permissions.length} selected)</Label>
                  <div className="grid grid-cols-3 gap-2 border rounded-md p-3">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="rounded"
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Expiry Date (optional)</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Use API Keys</DialogTitle>
            <DialogDescription>Use API keys to authenticate external integrations with your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Authentication</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Include your API key in the request header:</p>
                <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
{`GET /api/v1/leads
Host: your-api-domain.com
X-API-Key: ak_your_api_key_here
Content-Type: application/json`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Example: Fetch Leads</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
{`curl -X GET \\
  https://your-api-domain.com/api/v1/leads \\
  -H "X-API-Key: ak_your_api_key_here" \\
  -H "Content-Type: application/json"`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Example: Create Lead</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
{`curl -X POST \\
  https://your-api-domain.com/api/v1/leads \\
  -H "X-API-Key: ak_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"John","email":"john@example.com"}'`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Common Use Cases</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p><strong>Widget Integration</strong> - Embed chat widget on your website</p>
                <p><strong>CRM Sync</strong> - Sync leads with Salesforce, HubSpot etc.</p>
                <p><strong>Zapier / Make.com</strong> - Automate workflows with no-code tools</p>
                <p><strong>Custom Scripts</strong> - Export data or bulk operations</p>
                <p><strong>Mobile App</strong> - Authenticate mobile app requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Security Tips</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>- Never share API keys in public repos or client-side code</p>
                <p>- Use minimum required permissions (read-only when possible)</p>
                <p>- Set expiry dates for temporary integrations</p>
                <p>- Revoke unused keys immediately</p>
                <p>- Rotate keys periodically for long-term integrations</p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
