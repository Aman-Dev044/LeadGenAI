'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Workflow, Trash2, Pencil, X, History, Zap, Mail, MessageSquare, Phone, Bell, Tag, UserPlus, Clock, PlayCircle, Layers, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/shared/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Loading } from '@/components/shared/loading';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';

const TRIGGERS = [
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'score_changed', label: 'Score Changed' },
  { value: 'conversation_ended', label: 'Conversation Ended' },
  { value: 'handoff_completed', label: 'Handoff Completed' },
];

const ACTIONS = [
  { value: 'send_email', label: 'Send Email', desc: 'Send email notification' },
  { value: 'send_sms', label: 'Send SMS', desc: 'Send SMS notification' },
  { value: 'send_whatsapp', label: 'Send WhatsApp', desc: 'Send WhatsApp message' },
  { value: 'notify_salesperson', label: 'Notify Salesperson', desc: 'In-app notification to assigned salesperson' },
  { value: 'change_status', label: 'Change Lead Status', desc: 'Update lead status automatically' },
  { value: 'assign_lead', label: 'Assign Lead', desc: 'Assign lead to a user' },
];

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];

const ACTION_ICONS: Record<string, LucideIcon> = {
  send_email: Mail, send_sms: Phone, send_whatsapp: MessageSquare,
  notify_salesperson: Bell, change_status: Tag, assign_lead: UserPlus,
};
const ACTION_TONES: Record<string, string> = {
  send_email: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  send_sms: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  send_whatsapp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  notify_salesperson: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  change_status: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  assign_lead: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};
