'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Target, Zap, Trash2, Pencil, Flame, Sun, Snowflake, ListChecks, Sigma, PlayCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/shared/stat-card';
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

/** Temperature thresholds used by the backend scorer (hot >= 70, warm >= 40) */
const TEMPS = [
  { key: 'cold', label: 'Cold', range: '0 – 39', icon: Snowflake, bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', width: 40 },
  { key: 'warm', label: 'Warm', range: '40 – 69', icon: Sun, bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', width: 30 },
  { key: 'hot', label: 'Hot', range: '70 – 100', icon: Flame, bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', width: 30 },
];

function PointsPill({ points }: { points: number }) {
  const positive = points >= 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular ${positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
      {positive ? '+' : ''}{points} pts
    </span>
  );
}

function ConfigChips({ config }: { config?: Record<string, any> }) {
  if (!config || Object.keys(config).length === 0) return null;
  const chips: string[] = [];
  if (config.field) chips.push(`${config.field} = ${config.value ?? ''}`);
  if (config.min != null) chips.push(`min ${config.min}`);
  if (config.keywords?.length) chips.push(...config.keywords.slice(0, 4).map((k: string) => `“${k}”`));
  if (config.keywords?.length > 4) chips.push(`+${config.keywords.length - 4} more`);
  if (config.url) chips.push(`url ∋ ${config.url}`);
  if (config.expression) chips.push(config.expression);
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{c}</span>)}
    </div>
  );
}

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

  const activeRules = rules.filter((r: any) => r.isActive ?? true);
  const maxScore = activeRules.reduce((n: number, r: any) => n + Math.max(0, r.points || 0), 0);

  return (
    <div>
      <PageHeader
        title="Lead Scoring"
        description="Define the signals that make a lead valuable. Points add up to a 0–100 score that sets the lead's temperature."
        icon={Target}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => scoreAllMutation.mutate()} disabled={scoreAllMutation.isPending}>
              <Zap className="h-4 w-4" /> {scoreAllMutation.isPending ? 'Scoring...' : 'Re-score all leads'}
            </Button>
            <Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Rule</Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Rules" value={rules.length} icon={ListChecks} tone="primary" description="configured" />
        <StatCard title="Active" value={activeRules.length} icon={PlayCircle} tone="success" description={`${rules.length - activeRules.length} disabled`} />
        <StatCard title="Max possible score" value={maxScore} icon={Sigma} tone="violet" description="sum of positive active rules" />
      </div>

      {/* Temperature thresholds */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle>Temperature thresholds</CardTitle>
          <CardDescription>How a lead's total score maps to a temperature. Hot leads trigger instant alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {TEMPS.map((t) => <div key={t.key} className={`${t.bar} h-full`} style={{ width: `${t.width}%` }} />)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {TEMPS.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.key} className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${t.text}`}><Icon className="h-4 w-4" /></span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground tabular">{t.range} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <EmptyState icon={Target} title="No scoring rules yet" description="Add rules like “has phone number” or “mentioned pricing” to automatically rank your hottest leads." actionLabel="Add Rule" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule: any) => {
            const active = rule.isActive ?? true;
            return (
              <Card key={rule._id} className={`flex flex-col p-5 ${active ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold leading-tight">{rule.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{rule.description || CONDITIONS.find((c) => c.value === rule.condition)?.desc || 'No description'}</p>
                  </div>
                  <Switch
                    checked={active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: rule._id, isActive: checked })}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge variant="outline">{getConditionLabel(rule.condition)}</Badge>
                  <PointsPill points={rule.points} />
                </div>
                <div className="mt-2 min-h-[22px]">
                  <ConfigChips config={rule.conditionConfig} />
                </div>

                <div className="mt-auto pt-4"><div className="flex items-center gap-1 border-t pt-3">
                  <Button variant="ghost" size="xs" onClick={() => handleEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => setDeleteId(rule._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div></div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Scoring Rule</DialogTitle>
            <DialogDescription>Award (or deduct) points when a lead matches this condition.</DialogDescription>
          </DialogHeader>
          <RuleFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRule} onOpenChange={() => setEditRule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Scoring Rule</DialogTitle>
            <DialogDescription>Re-score leads afterwards to apply the change to existing records.</DialogDescription>
          </DialogHeader>
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
          <div className="flex items-center gap-2">
            <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })} />
            <PointsPill points={form.points} />
          </div>
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
          <label className="flex h-10 cursor-pointer items-center justify-between rounded-lg border bg-card px-3">
            <span className="text-sm text-muted-foreground">{form.isActive ? 'Rule is live' : 'Rule is paused'}</span>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </label>
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
