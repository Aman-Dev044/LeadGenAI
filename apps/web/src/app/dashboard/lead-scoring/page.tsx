'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Target, Zap, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Loading } from '@/components/shared/loading';

const CONDITIONS = [
  { value: 'has_email', label: 'Has Email', desc: 'Lead has email address', hasConfig: false },
  { value: 'has_phone', label: 'Has Phone', desc: 'Lead has phone number', hasConfig: false },
  { value: 'field_match', label: 'Field Match', desc: 'Lead field matches a value', hasConfig: true, configFields: ['field', 'value'] },
  { value: 'conversation_count', label: 'Conversation Count', desc: 'Minimum number of conversations', hasConfig: true, configFields: ['min'] },
  { value: 'message_count', label: 'Message Count', desc: 'Minimum number of messages', hasConfig: true, configFields: ['min'] },
  { value: 'keyword_match', label: 'Keyword Match', desc: 'Visitor messages contain keywords', hasConfig: true, configFields: ['keywords'] },
  { value: 'page_visit', label: 'Page Visit', desc: 'Visited specific pages', hasConfig: true, configFields: ['url'] },
  { value: 'sentiment_score', label: 'Sentiment Score', desc: 'Conversation sentiment threshold', hasConfig: true, configFields: ['min'] },
  { value: 'custom', label: 'Custom', desc: 'Custom condition logic', hasConfig: true, configFields: ['expression'] },
];

interface RuleForm {
  name: string;
  description: string;
  condition: string;
  conditionConfig: Record<string, any>;
  points: number;
  isActive: boolean;
}

const emptyForm: RuleForm = { name: '', description: '', condition: 'has_email', conditionConfig: {}, points: 10, isActive: true };

