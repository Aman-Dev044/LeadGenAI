'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Building2, Palette, Bot, Lock, Info, Bell, Settings, Hash, CreditCard, CalendarClock, Sparkles, MessageSquare, KeyRound, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { formatDate, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
];

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
};

const TIMEZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
];

/** Card header with an icon tile - used by every settings section. */
function SectionHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-0.5">{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

function SaveFooter({ onClick, pending, label }: { onClick: () => void; pending: boolean; label: string }) {
  return (
    <CardFooter className="justify-end border-t bg-muted/30 py-3 mt-2 rounded-b-xl">
      <Button onClick={onClick} disabled={pending}>
        <Save className="h-4 w-4" /> {pending ? 'Saving...' : label}
      </Button>
    </CardFooter>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-muted-foreground">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
      <span>{children}</span>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Organization form
  const [orgForm, setOrgForm] = useState({ name: '', domain: '', allowedOrigins: '', logo: '' });

  // Branding form
  const [brandForm, setBrandForm] = useState({ primaryColor: '', secondaryColor: '', fontFamily: '' });

  // AI Settings form
  const [aiForm, setAiForm] = useState({ aiProvider: 'openai', aiModel: 'gpt-4o-mini', timezone: 'Asia/Kolkata', language: 'en' });

  // Notification settings form
  const [notifForm, setNotifForm] = useState({
    emailOnNewLead: true,
    emailOnHotLead: true,
    emailOnHandoff: true,
    slackWebhookUrl: '',
    teamsWebhookUrl: '',
    notifyRoles: ['ADMIN', 'SALES_MANAGER'] as string[],
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // Track original data for diffing
  const [originalTenant, setOriginalTenant] = useState<any>(null);

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<any>('/tenant'),
  });

  useEffect(() => {
    const tenant = (tenantData as any)?.data || {};
    if (tenant && tenant.name && !originalTenant) {
      setOriginalTenant(tenant);
      setOrgForm({
        name: tenant.name || '',
        domain: tenant.domain || '',
        allowedOrigins: (tenant.allowedOrigins || []).join(', '),
        logo: tenant.logo || '',
      });
      setBrandForm({
        primaryColor: tenant.branding?.primaryColor || '#3b82f6',
        secondaryColor: tenant.branding?.secondaryColor || '#64748b',
        fontFamily: tenant.branding?.fontFamily || '',
      });
      setAiForm({
        aiProvider: tenant.settings?.aiProvider || 'openai',
        aiModel: tenant.settings?.aiModel || 'gpt-4o-mini',
        timezone: tenant.settings?.timezone || 'Asia/Kolkata',
        language: tenant.settings?.language || 'en',
      });
      const ns = tenant.notificationSettings || {};
      setNotifForm({
        emailOnNewLead: ns.emailOnNewLead !== false,
        emailOnHotLead: ns.emailOnHotLead !== false,
        emailOnHandoff: ns.emailOnHandoff !== false,
        slackWebhookUrl: ns.slackWebhookUrl || '',
        teamsWebhookUrl: ns.teamsWebhookUrl || '',
        notifyRoles: Array.isArray(ns.notifyRoles) && ns.notifyRoles.length ? ns.notifyRoles : ['ADMIN', 'SALES_MANAGER'],
      });
    }
  }, [tenantData, originalTenant]);

  const updateTenantMutation = useMutation({
    mutationFn: (body: any) => api.patch('/tenant', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setOriginalTenant(null); // reset to re-read
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (body: any) => api.post('/auth/change-password', body),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSaveOrg = () => {
    const payload: Record<string, any> = {};
    if (orgForm.name.trim() !== (originalTenant?.name || '')) payload.name = orgForm.name.trim();
    if (orgForm.domain.trim() !== (originalTenant?.domain || '')) payload.domain = orgForm.domain.trim();
    if (orgForm.logo.trim() !== (originalTenant?.logo || '')) payload.logo = orgForm.logo.trim();
    const newOrigins = orgForm.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean);
    const oldOrigins = (originalTenant?.allowedOrigins || []).join(', ');
    if (orgForm.allowedOrigins.trim() !== oldOrigins) payload.allowedOrigins = newOrigins;
    if (Object.keys(payload).length === 0) { toast.info('No changes'); return; }
    updateTenantMutation.mutate(payload);
  };

  const handleSaveBranding = () => {
    const orig = originalTenant?.branding || {};
    const branding: Record<string, any> = {};
    if (brandForm.primaryColor !== (orig.primaryColor || '#3b82f6')) branding.primaryColor = brandForm.primaryColor;
    if (brandForm.secondaryColor !== (orig.secondaryColor || '#64748b')) branding.secondaryColor = brandForm.secondaryColor;
    if (brandForm.fontFamily.trim() !== (orig.fontFamily || '')) branding.fontFamily = brandForm.fontFamily.trim();
    if (Object.keys(branding).length === 0) { toast.info('No changes'); return; }
    updateTenantMutation.mutate({ branding: { ...orig, ...branding } });
  };

  const handleSaveAI = () => {
    const orig = originalTenant?.settings || {};
    const settings: Record<string, any> = {};
    if (aiForm.aiProvider !== (orig.aiProvider || 'openai')) settings.aiProvider = aiForm.aiProvider;
    if (aiForm.aiModel !== (orig.aiModel || 'gpt-4o-mini')) settings.aiModel = aiForm.aiModel;
    if (aiForm.timezone !== (orig.timezone || 'Asia/Kolkata')) settings.timezone = aiForm.timezone;
    if (aiForm.language !== (orig.language || 'en')) settings.language = aiForm.language;
    if (Object.keys(settings).length === 0) { toast.info('No changes'); return; }
    updateTenantMutation.mutate({ settings: { ...orig, ...settings } });
  };

  const handleSaveNotifications = () => {
    const isUrl = (v: string) => !v || /^https:\/\/.+/.test(v);
    if (!isUrl(notifForm.slackWebhookUrl)) { toast.error('Slack webhook must be an https:// URL'); return; }
    if (!isUrl(notifForm.teamsWebhookUrl)) { toast.error('Teams webhook must be an https:// URL'); return; }
    if (notifForm.notifyRoles.length === 0) { toast.error('Select at least one role to notify'); return; }
    updateTenantMutation.mutate({
      notificationSettings: {
        ...notifForm,
        slackWebhookUrl: notifForm.slackWebhookUrl.trim(),
        teamsWebhookUrl: notifForm.teamsWebhookUrl.trim(),
      },
    });
  };

  const toggleNotifyRole = (role: string, checked: boolean) => {
    setNotifForm((f) => ({
      ...f,
      notifyRoles: checked ? Array.from(new Set([...f.notifyRoles, role])) : f.notifyRoles.filter((r) => r !== role),
    }));
  };

  const handleChangePassword = () => {
    if (!passwordForm.currentPassword) { toast.error('Current password is required'); return; }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  if (isLoading) return <Loading label="Loading settings" />;

  const tenant = originalTenant || {};
  const availableModels = AI_MODELS[aiForm.aiProvider] || AI_MODELS.openai;
  const pending = updateTenantMutation.isPending;

  return (
    <div>
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Organization profile, widget branding, AI configuration, alerts and account security."
      />

      {/* Tenant Info Banner */}
      {(tenant.slug || tenant.plan || tenant.status) && (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/25">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">Workspace overview</p>
              </div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            {tenant.slug && (
              <div className="text-sm flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Slug</span>
                <code className="font-mono bg-muted px-2 py-0.5 rounded-md text-xs">{tenant.slug}</code>
              </div>
            )}
            {tenant.plan && (
              <div className="text-sm flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Plan</span>
                <Badge variant="default">{tenant.plan}</Badge>
              </div>
            )}
            {tenant.status && (
              <div className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge dot variant={tenant.status === 'active' ? 'success' : tenant.status === 'trial' ? 'warning' : 'secondary'}>{tenant.status}</Badge>
              </div>
            )}
            {tenant.trialEndsAt && (
              <div className="text-sm flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Trial ends</span>
                <span className="font-medium">{formatDate(tenant.trialEndsAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="organization">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="organization"><Building2 className="h-3.5 w-3.5" /> Organization</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5" /> Branding</TabsTrigger>
          <TabsTrigger value="ai"><Bot className="h-3.5 w-3.5" /> AI & Preferences</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Lock className="h-3.5 w-3.5" /> Security</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <SectionHeader icon={Building2} title="Organization Details" description="Name, domain and where your chat widget may be embedded." />
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input value={orgForm.domain} onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })} placeholder="yourdomain.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <div className="flex gap-3 items-start">
                  <Input value={orgForm.logo} onChange={(e) => setOrgForm({ ...orgForm, logo: e.target.value })} placeholder="https://yourdomain.com/logo.png" className="flex-1" />
                  {orgForm.logo && (
                    <div className="flex h-10 items-center rounded-lg border bg-muted/40 px-3">
                      <img src={orgForm.logo} alt="Logo preview" className="h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allowed Origins <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                <Input value={orgForm.allowedOrigins} onChange={(e) => setOrgForm({ ...orgForm, allowedOrigins: e.target.value })} placeholder="https://yoursite.com, https://app.yoursite.com" />
                <p className="text-xs text-muted-foreground">Domains where your chat widget is allowed to run.</p>
              </div>
            </CardContent>
            <SaveFooter onClick={handleSaveOrg} pending={pending} label="Save Organization" />
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <SectionHeader icon={Palette} title="Branding" description="Colours and typography used by the embedded chat widget." />
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={brandForm.primaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={brandForm.primaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={brandForm.secondaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, secondaryColor: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={brandForm.secondaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, secondaryColor: e.target.value })}
                      placeholder="#64748b"
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Input value={brandForm.fontFamily} onChange={(e) => setBrandForm({ ...brandForm, fontFamily: e.target.value })} placeholder="Inter, system-ui, sans-serif" />
              </div>

              {/* Preview */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-black/5" style={{ backgroundColor: brandForm.primaryColor }} />
                    <div className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-black/5" style={{ backgroundColor: brandForm.secondaryColor }} />
                  </div>
                  <div className="flex-1 min-w-[220px] rounded-xl border bg-card p-3 shadow-card" style={{ fontFamily: brandForm.fontFamily || 'inherit' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: brandForm.primaryColor }}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-semibold">Chat with us</span>
                    </div>
                    <div className="inline-block rounded-2xl rounded-bl-md px-3 py-1.5 text-xs" style={{ backgroundColor: brandForm.secondaryColor, color: '#fff' }}>Hi! How can I help you today?</div>
                    <div className="mt-1.5 flex justify-end">
                      <div className="inline-block rounded-2xl rounded-br-md px-3 py-1.5 text-xs text-white" style={{ backgroundColor: brandForm.primaryColor }}>Sample text in your font</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <SaveFooter onClick={handleSaveBranding} pending={pending} label="Save Branding" />
          </Card>
        </TabsContent>

        {/* AI & Preferences Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <SectionHeader icon={Sparkles} title="AI Configuration" description="Choose which AI provider and model powers your chatbot." />
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={aiForm.aiProvider} onValueChange={(v) => {
                    const models = AI_MODELS[v] || [];
                    setAiForm({ ...aiForm, aiProvider: v, aiModel: models[0]?.value || '' });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select value={aiForm.aiModel} onValueChange={(v) => setAiForm({ ...aiForm, aiModel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <InfoNote>This controls which AI generates chatbot responses. Make sure the corresponding API key is configured in your environment variables.</InfoNote>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader icon={Bot} title="Preferences" description="Regional and language settings used across the workspace." />
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={aiForm.timezone} onValueChange={(v) => setAiForm({ ...aiForm, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={aiForm.language} onValueChange={(v) => setAiForm({ ...aiForm, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <SaveFooter onClick={handleSaveAI} pending={pending} label="Save AI & Preferences" />
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <SectionHeader icon={Bell} title="Team Alerts" description="Who gets notified when the AI captures leads, flags hot leads or requests a human handoff." />
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Notify these roles <span className="text-muted-foreground font-normal">(when no salesperson is assigned)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'ADMIN', label: 'Admins' },
                    { value: 'SALES_MANAGER', label: 'Sales Managers' },
                    { value: 'SALESPERSON', label: 'Salespeople' },
                  ].map((r) => {
                    const checked = notifForm.notifyRoles.includes(r.value);
                    return (
                      <label
                        key={r.value}
                        className={cn(
                          'flex items-center gap-2 text-sm cursor-pointer rounded-lg border px-3 py-2 transition-colors',
                          checked ? 'border-primary/40 bg-primary/5 text-primary font-medium' : 'hover:bg-accent',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => toggleNotifyRole(r.value, c === true)}
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">In-app notifications are always sent. Assigned salespeople are always notified about their own leads.</p>
              </div>

              <div className="space-y-3">
                <Label>Email alerts</Label>
                <div className="divide-y rounded-xl border">
                  {[
                    { key: 'emailOnNewLead', label: 'New lead captured', hint: 'Every time the widget or API creates a lead' },
                    { key: 'emailOnHotLead', label: 'Lead becomes hot', hint: 'When scoring moves a lead into the hot bucket' },
                    { key: 'emailOnHandoff', label: 'Human handoff requested', hint: 'A visitor asks for a person or the AI escalates' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.hint}</p>
                      </div>
                      <Switch
                        checked={(notifForm as any)[item.key]}
                        onCheckedChange={(v) => setNotifForm({ ...notifForm, [item.key]: v })}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Emails go out through the configured email provider (RESEND_API_KEY / EMAIL_FROM).</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader icon={MessageSquare} title="Channel Integrations" description="Post the same alerts to your team chat." />
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Slack Incoming Webhook URL</Label>
                  <Input
                    value={notifForm.slackWebhookUrl}
                    onChange={(e) => setNotifForm({ ...notifForm, slackWebhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Microsoft Teams Webhook URL</Label>
                  <Input
                    value={notifForm.teamsWebhookUrl}
                    onChange={(e) => setNotifForm({ ...notifForm, teamsWebhookUrl: e.target.value })}
                    placeholder="https://outlook.office.com/webhook/..."
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <InfoNote>SMS and WhatsApp follow-ups to leads use the Twilio credentials configured in the API environment (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_NUMBER).</InfoNote>
            </CardContent>
            <SaveFooter onClick={handleSaveNotifications} pending={pending} label="Save Notification Settings" />
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <SectionHeader icon={KeyRound} title="Change Password" description={`Update the password for ${user?.email || 'your account'}. Minimum 8 characters.`} />
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/30 py-3 mt-2 rounded-b-xl">
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword}
              >
                <Lock className="h-4 w-4" /> {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
