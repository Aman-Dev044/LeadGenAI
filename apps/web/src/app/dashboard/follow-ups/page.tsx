'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Workflow, Trash2, Pencil, X, History, ArrowDown, GripVertical } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  return (
    <div>
      <PageHeader
        title="Follow-up Workflows"
        description="Automate lead follow-up sequences"
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Create Workflow</Button>}
      />

      {workflows.length === 0 ? (
        <EmptyState icon={Workflow} title="No workflows" description="Create automated follow-up workflows to nurture your leads" actionLabel="Create Workflow" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf: any) => (
            <Card key={wf._id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{wf.name}</CardTitle>
                  <CardDescription>{wf.description || 'No description'}</CardDescription>
                </div>
                <Switch
                  checked={wf.isActive}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: wf._id, isActive: checked })}
                />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={wf.isActive ? 'success' : 'secondary'}>{wf.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant="outline">{getTriggerLabel(wf.trigger)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{wf.steps?.length || 0} step(s)</p>
                {(wf.steps || []).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                    {wf.steps.slice(0, 3).map((s: any, i: number) => (
                      <p key={i}>
                        {i + 1}. {getActionLabel(s.action)}
                        {s.delayMinutes > 0 && <span className="ml-1">(after {s.delayMinutes}m)</span>}
                      </p>
                    ))}
                    {wf.steps.length > 3 && <p>...and {wf.steps.length - 3} more</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(wf)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setLogsWfId(wf._id); setLogsWfName(wf.name); }}>
                    <History className="mr-1 h-3 w-3" /> Logs
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(wf._id)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Workflow</DialogTitle></DialogHeader>
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
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWf} onOpenChange={() => setEditWf(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Workflow</DialogTitle></DialogHeader>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Logs - {logsWfName}</DialogTitle>
          </DialogHeader>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No execution logs yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any, i: number) => (
                <div key={log._id || i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={log.status === 'executed' ? 'success' : log.status === 'failed' ? 'destructive' : log.status === 'skipped' ? 'secondary' : 'default'}>
                        {log.status}
                      </Badge>
                      <span className="text-sm font-medium">{getActionLabel(log.action)}</span>
                      <span className="text-xs text-muted-foreground">Step #{(log.stepOrder || 0) + 1}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.scheduledAt && <span>Scheduled: {formatDate(log.scheduledAt)}</span>}
                      {log.executedAt && <span className="ml-3">Executed: {formatDate(log.executedAt)}</span>}
                    </div>
                    {log.errorMessage && <p className="text-xs text-destructive mt-1">{log.errorMessage}</p>}
                    {log.skipReason && <p className="text-xs text-muted-foreground mt-1">Skipped: {log.skipReason}</p>}
                  </div>
                  <code className="text-xs text-muted-foreground">{log.leadId?.slice(-6)}</code>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Step Builder Component
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
        <Label className="text-sm font-medium">Steps ({steps.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => addStep(steps, setSteps)}>
          <Plus className="mr-1 h-3 w-3" /> Add Step
        </Button>
      </div>

      {steps.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          No steps yet. Add at least one step to define the workflow.
        </p>
      )}

      {steps.map((step, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex justify-center py-1">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Step {i + 1}</span>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStep(steps, setSteps, i)}>
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
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delay (minutes)</Label>
                <Input type="number" min={0} className="h-9" value={step.delayMinutes} onChange={(e) => updateStep(steps, setSteps, i, 'delayMinutes', parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground">{step.delayMinutes === 0 ? 'Immediate' : step.delayMinutes >= 60 ? `${(step.delayMinutes / 60).toFixed(1)} hours` : `${step.delayMinutes} min`}</p>
              </div>
            </div>

            {/* Action-specific config */}
            <ActionConfigFields step={step} index={i} steps={steps} setSteps={setSteps} users={users} updateStep={updateStep} />
          </div>
        </div>
      ))}
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
