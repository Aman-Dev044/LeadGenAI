'use client';
import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Trash2, Plus, X, Copy, Check, Bot, Settings2, Cpu, Wrench, BookOpen,
  ClipboardList, Palette, ArrowLeftRight, Code2, MessageCircle, Send, Cpu as CpuIcon,
  Phone, Volume2, Zap, Play, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';

const AVAILABLE_TOOLS = [
  { id: 'lead_capture', label: 'Lead Capture', desc: 'Capture visitor info as leads' },
  { id: 'appointment_booking', label: 'Appointment Booking', desc: 'Book appointments from chat' },
  { id: 'ticket_creation', label: 'Create Support Ticket', desc: 'Create tickets from chat' },
  { id: 'lead_status_update', label: 'Lead Status Update', desc: 'AI can update lead status/temperature' },
  { id: 'notify_salesperson', label: 'Notify Salesperson', desc: 'Send alerts to sales team' },
  { id: 'handoff_to_human', label: 'Handoff to Human', desc: 'Transfer to live agent' },
  { id: 'knowledge_search', label: 'Knowledge Base Search', desc: 'Search knowledge base for answers' },
];

const FIELD_TYPES = ['text', 'email', 'phone', 'select', 'number'];

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  draft: 'secondary',
  inactive: 'destructive',
};