const fmtDelay = (m: number) => (m === 0 ? 'Immediately' : m >= 1440 ? `${(m / 1440).toFixed(m % 1440 ? 1 : 0)}d` : m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)}h` : `${m}m`);

function ActionIcon({ action, className = 'h-4 w-4' }: { action: string; className?: string }) {
  const Icon = ACTION_ICONS[action] || Zap;
  return <Icon className={className} />;
}

interface StepForm {
  order: number;
  delayMinutes: number;
  action: string;
  actionConfig: Record<string, any>;
}

const emptyStep = (): StepForm => ({ order: 0, delayMinutes: 0, action: 'notify_salesperson', actionConfig: {} });

export default function FollowUpsPage() {
  const queryClient = useQueryClient();

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger: 'lead_created' });
  const [steps, setSteps] = useState<StepForm[]>([]);

  // Edit
  const [editWf, setEditWf] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', trigger: 'lead_created' });
  const [editSteps, setEditSteps] = useState<StepForm[]>([]);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Logs
  const [logsWfId, setLogsWfId] = useState<string | null>(null);
  const [logsWfName, setLogsWfName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['follow-up-workflows'],
    queryFn: () => api.get<any>('/follow-ups/workflows'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  const { data: logsData } = useQuery({
    queryKey: ['workflow-logs', logsWfId],
    queryFn: () => api.get<any>(`/follow-ups/workflows/${logsWfId}/logs`),
    enabled: !!logsWfId,
  });

  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/follow-ups/workflows', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-workflows'] });
      setShowCreate(false);
      setForm({ name: '', description: '', trigger: 'lead_created' });
      setSteps([]);
      toast.success('Workflow created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/follow-ups/workflows/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-workflows'] });
      setEditWf(null);
      toast.success('Workflow updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/follow-ups/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-workflows'] });
      setDeleteId(null);
      toast.success('Workflow deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/follow-ups/workflows/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-workflows'] });
    },
  });

  const workflows = (data as any)?.data?.data || (data as any)?.data || [];
  const logs = (logsData as any)?.data?.data || (logsData as any)?.data || [];

  // Step helpers
  const addStep = (list: StepForm[], setter: (s: StepForm[]) => void) => {
    setter([...list, { ...emptyStep(), order: list.length }]);
  };

  const removeStep = (list: StepForm[], setter: (s: StepForm[]) => void, index: number) => {
    const updated = list.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setter(updated);
  };

  const updateStep = (list: StepForm[], setter: (s: StepForm[]) => void, index: number, field: string, value: any) => {
    const updated = [...list];
    if (field === 'action') {
      updated[index] = { ...updated[index], action: value, actionConfig: {} };
    } else if (field.startsWith('config.')) {
      const configKey = field.replace('config.', '');
      updated[index] = { ...updated[index], actionConfig: { ...updated[index].actionConfig, [configKey]: value } };
    } else {
      (updated[index] as any)[field] = value;
    }
    setter(updated);
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (steps.length === 0) { toast.error('Add at least one step'); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      trigger: form.trigger,
      steps: steps.map((s, i) => ({
        order: i,
        delayMinutes: s.delayMinutes || 0,
        action: s.action,
        actionConfig: s.actionConfig,
      })),
      isActive: false,
    };
    createMutation.mutate(payload);
  };

  const handleEdit = (wf: any) => {
    setEditWf(wf);
    setEditForm({ name: wf.name, description: wf.description || '', trigger: wf.trigger });
    setEditSteps((wf.steps || []).map((s: any, i: number) => ({
      order: i,
      delayMinutes: s.delayMinutes || 0,
      action: s.action,
      actionConfig: s.actionConfig || {},
    })));
  };

  const handleEditSave = () => {
    if (!editWf) return;
    const payload: Record<string, any> = {};
    if (editForm.name.trim() !== editWf.name) payload.name = editForm.name.trim();
    if (editForm.description.trim() !== (editWf.description || '')) payload.description = editForm.description.trim();
    if (editForm.trigger !== editWf.trigger) payload.trigger = editForm.trigger;
    payload.steps = editSteps.map((s, i) => ({
      order: i,
      delayMinutes: s.delayMinutes || 0,
      action: s.action,
      actionConfig: s.actionConfig,
    }));
    updateMutation.mutate({ id: editWf._id, body: payload });
  };

  const getTriggerLabel = (val: string) => TRIGGERS.find((t) => t.value === val)?.label || val;
  const getActionLabel = (val: string) => ACTIONS.find((a) => a.value === val)?.label || val;

  if (isLoading) return <Loading />;

  const activeCount = workflows.filter((w: any) => w.isActive).length;
  const totalSteps = workflows.reduce((n: number, w: any) => n + (w.steps?.length || 0), 0);

  return (
    <div>
      <PageHeader
        title="Follow-up Workflows"
        description="Automate multi-step nurture sequences that fire on lead events — email, SMS, WhatsApp and internal actions."
        icon={Workflow}
        actions={<Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create Workflow</Button>}
      />

      {workflows.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard title="Workflows" value={workflows.length} icon={Workflow} tone="primary" description="total sequences" />
          <StatCard title="Active" value={activeCount} icon={PlayCircle} tone="success" description={`${workflows.length - activeCount} paused`} />
          <StatCard title="Automated steps" value={totalSteps} icon={Layers} tone="violet" description="across all workflows" />
        </div>
      )}

      {workflows.length === 0 ? (
        <EmptyState icon={Workflow} title="No workflows yet" description="Create automated follow-up sequences that nurture leads while your team sleeps." actionLabel="Create Workflow" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf: any) => (
            <Card key={wf._id} className="group flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${wf.isActive ? 'bg-brand-gradient text-white shadow-md shadow-primary/25' : 'bg-muted text-muted-foreground'}`}>
                  <Workflow className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold leading-tight">{wf.name}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{wf.description || 'No description'}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch checked={wf.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: wf._id, isActive: checked })} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{wf.isActive ? 'Pause workflow' : 'Activate workflow'}</TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Badge variant={wf.isActive ? 'success' : 'secondary'} dot>{wf.isActive ? 'Active' : 'Paused'}</Badge>
                <Badge variant="violet"><Zap className="h-3 w-3" />{getTriggerLabel(wf.trigger)}</Badge>
                <Badge variant="outline">{wf.steps?.length || 0} step{(wf.steps?.length || 0) === 1 ? '' : 's'}</Badge>
              </div>

              {(wf.steps || []).length > 0 && (
                <ol className="mt-4 space-y-1.5">
                  {wf.steps.slice(0, 3).map((st: any, i: number) => (
                    <li key={i} className="flex items-center gap-2.5 text-xs">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ACTION_TONES[st.action] || 'bg-muted text-muted-foreground'}`}>
                        <ActionIcon action={st.action} className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 truncate font-medium">{getActionLabel(st.action)}</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground tabular"><Clock className="h-3 w-3" />{fmtDelay(st.delayMinutes || 0)}</span>
                    </li>
                  ))}
                  {wf.steps.length > 3 && <li className="pl-8 text-[11px] text-muted-foreground">+{wf.steps.length - 3} more step{wf.steps.length - 3 === 1 ? '' : 's'}</li>}
                </ol>
              )}

              <div className="mt-auto pt-4"><div className="flex items-center gap-1 border-t pt-3">
                <Button variant="ghost" size="xs" onClick={() => handleEdit(wf)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="xs" onClick={() => { setLogsWfId(wf._id); setLogsWfName(wf.name); }}>
                  <History className="h-3.5 w-3.5" /> Logs
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => setDeleteId(wf._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div></div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>Pick a trigger, then chain the steps that should run after it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome sequence" />
              </div>
              <div className="space-y-2">
                <Label>Trigger *</Label>
                <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <Separator />
            <StepBuilder steps={steps} setSteps={setSteps} users={users} addStep={addStep} removeStep={removeStep} updateStep={updateStep} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWf} onOpenChange={() => setEditWf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>Changes apply to future runs only; in-flight follow-ups are not affected.</DialogDescription>
          </DialogHeader>
          {editWf && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={editForm.trigger} onValueChange={(v) => setEditForm({ ...editForm, trigger: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
              </div>

              <Separator />
              <StepBuilder steps={editSteps} setSteps={setEditSteps} users={users} addStep={addStep} removeStep={removeStep} updateStep={updateStep} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWf(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>Are you sure? This will deactivate the workflow and stop all future follow-ups.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!logsWfId} onOpenChange={() => setLogsWfId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Execution Logs</DialogTitle>
            <DialogDescription>Every step run for <span className="font-medium text-foreground">{logsWfName}</span>, newest first.</DialogDescription>
          </DialogHeader>
          {logs.length === 0 ? (
            <EmptyState compact icon={History} title="No executions yet" description="Logs appear here once the trigger fires for a lead." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Executed</TableHead>
                  <TableHead className="text-right">Lead</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any, i: number) => (
                  <TableRow key={log._id || i}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACTION_TONES[log.action] || 'bg-muted text-muted-foreground'}`}>
                          <ActionIcon action={log.action} className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{getActionLabel(log.action)}</div>
                          <div className="text-[11px] text-muted-foreground">Step #{(log.stepOrder || 0) + 1}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge dot variant={log.status === 'executed' ? 'success' : log.status === 'failed' ? 'destructive' : log.status === 'skipped' ? 'secondary' : log.status === 'processing' ? 'info' : 'warning'}>
                        {log.status}
                      </Badge>
                      {log.errorMessage && <p className="mt-1 max-w-[220px] text-[11px] text-destructive line-clamp-2">{log.errorMessage}</p>}
                      {log.skipReason && <p className="mt-1 max-w-[220px] text-[11px] text-muted-foreground line-clamp-2">Skipped: {log.skipReason}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular">{log.scheduledAt ? formatDate(log.scheduledAt) : '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular">{log.executedAt ? formatDate(log.executedAt) : '-'}</TableCell>
                    <TableCell className="text-right"><code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{log.leadId?.slice(-6) || '-'}</code></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Step Builder Component - vertical stepper
function StepBuilder({
  steps, setSteps, users, addStep, removeStep, updateStep,
}: {
  steps: StepForm[];
  setSteps: (s: StepForm[]) => void;
  users: any[];
  addStep: (list: StepForm[], setter: (s: StepForm[]) => void) => void;
  removeStep: (list: StepForm[], setter: (s: StepForm[]) => void, index: number) => void;
  updateStep: (list: StepForm[], setter: (s: StepForm[]) => void, index: number, field: string, value: any) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Steps <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular">{steps.length}</span></p>
          <p className="text-xs text-muted-foreground">Runs top to bottom. Delay is counted from the previous step.</p>
        </div>
        <Button type="button" variant="soft" size="sm" onClick={() => addStep(steps, setSteps)}>
          <Plus className="h-3.5 w-3.5" /> Add Step
        </Button>
      </div>

      {steps.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Layers className="h-5 w-5" /></div>
          <p className="text-sm font-medium">No steps yet</p>
          <p className="text-xs text-muted-foreground">Add at least one step to define what happens after the trigger.</p>
        </div>
      )}

      {steps.length > 0 && (
        <ol className="relative space-y-4 pl-10">
          <span className="pointer-events-none absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/60 via-border to-border" />
          {steps.map((step, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-10 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white shadow-md shadow-primary/30 ring-4 ring-card">
                {i + 1}
              </span>
              <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACTION_TONES[step.action] || 'bg-muted text-muted-foreground'}`}>
                      <ActionIcon action={step.action} className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold">{ACTIONS.find((a) => a.value === step.action)?.label || 'Step'}</span>
                    <Badge variant="outline" className="normal-case"><Clock className="h-3 w-3" />{fmtDelay(step.delayMinutes || 0)}</Badge>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Remove step" onClick={() => removeStep(steps, setSteps, i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Action</Label>
                    <Select value={step.action} onValueChange={(v) => updateStep(steps, setSteps, i, 'action', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">{ACTIONS.find((a) => a.value === step.action)?.desc}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Delay (minutes)</Label>
                    <Input type="number" min={0} className="h-9" value={step.delayMinutes} onChange={(e) => updateStep(steps, setSteps, i, 'delayMinutes', parseInt(e.target.value) || 0)} />
                    <p className="text-[11px] text-muted-foreground">{step.delayMinutes === 0 ? 'Runs immediately' : step.delayMinutes >= 60 ? `Waits ${(step.delayMinutes / 60).toFixed(1)} hours` : `Waits ${step.delayMinutes} min`}</p>
                  </div>
                </div>

                {/* Action-specific config */}
                <ActionConfigFields step={step} index={i} steps={steps} setSteps={setSteps} users={users} updateStep={updateStep} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Action Config Fields based on action type
function ActionConfigFields({
  step, index, steps, setSteps, users, updateStep,
}: {
  step: StepForm;
  index: number;
  steps: StepForm[];
  setSteps: (s: StepForm[]) => void;
  users: any[];
  updateStep: (list: StepForm[], setter: (s: StepForm[]) => void, index: number, field: string, value: any) => void;
}) {
  const update = (key: string, value: any) => updateStep(steps, setSteps, index, `config.${key}`, value);

  switch (step.action) {
    case 'send_email':
      return (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input className="h-9" value={step.actionConfig.subject || ''} onChange={(e) => update('subject', e.target.value)} placeholder="Follow-up on your inquiry" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea rows={2} value={step.actionConfig.message || ''} onChange={(e) => update('message', e.target.value)} placeholder="Hi, just wanted to follow up..." />
          </div>
        </div>
      );

    case 'send_sms':
    case 'send_whatsapp':
      return (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea rows={2} value={step.actionConfig.message || ''} onChange={(e) => update('message', e.target.value)} placeholder="Hi, following up regarding..." />
          </div>
        </div>
      );

    case 'notify_salesperson':
      return (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Notification Message</Label>
            <Textarea rows={2} value={step.actionConfig.message || ''} onChange={(e) => update('message', e.target.value)} placeholder="Please follow up with this lead" />
          </div>
        </div>
      );

    case 'change_status':
      return (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Change Status To</Label>
            <Select value={step.actionConfig.status || ''} onValueChange={(v) => update('status', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'assign_lead':
      return (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Assign To</Label>
            <Select value={step.actionConfig.assignTo || ''} onValueChange={(v) => update('assignTo', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    default:
      return null;
  }
}
