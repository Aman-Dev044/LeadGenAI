'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Building2, Palette, Bot, Globe, Lock, Info, Bell } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { formatDate } from '@/lib/utils';
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

  if (isLoading) return <Loading />;

  const tenant = originalTenant || {};
  const availableModels = AI_MODELS[aiForm.aiProvider] || AI_MODELS.openai;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your organization settings" />

      {/* Tenant Info Banner */}
      {(tenant.slug || tenant.plan || tenant.status) && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-6 py-4 flex-wrap">
            {tenant.slug && (
              <div className="text-sm">
                <span className="text-muted-foreground">Slug: </span>
                <code className="font-mono bg-muted px-2 py-0.5 rounded">{tenant.slug}</code>
              </div>
            )}
            {tenant.plan && (
              <div className="text-sm">
                <span className="text-muted-foreground">Plan: </span>
                <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
              </div>
            )}
            {tenant.status && (
              <div className="text-sm">
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={tenant.status === 'active' ? 'success' : tenant.status === 'trial' ? 'warning' : 'secondary'} className="capitalize">{tenant.status}</Badge>
              </div>
            )}
            {tenant.trialEndsAt && (
              <div className="text-sm">
                <span className="text-muted-foreground">Trial Ends: </span>
                <span>{formatDate(tenant.trialEndsAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Organization</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="mr-1.5 h-3.5 w-3.5" /> Branding</TabsTrigger>
          <TabsTrigger value="ai"><Bot className="mr-1.5 h-3.5 w-3.5" /> AI & Preferences</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Lock className="mr-1.5 h-3.5 w-3.5" /> Security</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Update your organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <Input value={orgForm.logo} onChange={(e) => setOrgForm({ ...orgForm, logo: e.target.value })} placeholder="https://yourdomain.com/logo.png" />
                {orgForm.logo && (
                  <div className="mt-2 border rounded p-2 w-fit">
                    <img src={orgForm.logo} alt="Logo preview" className="h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Allowed Origins (comma-separated)</Label>
                <Input value={orgForm.allowedOrigins} onChange={(e) => setOrgForm({ ...orgForm, allowedOrigins: e.target.value })} placeholder="https://yoursite.com, https://app.yoursite.com" />
                <p className="text-xs text-muted-foreground">Domains where your chat widget is allowed to run</p>
              </div>
              <Button onClick={handleSaveOrg} disabled={updateTenantMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> {updateTenantMutation.isPending ? 'Saving...' : 'Save Organization'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Customize your widget appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                      className="flex-1"
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
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Input value={brandForm.fontFamily} onChange={(e) => setBrandForm({ ...brandForm, fontFamily: e.target.value })} placeholder="Inter, system-ui, sans-serif" />
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full" style={{ backgroundColor: brandForm.primaryColor }} />
                  <div className="w-10 h-10 rounded-full" style={{ backgroundColor: brandForm.secondaryColor }} />
                  <span style={{ fontFamily: brandForm.fontFamily || 'inherit' }} className="text-sm">
                    Sample text in your font
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveBranding} disabled={updateTenantMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> {updateTenantMutation.isPending ? 'Saving...' : 'Save Branding'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI & Preferences Tab */}
        <TabsContent value="ai" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Choose which AI provider and model powers your chatbot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>This controls which AI generates chatbot responses. Make sure the corresponding API key is configured in your environment variables.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Regional and language settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              <Button onClick={handleSaveAI} disabled={updateTenantMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> {updateTenantMutation.isPending ? 'Saving...' : 'Save AI & Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Alerts</CardTitle>
              <CardDescription>Who gets notified when the AI captures leads, flags hot leads or requests a human handoff</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Notify these roles (when no salesperson is assigned)</Label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: 'ADMIN', label: 'Admins' },
                    { value: 'SALES_MANAGER', label: 'Sales Managers' },
                    { value: 'SALESPERSON', label: 'Salespeople' },
                  ].map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={notifForm.notifyRoles.includes(r.value)}
                        onCheckedChange={(c) => toggleNotifyRole(r.value, c === true)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">In-app notifications are always sent. Assigned salespeople are always notified about their own leads.</p>
              </div>

              <div className="space-y-3">
                <Label>Email alerts</Label>
                {[
                  { key: 'emailOnNewLead', label: 'New lead captured' },
                  { key: 'emailOnHotLead', label: 'Lead becomes hot' },
                  { key: 'emailOnHandoff', label: 'Human handoff requested' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded border px-3 py-2">
                    <span className="text-sm">{item.label}</span>
                    <Switch
                      checked={(notifForm as any)[item.key]}
                      onCheckedChange={(v) => setNotifForm({ ...notifForm, [item.key]: v })}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Emails go out through the configured email provider (RESEND_API_KEY / EMAIL_FROM).</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Channel Integrations</CardTitle>
              <CardDescription>Post the same alerts to your team chat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Slack Incoming Webhook URL</Label>
                <Input
                  value={notifForm.slackWebhookUrl}
                  onChange={(e) => setNotifForm({ ...notifForm, slackWebhookUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Microsoft Teams Webhook URL</Label>
                <Input
                  value={notifForm.teamsWebhookUrl}
                  onChange={(e) => setNotifForm({ ...notifForm, teamsWebhookUrl: e.target.value })}
                  placeholder="https://outlook.office.com/webhook/..."
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>SMS and WhatsApp follow-ups to leads use the Twilio credentials configured in the API environment (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_NUMBER).</span>
              </div>
              <Button onClick={handleSaveNotifications} disabled={updateTenantMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> {updateTenantMutation.isPending ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password (min 8 characters)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>New Password (min 8 characters)</Label>
                <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword}
              >
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