export default function LeadScoringPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RuleForm>({ ...emptyForm });

  // Edit
  const [editRule, setEditRule] = useState<any>(null);
  const [editForm, setEditForm] = useState<RuleForm>({ ...emptyForm });

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fixed: /lead-score/ → /lead-scoring/
  const { data, isLoading } = useQuery({
    queryKey: ['scoring-rules'],
    queryFn: () => api.get<any>('/lead-scoring/rules'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/lead-scoring/rules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rules'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast.success('Rule created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/lead-scoring/rules/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rules'] });
      setEditRule(null);
      toast.success('Rule updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-scoring/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rules'] });
      setDeleteId(null);
      toast.success('Rule deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/lead-scoring/rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rules'] });
    },
  });

  const scoreAllMutation = useMutation({
    mutationFn: () => api.post('/lead-scoring/score-all'),
    onSuccess: (res: any) => {
      const scored = (res as any)?.data?.scored || 0;
      toast.success(`Scored ${scored} leads`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rules = (data as any)?.data?.data || (data as any)?.data || [];

  const handleCreate = () => {
    const payload: Record<string, any> = {
      name: form.name.trim(),
      condition: form.condition,
      points: form.points,
      isActive: form.isActive,
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (Object.keys(form.conditionConfig).length > 0) payload.conditionConfig = form.conditionConfig;
    if (!payload.name) { toast.error('Name is required'); return; }
    createMutation.mutate(payload);
  };

  const handleEdit = (rule: any) => {
    setEditRule(rule);
    setEditForm({
      name: rule.name,
      description: rule.description || '',
      condition: rule.condition,
      conditionConfig: rule.conditionConfig || {},
      points: rule.points,
      isActive: rule.isActive ?? true,
    });
  };

  const handleEditSave = () => {
    if (!editRule) return;
    const payload: Record<string, any> = {};
    if (editForm.name.trim() !== editRule.name) payload.name = editForm.name.trim();
    if (editForm.description.trim() !== (editRule.description || '')) payload.description = editForm.description.trim();
    if (editForm.condition !== editRule.condition) payload.condition = editForm.condition;
    if (editForm.points !== editRule.points) payload.points = editForm.points;
    if (editForm.isActive !== editRule.isActive) payload.isActive = editForm.isActive;
    const origConfig = JSON.stringify(editRule.conditionConfig || {});
    const newConfig = JSON.stringify(editForm.conditionConfig || {});
    if (origConfig !== newConfig) payload.conditionConfig = editForm.conditionConfig;
    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditRule(null); return; }
    updateMutation.mutate({ id: editRule._id, body: payload });
  };

  const getConditionLabel = (val: string) => CONDITIONS.find((c) => c.value === val)?.label || val;

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Lead Scoring"
        description="Configure rules to automatically score leads"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => scoreAllMutation.mutate()} disabled={scoreAllMutation.isPending}>
              <Zap className="mr-2 h-4 w-4" /> {scoreAllMutation.isPending ? 'Scoring...' : 'Score All Leads'}
            </Button>
            <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Add Rule</Button>
          </div>
        }
      />

      {rules.length === 0 ? (
        <EmptyState icon={Target} title="No scoring rules" description="Add rules to automatically score and prioritize your leads" actionLabel="Add Rule" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule: any) => (
            <Card key={rule._id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
                </div>
                <Switch
                  checked={rule.isActive ?? true}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: rule._id, isActive: checked })}
                />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{getConditionLabel(rule.condition)}</Badge>
                  <span className="text-sm font-semibold text-primary">+{rule.points} pts</span>
                </div>
                {rule.conditionConfig && Object.keys(rule.conditionConfig).length > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {rule.conditionConfig.field && <span>Field: {rule.conditionConfig.field} = {rule.conditionConfig.value}</span>}
                    {rule.conditionConfig.min != null && <span>Min: {rule.conditionConfig.min}</span>}
                    {rule.conditionConfig.keywords && <span>Keywords: {rule.conditionConfig.keywords.join(', ')}</span>}
                    {rule.conditionConfig.url && <span>URL: {rule.conditionConfig.url}</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(rule._id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Scoring Rule</DialogTitle></DialogHeader>
          <RuleFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRule} onOpenChange={() => setEditRule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Scoring Rule</DialogTitle></DialogHeader>
          <RuleFormFields form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRule(null)}>Cancel</Button>
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
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>Are you sure? This rule will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleFormFields({ form, setForm }: { form: RuleForm; setForm: (f: RuleForm) => void }) {
  const condDef = CONDITIONS.find((c) => c.value === form.condition);
  const updateConfig = (key: string, value: any) => setForm({ ...form, conditionConfig: { ...form.conditionConfig, [key]: value } });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="High-value lead" />
        </div>
        <div className="space-y-2">
          <Label>Points *</Label>
          <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Condition *</Label>
          <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v, conditionConfig: {} })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {condDef && <p className="text-xs text-muted-foreground">{condDef.desc}</p>}
        </div>
        <div className="space-y-2">
          <Label>Active</Label>
          <div className="flex items-center h-9">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <span className="ml-2 text-sm text-muted-foreground">{form.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>

      {/* Condition-specific config */}
      {form.condition === 'field_match' && (
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Field Name</Label>
            <Input className="h-9" value={form.conditionConfig.field || ''} onChange={(e) => updateConfig('field', e.target.value)} placeholder="company, source, status..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Match Value</Label>
            <Input className="h-9" value={form.conditionConfig.value || ''} onChange={(e) => updateConfig('value', e.target.value)} placeholder="Enterprise, Google..." />
          </div>
        </div>
      )}

      {(form.condition === 'conversation_count' || form.condition === 'message_count') && (
        <div className="border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Minimum Count</Label>
            <Input type="number" className="h-9 w-32" min={1} value={form.conditionConfig.min || ''} onChange={(e) => updateConfig('min', parseInt(e.target.value) || 1)} placeholder="1" />
          </div>
        </div>
      )}

      {form.condition === 'keyword_match' && (
        <div className="border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Keywords (comma-separated)</Label>
            <Input className="h-9" value={(form.conditionConfig.keywords || []).join(', ')} onChange={(e) => updateConfig('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))} placeholder="pricing, demo, buy, enterprise" />
          </div>
        </div>
      )}

      {form.condition === 'page_visit' && (
        <div className="border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Page URL (contains)</Label>
            <Input className="h-9" value={form.conditionConfig.url || ''} onChange={(e) => updateConfig('url', e.target.value)} placeholder="/pricing, /contact" />
          </div>
        </div>
      )}

      {form.condition === 'sentiment_score' && (
        <div className="border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Minimum Sentiment Score</Label>
            <Input type="number" className="h-9 w-32" min={0} max={100} value={form.conditionConfig.min || ''} onChange={(e) => updateConfig('min', parseInt(e.target.value) || 0)} placeholder="60" />
          </div>
        </div>
      )}

      {form.condition === 'custom' && (
        <div className="border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Expression</Label>
            <Input className="h-9" value={form.conditionConfig.expression || ''} onChange={(e) => updateConfig('expression', e.target.value)} placeholder="Custom condition expression" />
          </div>
        </div>
      )}
    </div>
  );
}
