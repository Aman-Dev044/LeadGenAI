'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, TestTube, ScrollText, RotateCcw,
  Webhook, Activity, XCircle, CheckCircle, Copy, Clock, ShieldCheck, AlertTriangle, Zap,
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TablePagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
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

  const IconAction = ({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-8 w-8', danger && 'text-rose-600 hover:text-rose-600 hover:bg-rose-500/10')}
          aria-label={label}
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div>
      <PageHeader
        icon={Webhook}
        title="Webhooks"
        description="Push lead, conversation and handoff events to your CRM or any external service in real time."
        actions={<Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Webhook</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Total Webhooks" value={total} icon={Webhook} tone="primary" description="endpoints configured" />
        <StatCard title="Active" value={activeCount} icon={Activity} tone="success" description="receiving events" />
        <StatCard title="With Failures" value={failedCount} icon={XCircle} tone={failedCount > 0 ? 'danger' : 'neutral'} description="need attention" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
              </div>
              <div className="flex gap-1.5"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-16" /></div>
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="No webhooks yet"
          description="Create your first webhook to get notified in real time whenever a lead is captured, scored or handed off."
          actionLabel="Add Webhook"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {webhooks.map((w: any) => {
              const isActive = w.isActive ?? true;
              const failures = w.failureCount || 0;
              return (
                <Card key={w._id} className="group flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      <Webhook className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{w.name}</p>
                        <Badge variant={isActive ? 'success' : 'secondary'} dot>{isActive ? 'Active' : 'Paused'}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate" title={w.url}>{w.url}</p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch checked={isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: w._id, isActive: checked })} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(w.events || []).slice(0, 4).map((e: string) => (
                      <Badge key={e} variant="outline" className="font-mono normal-case text-[10.5px]">{e}</Badge>
                    ))}
                    {(w.events || []).length > 4 && <Badge variant="secondary" className="text-[10.5px]">+{w.events.length - 4} more</Badge>}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {w.lastTriggeredAt ? formatDate(w.lastTriggeredAt) : 'Never triggered'}
                    </span>
                    {failures > 0 ? (
                      <Badge variant="destructive"><AlertTriangle className="h-3 w-3" /> {failures} failed</Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle className="h-3.5 w-3.5" /> Healthy</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-0.5 -mr-1.5">
                    <IconAction label="Delivery logs" onClick={() => { setLogsWebhook(w); setLogsPage(1); }}><ScrollText className="h-4 w-4" /></IconAction>
                    <IconAction label="Send test event" onClick={() => testMutation.mutate(w._id)} disabled={testMutation.isPending}><TestTube className="h-4 w-4" /></IconAction>
                    <IconAction label="Edit" onClick={() => handleEdit(w)}><Pencil className="h-4 w-4" /></IconAction>
                    <IconAction label="Delete" danger onClick={() => setDeleteWebhook(w)}><Trash2 className="h-4 w-4" /></IconAction>
                  </div>
                </Card>
              );
            })}
          </div>
          <TablePagination total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setCreatedSecret(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{createdSecret ? 'Webhook created' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              {createdSecret
                ? 'Save the signing secret below — it is shown only once.'
                : 'Choose which events to send and where. We sign every payload with a secret.'}
            </DialogDescription>
          </DialogHeader>

          {createdSecret ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <ShieldCheck className="h-4 w-4" /> Signing secret
                </div>
                <div className="flex gap-2 items-center">
                  <Input value={createdSecret} readOnly className="font-mono text-xs bg-card" />
                  <Button size="icon" variant="outline" onClick={() => copySecret(createdSecret)} aria-label="Copy secret">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Use this secret to verify webhook signatures on your server. You will not be able to see it again.</span>
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
                  {createMutation.isPending ? 'Creating...' : 'Create webhook'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWebhook} onOpenChange={() => setEditWebhook(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update the endpoint, subscribed events or delivery settings.</DialogDescription>
          </DialogHeader>
          <WebhookFormFields form={editForm} setForm={setEditForm} toggleEvent={toggleEvent} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Delivery logs · {logsWebhook?.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs truncate">{logsWebhook?.url}</DialogDescription>
          </DialogHeader>

          {logsLoading ? (
            <Loading label="Loading deliveries" />
          ) : logs.length === 0 ? (
            <EmptyState compact icon={Zap} title="No deliveries yet" description="Send a test event or wait for the first real event to see delivery attempts here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      <TableCell><Badge variant="outline" className="font-mono normal-case text-[10.5px]">{log.event}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={logStatusVariant[log.status] || 'secondary'}>
                          {log.status === 'success' && <CheckCircle className="h-3 w-3" />}
                          {log.status === 'failed' && <XCircle className="h-3 w-3" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.statusCode ? (
                          <span className={cn(
                            'rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular',
                            log.statusCode < 300 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          )}>{log.statusCode}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs tabular">#{log.attemptNumber || 1}</TableCell>
                      <TableCell className="text-xs tabular text-muted-foreground">{log.duration ? `${log.duration}ms` : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        {log.status === 'failed' && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => retryMutation.mutate({ webhookId: logsWebhook._id, logId: log._id })}
                            disabled={retryMutation.isPending}
                          >
                            <RotateCcw className="h-3 w-3" /> Retry
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
                    <div key={log._id} className="flex items-start gap-2 text-xs rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                      <span><span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{log.event}</span> — {log.errorMessage}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" disabled={logsPage <= 1} onClick={() => setLogsPage(logsPage - 1)}>Prev</Button>
                  <span className="text-xs text-muted-foreground tabular">Page {logsPage} of {logsTotalPages}</span>
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
        <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" className="font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Events *</Label>
          <span className="text-xs text-muted-foreground tabular">{form.events.length} selected</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto scrollbar-thin rounded-xl border bg-muted/30 p-2">
          {AVAILABLE_EVENTS.map((event) => {
            const checked = form.events.includes(event);
            return (
              <label
                key={event}
                className={cn(
                  'flex items-center gap-2 text-xs font-mono cursor-pointer rounded-lg px-2 py-1.5 transition-colors',
                  checked ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setForm({ ...form, events: toggleEvent(form.events, event) })}
                  className="accent-[var(--color-primary)]"
                />
                {event}
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-sm font-semibold">Delivery settings</p>
        <p className="text-xs text-muted-foreground">Defaults work for most endpoints.</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
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
