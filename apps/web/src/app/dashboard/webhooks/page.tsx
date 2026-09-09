'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, TestTube, ScrollText, RotateCcw,
  Webhook, Activity, XCircle, CheckCircle, Copy, Clock,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { formatDate, cn } from '@/lib/utils';

const AVAILABLE_EVENTS = [
  'lead.created', 'lead.updated', 'lead.deleted', 'lead.scored',
  'conversation.created', 'conversation.ended',
  'handoff.created', 'handoff.accepted', 'handoff.rejected', 'handoff.completed',
  'appointment.created', 'appointment.updated',
  'ticket.created', 'ticket.resolved',
  'webhook.test',
];

const logStatusVariant: Record<string, 'default' | 'success' | 'destructive' | 'warning'> = {
  success: 'success', failed: 'destructive', pending: 'warning',
};

interface WebhookForm {
  name: string;
  url: string;
  events: string[];
  contentType: string;
  retryCount: number;
  timeoutMs: number;
}

const emptyForm: WebhookForm = {
  name: '', url: '', events: ['lead.created'],
  contentType: 'application/json', retryCount: 3, timeoutMs: 10000,
};

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<WebhookForm>({ ...emptyForm });
  const [createdSecret, setCreatedSecret] = useState('');

  // Edit
  const [editWebhook, setEditWebhook] = useState<any>(null);
  const [editForm, setEditForm] = useState<WebhookForm>({ ...emptyForm });

  // Delete
  const [deleteWebhook, setDeleteWebhook] = useState<any>(null);

  // Logs
  const [logsWebhook, setLogsWebhook] = useState<any>(null);
  const [logsPage, setLogsPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', page, limit],
    queryFn: () => api.get<any>('/webhooks', { page, limit }),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['webhook-logs', logsWebhook?._id, logsPage],
    queryFn: () => api.get<any>(`/webhooks/${logsWebhook._id}/logs`, { page: logsPage, limit: 10 }),
    enabled: !!logsWebhook,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/webhooks', body),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      const secret = (res as any)?.data?.secret || (res as any)?.secret || '';
      if (secret) {
        setCreatedSecret(secret);
      } else {
        setShowCreate(false);
      }
      setForm({ ...emptyForm });
      toast.success('Webhook created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/webhooks/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setEditWebhook(null);
      toast.success('Webhook updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/webhooks/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setDeleteWebhook(null);
      toast.success('Webhook deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`),
    onSuccess: () => toast.success('Test webhook sent'),
    onError: (err: any) => toast.error(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: ({ webhookId, logId }: { webhookId: string; logId: string }) =>
      api.post(`/webhooks/${webhookId}/retry/${logId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      toast.success('Retry dispatched');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const webhooks = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;

  const logs = (logsData as any)?.data?.data || (logsData as any)?.data || [];
  const logsTotalPages = (logsData as any)?.data?.totalPages || 1;

  const activeCount = webhooks.filter((w: any) => w.isActive).length;
  const failedCount = webhooks.filter((w: any) => (w.failureCount || 0) > 0).length;

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.url.trim()) { toast.error('URL is required'); return; }
    if (form.events.length === 0) { toast.error('Select at least one event'); return; }
    const payload: Record<string, any> = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: form.events,
    };
    const config: Record<string, any> = {};
    if (form.contentType !== 'application/json') config.contentType = form.contentType;
    if (form.retryCount !== 3) config.retryCount = form.retryCount;
    if (form.timeoutMs !== 10000) config.timeoutMs = form.timeoutMs;
    if (Object.keys(config).length > 0) payload.config = config;
    createMutation.mutate(payload);
  };

  const handleEdit = (w: any) => {
    setEditWebhook(w);
    setEditForm({
      name: w.name || '',
      url: w.url || '',
      events: w.events || [],
      contentType: w.config?.contentType || 'application/json',
      retryCount: w.config?.retryCount ?? 3,
      timeoutMs: w.config?.timeoutMs ?? 10000,
    });
  };

  const handleEditSave = () => {
    if (!editWebhook) return;
    const payload: Record<string, any> = {};
    if (editForm.name.trim() !== editWebhook.name) payload.name = editForm.name.trim();
    if (editForm.url.trim() !== editWebhook.url) payload.url = editForm.url.trim();
    if (JSON.stringify(editForm.events) !== JSON.stringify(editWebhook.events)) payload.events = editForm.events;
    const newConfig: Record<string, any> = {};
    if (editForm.contentType !== (editWebhook.config?.contentType || 'application/json')) newConfig.contentType = editForm.contentType;
    if (editForm.retryCount !== (editWebhook.config?.retryCount ?? 3)) newConfig.retryCount = editForm.retryCount;
    if (editForm.timeoutMs !== (editWebhook.config?.timeoutMs ?? 10000)) newConfig.timeoutMs = editForm.timeoutMs;
    if (Object.keys(newConfig).length > 0) payload.config = { ...(editWebhook.config || {}), ...newConfig };
    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditWebhook(null); return; }
    updateMutation.mutate({ id: editWebhook._id, body: payload });
  };

  const toggleEvent = (events: string[], event: string) => {
    return events.includes(event) ? events.filter((e) => e !== event) : [...events, event];
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  const columns = [
    {
      key: 'name', label: 'Name', render: (w: any) => (
        <div>
          <span className="font-medium">{w.name}</span>
          <p className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">{w.url}</p>
        </div>
      ),
    },
    {
      key: 'events', label: 'Events', render: (w: any) => (
        <div className="flex gap-1 flex-wrap max-w-[200px]">
          {(w.events || []).slice(0, 3).map((e: string) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
          {(w.events || []).length > 3 && <Badge variant="secondary" className="text-xs">+{w.events.length - 3}</Badge>}
        </div>
      ),
    },
    {
      key: 'isActive', label: 'Active', render: (w: any) => (
        <Switch checked={w.isActive ?? true} onCheckedChange={(checked) => toggleMutation.mutate({ id: w._id, isActive: checked })} />
      ),
    },
    {
      key: 'failureCount', label: 'Failures', render: (w: any) => (
        w.failureCount > 0
          ? <Badge variant="destructive">{w.failureCount}</Badge>
          : <span className="text-muted-foreground text-xs">0</span>
      ),
    },
    {
      key: 'lastTriggeredAt', label: 'Last Triggered', render: (w: any) =>
        w.lastTriggeredAt ? <span className="text-xs">{formatDate(w.lastTriggeredAt)}</span> : <span className="text-xs text-muted-foreground">Never</span>,
    },
    {
      key: 'actions', label: '', render: (w: any) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" title="View Logs" onClick={(e) => { e.stopPropagation(); setLogsWebhook(w); setLogsPage(1); }}>
            <ScrollText className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Test" onClick={(e) => { e.stopPropagation(); testMutation.mutate(w._id); }} disabled={testMutation.isPending}>
            <TestTube className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(w); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteWebhook(w); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Send real-time events to external services"
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Total Webhooks" value={total} icon={Webhook} />
        <StatCard title="Active" value={activeCount} icon={Activity} />
        <StatCard title="With Failures" value={failedCount} icon={XCircle} />
      </div>

      <DataTable columns={columns} data={webhooks} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setCreatedSecret(''); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{createdSecret ? 'Webhook Created - Save Your Secret' : 'Create Webhook'}</DialogTitle></DialogHeader>

          {createdSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This secret is used to verify webhook signatures. It will only be shown once. Copy and save it now.
              </p>
              <div className="flex gap-2 items-center">
                <Input value={createdSecret} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copySecret(createdSecret)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreate(false); setCreatedSecret(''); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <WebhookFormFields form={form} setForm={setForm} toggleEvent={toggleEvent} />
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

      {/* Edit Dialog */}
      <Dialog open={!!editWebhook} onOpenChange={() => setEditWebhook(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Webhook</DialogTitle></DialogHeader>
          <WebhookFormFields form={editForm} setForm={setEditForm} toggleEvent={toggleEvent} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteWebhook} onOpenChange={() => setDeleteWebhook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteWebhook?.name}</strong>? All delivery logs will also be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWebhook(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteWebhook && deleteMutation.mutate(deleteWebhook._id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!logsWebhook} onOpenChange={() => setLogsWebhook(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Logs - {logsWebhook?.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{logsWebhook?.url}</DialogDescription>
          </DialogHeader>

          {logsLoading ? (
            <Loading />
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No delivery logs yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log._id}>
                      <TableCell><Badge variant="outline" className="text-xs">{log.event}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={logStatusVariant[log.status] || 'secondary'} className="text-xs">
                          {log.status === 'success' && <CheckCircle className="mr-1 h-3 w-3" />}
                          {log.status === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.statusCode || '-'}</TableCell>
                      <TableCell className="text-xs">#{log.attemptNumber || 1}</TableCell>
                      <TableCell className="text-xs">{log.duration ? `${log.duration}ms` : '-'}</TableCell>
                      <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        {log.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => retryMutation.mutate({ webhookId: logsWebhook._id, logId: log._id })}
                            disabled={retryMutation.isPending}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Log error details */}
              {logs.some((l: any) => l.errorMessage) && (
                <div className="space-y-2 mt-2">
                  {logs.filter((l: any) => l.errorMessage).map((log: any) => (
                    <div key={log._id} className="text-xs bg-destructive/10 p-2 rounded">
                      <span className="font-medium text-destructive">{log.event}:</span> {log.errorMessage}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  <Button size="sm" variant="outline" disabled={logsPage <= 1} onClick={() => setLogsPage(logsPage - 1)}>Prev</Button>
                  <span className="text-sm text-muted-foreground flex items-center">Page {logsPage} of {logsTotalPages}</span>
                  <Button size="sm" variant="outline" disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage(logsPage + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhookFormFields({
  form, setForm, toggleEvent,
}: {
  form: WebhookForm;
  setForm: (f: WebhookForm) => void;
  toggleEvent: (events: string[], event: string) => string[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CRM Sync" />
      </div>
      <div className="space-y-2">
        <Label>URL *</Label>
        <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" />
      </div>

      <div className="space-y-2">
        <Label>Events * ({form.events.length} selected)</Label>
        <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto border rounded-md p-3">
          {AVAILABLE_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-1 rounded">
              <input
                type="checkbox"
                checked={form.events.includes(event)}
                onChange={() => setForm({ ...form, events: toggleEvent(form.events, event) })}
                className="rounded"
              />
              {event}
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-3">
        <Label className="text-sm font-medium">Advanced Config</Label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Content Type</Label>
            <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="application/json">application/json</SelectItem>
                <SelectItem value="application/x-www-form-urlencoded">form-urlencoded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Retries</Label>
            <Input type="number" className="h-9" min={0} max={10} value={form.retryCount} onChange={(e) => setForm({ ...form, retryCount: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timeout (ms)</Label>
            <Input type="number" className="h-9" min={1000} max={30000} step={1000} value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: parseInt(e.target.value) || 10000 })} />
          </div>
        </div>
      </div>
    </div>
  );
}