const KB_STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
  completed: 'success',
  failed: 'destructive',
  processing: 'warning',
  pending: 'default',
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // New lead capture field form
  const [newField, setNewField] = useState({ field: '', label: '', type: 'text', required: false, options: '' });

  // Browser voices for Text-to-Speech preview
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingVoiceSample, setIsPlayingVoiceSample] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) setBrowserVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const testVoicePlayback = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance('Hello! I am your AI assistant. How can I help you today?');
    const targetVoice = form?.widgetConfig?.defaultVoiceName;
    if (targetVoice && browserVoices.length > 0) {
      const found = browserVoices.find((v) => v.name === targetVoice || v.voiceURI === targetVoice);
      if (found) utter.voice = found;
    }
    utter.rate = form?.widgetConfig?.defaultVoiceRate !== undefined ? Number(form.widgetConfig.defaultVoiceRate) : 1.0;
    utter.pitch = form?.widgetConfig?.defaultVoicePitch !== undefined ? Number(form.widgetConfig.defaultVoicePitch) : 1.0;
    setIsPlayingVoiceSample(true);
    utter.onend = () => setIsPlayingVoiceSample(false);
    utter.onerror = () => setIsPlayingVoiceSample(false);
    window.speechSynthesis.speak(utter);
    toast.success('Playing voice preview...');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => api.get<any>(`/agents/${id}`),
  });

  const { data: kbData } = useQuery({
    queryKey: ['knowledge-sources'],
    queryFn: () => api.get<any>('/knowledge-base/sources'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  useEffect(() => {
    const agent = (data as any)?.data;
    if (agent && !form) setForm(agent);
  }, [data, form]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/agents/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      toast.success('Agent saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/agents/${id}`),
    onSuccess: () => {
      toast.success('Agent deleted');
      router.push('/dashboard/agents');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading || !form) return <Loading label="Loading agent" />;

  const kbSources = (kbData as any)?.data?.data || (kbData as any)?.data || [];
  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });
  const updateNested = (parent: string, field: string, value: any) =>
    setForm({ ...form, [parent]: { ...(form[parent] || {}), [field]: value } });

  const handleSave = () => {
    // Only send editable fields, not _id, tenantId, createdAt etc.
    const payload: any = {
      name: form.name,
      description: form.description,
      systemPrompt: form.systemPrompt,
      welcomeMessage: form.welcomeMessage,
      status: form.status,
      aiConfig: form.aiConfig,
      widgetConfig: form.widgetConfig,
      handoffConfig: form.handoffConfig,
      enabledTools: form.enabledTools || [],
      leadCaptureFields: form.leadCaptureFields || [],
      knowledgeSourceIds: form.knowledgeSourceIds || [],
    };
    updateMutation.mutate(payload);
  };

  // Lead capture fields helpers
  const addField = () => {
    if (!newField.field || !newField.label) {
      toast.error('Field name and label are required');
      return;
    }
    const fields = form.leadCaptureFields || [];
    const entry: any = {
      field: newField.field,
      label: newField.label,
      type: newField.type,
      required: newField.required,
      order: fields.length,
    };
    if (newField.type === 'select' && newField.options) {
      entry.options = newField.options.split(',').map((o: string) => o.trim()).filter(Boolean);
    }
    update('leadCaptureFields', [...fields, entry]);
    setNewField({ field: '', label: '', type: 'text', required: false, options: '' });
  };

  const removeField = (index: number) => {
    const fields = [...(form.leadCaptureFields || [])];
    fields.splice(index, 1);
    update('leadCaptureFields', fields.map((f: any, i: number) => ({ ...f, order: i })));
  };

  // Knowledge source toggle
  const toggleKbSource = (sourceId: string) => {
    const ids = form.knowledgeSourceIds || [];
    if (ids.includes(sourceId)) {
      update('knowledgeSourceIds', ids.filter((id: string) => id !== sourceId));
    } else {
      update('knowledgeSourceIds', [...ids, sourceId]);
    }
  };

  // Enabled tools toggle
  const toggleTool = (toolId: string) => {
    const tools = form.enabledTools || [];
    if (tools.includes(toolId)) {
      update('enabledTools', tools.filter((t: string) => t !== toolId));
    } else {
      update('enabledTools', [...tools, toolId]);
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
  const widgetApiUrl = process.env.NEXT_PUBLIC_API_URL || `${baseUrl}/api/v1`;
  const embedCode = `<script>
  (function() {
    var w = document.createElement('script');
    w.src = '${baseUrl}/widget.js';
    w.setAttribute('data-agent-id', '${id}');
    w.setAttribute('data-api-url', '${widgetApiUrl}');
    w.async = true;
    document.body.appendChild(w);
  })();
</script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const primaryColor = form.widgetConfig?.primaryColor || '#6366f1';
  const enabledToolsCount = (form.enabledTools || []).length;
  const kbCount = (form.knowledgeSourceIds || []).length;
  const fieldCount = (form.leadCaptureFields || []).length;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between page-enter">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/agents')}>
          <ArrowLeft className="h-4 w-4" /> All agents
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-600 hover:border-rose-500/40" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button variant="gradient" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Header card */}
      <Card className="relative overflow-hidden p-6 page-enter">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-[0.14] blur-3xl"
          style={{ background: primaryColor }}
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: primaryColor, boxShadow: `0 10px 24px -8px ${primaryColor}` }}
            >
              {form.widgetConfig?.avatarUrl ? (
                <img src={form.widgetConfig.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Bot className="h-8 w-8" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight truncate">{form.name || 'Untitled agent'}</h1>
                <Badge variant={STATUS_VARIANT[form.status] || 'secondary'} dot>{form.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{form.description || 'No description yet'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono normal-case"><CpuIcon className="h-3 w-3" /> {form.aiConfig?.model || 'default model'}</Badge>
                <Badge variant="outline" className="normal-case capitalize">{form.aiConfig?.provider || 'openai'}</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 md:min-w-[300px]">
            {[
              { label: 'Tools', value: enabledToolsCount, icon: Wrench },
              { label: 'Sources', value: kbCount, icon: BookOpen },
              { label: 'Fields', value: fieldCount, icon: ClipboardList },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-muted/40 px-3 py-2.5 text-center">
                <s.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-bold leading-none tabular">{s.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="general">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="general"><Settings2 className="h-3.5 w-3.5" /> General</TabsTrigger>
          <TabsTrigger value="ai"><Cpu className="h-3.5 w-3.5" /> AI Config</TabsTrigger>
          <TabsTrigger value="tools"><Wrench className="h-3.5 w-3.5" /> Tools</TabsTrigger>
          <TabsTrigger value="knowledge"><BookOpen className="h-3.5 w-3.5" /> Knowledge</TabsTrigger>
          <TabsTrigger value="lead-capture"><ClipboardList className="h-3.5 w-3.5" /> Lead Capture</TabsTrigger>
          <TabsTrigger value="widget"><Palette className="h-3.5 w-3.5" /> Widget</TabsTrigger>
          <TabsTrigger value="handoff"><ArrowLeftRight className="h-3.5 w-3.5" /> Handoff</TabsTrigger>
          <TabsTrigger value="embed"><Code2 className="h-3.5 w-3.5" /> Embed</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Basic Info</CardTitle>
              <CardDescription>Name, status and the personality your agent uses in every conversation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => update('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea value={form.systemPrompt} onChange={(e) => update('systemPrompt', e.target.value)} rows={8} className="font-mono text-[13px] leading-relaxed" />
                <p className="text-xs text-muted-foreground">Tell the agent who it is, what it sells, what it must never say and how it should hand off.</p>
              </div>
              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input value={form.welcomeMessage || ''} onChange={(e) => update('welcomeMessage', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Config Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Which model powers this agent and how creative it is allowed to be.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={form.aiConfig?.provider || 'openai'} onValueChange={(v) => updateNested('aiConfig', 'provider', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={form.aiConfig?.model || ''} onChange={(e) => updateNested('aiConfig', 'model', e.target.value)} placeholder="gpt-4o" className="font-mono" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular text-primary">
                      {form.aiConfig?.temperature ?? 0.7}
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={form.aiConfig?.temperature ?? 0.7}
                    onChange={(e) => updateNested('aiConfig', 'temperature', parseFloat(e.target.value))}
                    className="w-full accent-[var(--color-primary)] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Precise</span><span>Balanced</span><span>Creative</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input type="number" value={form.aiConfig?.maxTokens || 1024} onChange={(e) => updateNested('aiConfig', 'maxTokens', parseInt(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Upper bound on the length of each reply.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Enabled Tools</CardTitle>
              <CardDescription>Select which capabilities this agent can use during conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const on = (form.enabledTools || []).includes(tool.id);
                  return (
                    <div
                      key={tool.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors',
                        on ? 'border-primary/40 bg-primary/5' : 'bg-card',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{tool.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{tool.desc}</p>
                        </div>
                      </div>
                      <Switch checked={on} onCheckedChange={() => toggleTool(tool.id)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Knowledge Sources</CardTitle>
              <CardDescription>Select which knowledge sources this agent can access for answering questions</CardDescription>
            </CardHeader>
            <CardContent>
              {kbSources.length === 0 ? (
                <EmptyState
                  compact
                  icon={BookOpen}
                  title="No knowledge sources yet"
                  description="Add documents, URLs or text from the Knowledge Base page, then attach them here."
                  actionLabel="Open Knowledge Base"
                  onAction={() => router.push('/dashboard/knowledge-base')}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {kbSources.map((source: any) => {
                    const on = (form.knowledgeSourceIds || []).includes(source._id);
                    return (
                      <label
                        key={source._id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                          on ? 'border-primary/40 bg-primary/5' : 'bg-card hover:bg-accent/40',
                        )}
                      >
                        <Checkbox checked={on} onCheckedChange={() => toggleKbSource(source._id)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{source.name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">{source.type}</Badge>
                            <Badge variant={KB_STATUS_VARIANT[source.status] || 'default'}>{source.status}</Badge>
                            {source.chunkCount != null && <span className="text-xs text-muted-foreground tabular">{source.chunkCount} chunks</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Capture Fields Tab */}
        <TabsContent value="lead-capture" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Lead Capture Fields</CardTitle>
              <CardDescription>Configure which fields the widget collects from visitors before starting a chat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Existing fields */}
              {(form.leadCaptureFields || []).length > 0 ? (
                <div className="space-y-2">
                  {(form.leadCaptureFields || []).map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground tabular">
                          {f.order + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {f.label} <span className="font-mono text-xs font-normal text-muted-foreground">({f.field})</span>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">{f.type}</Badge>
                            {f.required && <Badge variant="default">Required</Badge>}
                            {f.options?.length > 0 && <span className="text-xs text-muted-foreground truncate">Options: {f.options.join(', ')}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => removeField(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No fields yet. Visitors will start chatting immediately without filling a form.
                </div>
              )}

              <Separator />

              {/* Add new field */}
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">Add Field</p>
                  <p className="text-xs text-muted-foreground">Fields are shown in the order you add them.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Field Key</Label>
                    <Input placeholder="email" value={newField.field} onChange={(e) => setNewField({ ...newField, field: e.target.value })} className="h-9 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input placeholder="Email Address" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} className="h-9" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Required</Label>
                    <div className="flex h-9 items-center">
                      <Switch checked={newField.required} onCheckedChange={(v) => setNewField({ ...newField, required: v })} />
                    </div>
                  </div>
                  {newField.type === 'select' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (comma)</Label>
                      <Input placeholder="opt1, opt2" value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} className="h-9" />
                    </div>
                  )}
                </div>
                <Button size="sm" variant="soft" onClick={addField}>
                  <Plus className="h-3.5 w-3.5" /> Add Field
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Widget Tab */}
        <TabsContent value="widget" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Appearance Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Widget Appearance</CardTitle>
                      <CardDescription>How the chat bubble looks on your website.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.widgetConfig?.primaryColor || '#3b82f6'}
                          onChange={(e) => updateNested('widgetConfig', 'primaryColor', e.target.value)}
                          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border bg-card p-1"
                        />
                        <Input value={form.widgetConfig?.primaryColor || '#3b82f6'} onChange={(e) => updateNested('widgetConfig', 'primaryColor', e.target.value)} className="font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select value={form.widgetConfig?.position || 'bottom-right'} onValueChange={(v) => updateNested('widgetConfig', 'position', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Header Text</Label>
                    <Input value={form.widgetConfig?.headerText || ''} onChange={(e) => updateNested('widgetConfig', 'headerText', e.target.value)} placeholder="Chat with us" />
                  </div>
                  <div className="space-y-2">
                    <Label>Placeholder Text</Label>
                    <Input value={form.widgetConfig?.placeholder || ''} onChange={(e) => updateNested('widgetConfig', 'placeholder', e.target.value)} placeholder="Type a message..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Avatar URL</Label>
                    <div className="flex items-center gap-3">
                      <Input value={form.widgetConfig?.avatarUrl || ''} onChange={(e) => updateNested('widgetConfig', 'avatarUrl', e.target.value)} placeholder="https://example.com/avatar.png" />
                      {form.widgetConfig?.avatarUrl && (
                        <img src={form.widgetConfig.avatarUrl} alt="Avatar" className="h-10 w-10 shrink-0 rounded-full border object-cover" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 1-Click WhatsApp Lead Capture Card */}
              <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle>1-Click WhatsApp Lead Capture</CardTitle>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                            High Conversion
                          </Badge>
                        </div>
                        <CardDescription>
                          Connect visitors directly to your sales reps on WhatsApp while logging captured leads in LeadAI.
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={form.widgetConfig?.whatsappEnabled ?? false}
                      onCheckedChange={(checked) => updateNested('widgetConfig', 'whatsappEnabled', checked)}
                    />
                  </div>
                </CardHeader>
                {form.widgetConfig?.whatsappEnabled && (
                  <CardContent className="space-y-4 pt-0">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                      💡 Visitors see a direct WhatsApp button inside the widget header, in exit-intent prompts, and after helpful responses. When clicked, LeadAI captures their intent and opens WhatsApp directly.
                    </div>
                    <div className="space-y-2">
                      <Label>Sales Rep WhatsApp Number (with country code)</Label>
                      <Input
                        value={form.widgetConfig?.whatsappNumber || ''}
                        onChange={(e) => updateNested('widgetConfig', 'whatsappNumber', e.target.value)}
                        placeholder="e.g. +919876543210 or 14155552671"
                      />
                      <p className="text-[11px] text-muted-foreground">Include country code without special characters (e.g. 91 for India, 1 for US/Canada).</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Pre-filled Message</Label>
                      <Textarea
                        rows={2}
                        value={form.widgetConfig?.whatsappDefaultMessage || ''}
                        onChange={(e) => updateNested('widgetConfig', 'whatsappDefaultMessage', e.target.value)}
                        placeholder="Hi! I was visiting your website and would like more details about your services."
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Proactive Prompts & Exit-Intent Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Proactive Prompts & Exit-Intent Triggers</CardTitle>
                      <CardDescription>
                        Catch visitors before they leave and proactively engage high-intent browsers.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Proactive Visitor Nudge</p>
                        <p className="text-xs text-muted-foreground">
                          Pops a friendly floating prompt when visitors dwell on the page or scroll &gt; 50%.
                        </p>
                      </div>
                      <Switch
                        checked={form.widgetConfig?.proactivePromptEnabled ?? true}
                        onCheckedChange={(checked) => updateNested('widgetConfig', 'proactivePromptEnabled', checked)}
                      />
                    </div>
                    {form.widgetConfig?.proactivePromptEnabled !== false && (
                      <div className="grid gap-4 pt-2 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Delay (seconds)</Label>
                          <Input
                            type="number"
                            min={3}
                            max={120}
                            value={form.widgetConfig?.proactiveDelaySeconds ?? 10}
                            onChange={(e) => updateNested('widgetConfig', 'proactiveDelaySeconds', Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Nudge Message</Label>
                          <Input
                            value={form.widgetConfig?.proactiveMessage || ''}
                            onChange={(e) => updateNested('widgetConfig', 'proactiveMessage', e.target.value)}
                            placeholder="👋 Hi! Need a quick custom quote or have questions?"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Exit-Intent Interceptor</p>
                        <p className="text-xs text-muted-foreground">
                          Detects mouse cursor moving to exit tab and presents an instant offer / consultation.
                        </p>
                      </div>
                      <Switch
                        checked={form.widgetConfig?.exitIntentEnabled ?? true}
                        onCheckedChange={(checked) => updateNested('widgetConfig', 'exitIntentEnabled', checked)}
                      />
                    </div>
                    {form.widgetConfig?.exitIntentEnabled !== false && (
                      <div className="space-y-2 pt-2">
                        <Label>Exit Intent Offer / Text</Label>
                        <Textarea
                          rows={2}
                          value={form.widgetConfig?.exitIntentMessage || ''}
                          onChange={(e) => updateNested('widgetConfig', 'exitIntentMessage', e.target.value)}
                          placeholder="Wait! Before you leave, get an instant quote or ask our AI anything in 15 seconds."
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Voice Engine Settings Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                        <Volume2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle>Voice Engine & Text-to-Speech (TTS)</CardTitle>
                          <Badge variant="secondary">Interactive</Badge>
                        </div>
                        <CardDescription>
                          Configure default speech voice, speed, and pitch. Visitors can also customize voices directly within the widget!
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={testVoicePlayback}
                      disabled={isPlayingVoiceSample}
                    >
                      <Play className="h-3.5 w-3.5 text-primary" />
                      {isPlayingVoiceSample ? 'Playing...' : 'Test Voice'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Voice Persona</Label>
                    <Select
                      value={form.widgetConfig?.defaultVoiceName || 'default'}
                      onValueChange={(v) => updateNested('widgetConfig', 'defaultVoiceName', v === 'default' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="System Default (Natural / Neural)" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="default">✨ Auto / Neural Natural (Recommended)</SelectItem>
                        {browserVoices.map((voice) => (
                          <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Lists voices available in modern browsers (Google Neural, Microsoft, Apple, Siri, etc.).
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Speech Speed (Rate)</Label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {(form.widgetConfig?.defaultVoiceRate ?? 1.0).toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="1.4"
                        step="0.05"
                        value={form.widgetConfig?.defaultVoiceRate ?? 1.0}
                        onChange={(e) => updateNested('widgetConfig', 'defaultVoiceRate', parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Slower (0.75x)</span>
                        <span>Normal (1.0x)</span>
                        <span>Faster (1.4x)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Voice Pitch</Label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {(form.widgetConfig?.defaultVoicePitch ?? 1.0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.3"
                        step="0.05"
                        value={form.widgetConfig?.defaultVoicePitch ?? 1.0}
                        onChange={(e) => updateNested('widgetConfig', 'defaultVoicePitch', parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Deeper</span>
                        <span>Normal</span>
                        <span>Higher</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live preview */}
            <div className="space-y-4">
              <Card className="p-5">
                <p className="text-sm font-semibold">Live preview</p>
                <p className="mb-4 text-xs text-muted-foreground">Updates as you configure.</p>
                <div className="relative mx-auto w-full max-w-[260px] rounded-[26px] border-[6px] border-slate-900 bg-slate-100 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-slate-900 dark:bg-slate-700" />
                  <div className="flex h-[440px] flex-col overflow-hidden rounded-[20px]">
                    <div className="flex items-center justify-between px-3 py-3 text-white" style={{ background: primaryColor }}>
                      <div className="flex items-center gap-2 min-w-0">
                        {form.widgetConfig?.avatarUrl ? (
                          <img src={form.widgetConfig.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-white/40" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20"><Bot className="h-4 w-4" /></div>
                        )}
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[12px] font-semibold">{form.widgetConfig?.headerText || 'Chat with us'}</p>
                          <p className="text-[10px] opacity-80">Online now</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {form.widgetConfig?.whatsappEnabled && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm" title="WhatsApp Enabled">
                            <Phone className="h-3 w-3" />
                          </span>
                        )}
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white" title="Voice Settings">
                          <Volume2 className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-hidden bg-white p-3 dark:bg-slate-950">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        {form.welcomeMessage || 'Hi! How can I help you today?'}
                      </div>
                      <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md px-3 py-2 text-[11px] text-white" style={{ background: primaryColor }}>
                        I'd like to know more about pricing.
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        Sure — could I get your email or WhatsApp number so I can send the details?
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t bg-white px-3 py-2 dark:bg-slate-950">
                      <div className="flex-1 truncate rounded-full border bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400 dark:bg-slate-900">
                        {form.widgetConfig?.placeholder || 'Type a message...'}
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: primaryColor }}>
                        <Send className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'absolute -bottom-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg',
                      (form.widgetConfig?.position || 'bottom-right') === 'bottom-left' ? '-left-3' : '-right-3',
                    )}
                    style={{ background: primaryColor }}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              {form.widgetConfig?.proactivePromptEnabled !== false && (
                <div className="rounded-xl border border-dashed p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Nudge Bubble Preview</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {form.widgetConfig?.proactiveMessage || '👋 Hi! Need a quick custom quote or have questions?'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Handoff Tab */}
        <TabsContent value="handoff" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Human Handoff</CardTitle>
              <CardDescription>When and how conversations are routed to a real person.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className={cn('flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors', form.handoffConfig?.enabled ? 'border-primary/40 bg-primary/5' : '')}>
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', form.handoffConfig?.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                  <div>
                    <Label>Enable Handoff</Label>
                    <p className="text-xs text-muted-foreground">Allow bot to transfer conversation to a human agent</p>
                  </div>
                </div>
                <Switch checked={form.handoffConfig?.enabled || false} onCheckedChange={(v) => updateNested('handoffConfig', 'enabled', v)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Trigger Keywords <span className="text-xs font-normal text-muted-foreground">(comma-separated)</span></Label>
                  <Input
                    value={form.handoffConfig?.triggerKeywords?.join(', ') || ''}
                    onChange={(e) => updateNested('handoffConfig', 'triggerKeywords', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="speak to human, agent, help, operator"
                  />
                  {(form.handoffConfig?.triggerKeywords || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {form.handoffConfig.triggerKeywords.map((k: string) => (
                        <Badge key={k} variant="secondary" className="normal-case">{k}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={form.handoffConfig?.assignTo || ''} onValueChange={(v) => updateNested('handoffConfig', 'assignTo', v)}>
                    <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notify Channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {['in_app', 'email', 'sms', 'whatsapp'].map((ch) => {
                      const on = (form.handoffConfig?.notifyChannels || []).includes(ch);
                      return (
                        <label
                          key={ch}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                            on ? 'border-primary/40 bg-primary/5 text-primary' : 'hover:bg-accent/50',
                          )}
                        >
                          <Checkbox
                            checked={on}
                            onCheckedChange={(checked) => {
                              const channels = form.handoffConfig?.notifyChannels || [];
                              const updated = checked ? [...channels, ch] : channels.filter((c: string) => c !== ch);
                              updateNested('handoffConfig', 'notifyChannels', updated);
                            }}
                          />
                          <span className="capitalize">{ch.replace('_', ' ')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embed Code Tab */}
        <TabsContent value="embed" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>Add this code snippet before the closing &lt;/body&gt; tag on your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative overflow-hidden rounded-xl border bg-slate-950 text-slate-100 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] text-slate-400">index.html</span>
                  </div>
                  <Button size="xs" variant="secondary" className="bg-white/10 text-white hover:bg-white/20" onClick={copyEmbed}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed scrollbar-thin">{embedCode}</pre>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Agent ID</p>
                  <code className="text-xs text-muted-foreground">{id}</code>
                </div>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(id); toast.success('Agent ID copied'); }}>
                  <Copy className="h-3.5 w-3.5" /> Copy ID
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{form.name}&quot;? The widget will stop working.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
