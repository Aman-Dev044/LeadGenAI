'use client';
import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, Plus, X, Copy, Check } from 'lucide-react';
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

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // New lead capture field form
  const [newField, setNewField] = useState({ field: '', label: '', type: 'text', required: false, options: '' });

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

  if (isLoading || !form) return <Loading />;

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/agents')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Config</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="lead-capture">Lead Capture</TabsTrigger>
          <TabsTrigger value="widget">Widget</TabsTrigger>
          <TabsTrigger value="handoff">Handoff</TabsTrigger>
          <TabsTrigger value="embed">Embed Code</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <Textarea value={form.systemPrompt} onChange={(e) => update('systemPrompt', e.target.value)} rows={6} />
              </div>
              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input value={form.welcomeMessage || ''} onChange={(e) => update('welcomeMessage', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Config Tab */}
        <TabsContent value="ai" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>AI Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Input value={form.aiConfig?.model || ''} onChange={(e) => updateNested('aiConfig', 'model', e.target.value)} placeholder="gpt-4o" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Temperature ({form.aiConfig?.temperature ?? 0.7})</Label>
                  <input type="range" min="0" max="2" step="0.1" value={form.aiConfig?.temperature ?? 0.7} onChange={(e) => updateNested('aiConfig', 'temperature', parseFloat(e.target.value))} className="w-full" />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input type="number" value={form.aiConfig?.maxTokens || 1024} onChange={(e) => updateNested('aiConfig', 'maxTokens', parseInt(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Enabled Tools</CardTitle>
              <CardDescription>Select which capabilities this agent can use during conversations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_TOOLS.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{tool.label}</p>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  </div>
                  <Switch
                    checked={(form.enabledTools || []).includes(tool.id)}
                    onCheckedChange={() => toggleTool(tool.id)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Sources</CardTitle>
              <CardDescription>Select which knowledge sources this agent can access for answering questions</CardDescription>
            </CardHeader>
            <CardContent>
              {kbSources.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No knowledge sources yet. Add them from the Knowledge Base page.
                </p>
              ) : (
                <div className="space-y-3">
                  {kbSources.map((source: any) => (
                    <div key={source._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={(form.knowledgeSourceIds || []).includes(source._id)}
                          onCheckedChange={() => toggleKbSource(source._id)}
                        />
                        <div>
                          <p className="font-medium text-sm">{source.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{source.type}</Badge>
                            <Badge variant={source.status === 'completed' ? 'success' : source.status === 'failed' ? 'destructive' : 'default'} className="text-xs">{source.status}</Badge>
                            {source.chunkCount != null && <span className="text-xs text-muted-foreground">{source.chunkCount} chunks</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Capture Fields Tab */}
        <TabsContent value="lead-capture" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Capture Fields</CardTitle>
              <CardDescription>Configure which fields the widget collects from visitors before starting a chat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing fields */}
              {(form.leadCaptureFields || []).length > 0 && (
                <div className="space-y-2">
                  {(form.leadCaptureFields || []).map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">#{f.order + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{f.label} <span className="text-muted-foreground font-normal">({f.field})</span></p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{f.type}</Badge>
                            {f.required && <Badge variant="default" className="text-xs">Required</Badge>}
                            {f.options?.length > 0 && <span className="text-xs text-muted-foreground">Options: {f.options.join(', ')}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeField(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add new field */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Add Field</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Field Key</Label>
                    <Input placeholder="email" value={newField.field} onChange={(e) => setNewField({ ...newField, field: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input placeholder="Email Address" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
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
                    <div className="flex items-center h-9">
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
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="mr-2 h-3 w-3" /> Add Field
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Widget Tab */}
        <TabsContent value="widget" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Widget Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={form.widgetConfig?.primaryColor || '#3b82f6'} onChange={(e) => updateNested('widgetConfig', 'primaryColor', e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
                    <Input value={form.widgetConfig?.primaryColor || '#3b82f6'} onChange={(e) => updateNested('widgetConfig', 'primaryColor', e.target.value)} />
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
                <Input value={form.widgetConfig?.avatarUrl || ''} onChange={(e) => updateNested('widgetConfig', 'avatarUrl', e.target.value)} placeholder="https://example.com/avatar.png" />
                {form.widgetConfig?.avatarUrl && (
                  <img src={form.widgetConfig.avatarUrl} alt="Avatar" className="h-12 w-12 rounded-full object-cover border" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Handoff Tab */}
        <TabsContent value="handoff" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Human Handoff</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Handoff</Label>
                  <p className="text-xs text-muted-foreground">Allow bot to transfer conversation to a human agent</p>
                </div>
                <Switch checked={form.handoffConfig?.enabled || false} onCheckedChange={(v) => updateNested('handoffConfig', 'enabled', v)} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Trigger Keywords <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
                <Input
                  value={form.handoffConfig?.triggerKeywords?.join(', ') || ''}
                  onChange={(e) => updateNested('handoffConfig', 'triggerKeywords', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                  placeholder="speak to human, agent, help, operator"
                />
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
                <div className="flex flex-wrap gap-3">
                  {['in_app', 'email', 'sms', 'whatsapp'].map((ch) => (
                    <div key={ch} className="flex items-center gap-2">
                      <Checkbox
                        checked={(form.handoffConfig?.notifyChannels || []).includes(ch)}
                        onCheckedChange={(checked) => {
                          const channels = form.handoffConfig?.notifyChannels || [];
                          const updated = checked ? [...channels, ch] : channels.filter((c: string) => c !== ch);
                          updateNested('handoffConfig', 'notifyChannels', updated);
                        }}
                      />
                      <Label className="text-sm font-normal capitalize">{ch.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embed Code Tab */}
        <TabsContent value="embed" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>Add this code snippet before the closing &lt;/body&gt; tag on your website</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{embedCode}</pre>
                <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={copyEmbed}>
                  {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium mb-1">Agent ID</p>
                <code className="text-xs text-muted-foreground">{id}</code>
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
