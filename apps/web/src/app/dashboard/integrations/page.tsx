'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plug, Copy, Check, Send, Sparkles, Globe, MessageCircle,
  Share2, FileSpreadsheet, ShieldCheck, CheckCircle2, ArrowRight,
  Code2, ExternalLink, Linkedin, Briefcase,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/store/auth-store';

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: infoData, isLoading } = useQuery({
    queryKey: ['integrations-info'],
    queryFn: async () => {
      const res = await api.get<any>('/integrations/info');
      return res?.data?.data || res?.data || res;
    },
  });

  const testLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<any>('/integrations/test-lead', {
        lead: {
          name: 'Rahul Sharma',
          email: `rahul.lead.${Math.random().toString(36).substring(2, 7)}@example.com`,
          phone: '+91 98765 43210',
          company: 'Sharma Infotech Pvt Ltd',
          source: 'universal_webhook',
          notes: 'Interested in enterprise AI chatbot solution and pricing.',
        },
      });
      return res?.data || res;
    },
    onSuccess: (data) => {
      toast.success('Test lead successfully created!', {
        description: 'Lead "Rahul Sharma" with phone & email is now in your Leads table.',
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      toast.error('Failed to send test lead', {
        description: err?.message || 'Check your network connection and try again.',
      });
    },
  });

  const tenantId = infoData?.tenantId || user?.tenantId || 'YOUR_TENANT_ID';
  const apiBase = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000/api/v1`
    : 'http://localhost:4000/api/v1';

  const webhookUrl = infoData?.universalWebhookUrl || `${apiBase}/integrations/webhook/${tenantId}`;
  const metaWebhookUrl = infoData?.metaWebhookUrl || `${apiBase}/integrations/meta/webhook/${tenantId}`;
  const whatsAppWebhookUrl = infoData?.whatsAppWebhookUrl || `${apiBase}/integrations/whatsapp/webhook/${tenantId}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleJson = JSON.stringify(
    {
      name: 'Aman Verma',
      email: 'aman.verma@example.com',
      phone: '+91 9876543210',
      company: 'Growth Digital Ltd',
      source: 'google_form',
      notes: 'Looking for a demo call this Friday',
    },
    null,
    2,
  );

  const curlExample = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Aman Verma",
    "email": "aman.verma@example.com",
    "phone": "+91 9876543210",
    "company": "Growth Digital Ltd",
    "source": "landing_page",
    "notes": "Urgent quote requested"
  }'`;

  const googleAppsScriptCode = `// Paste this in your Google Form / Sheet Script Editor (Extensions > Apps Script)
function onFormSubmit(e) {
  var webhookUrl = "${webhookUrl}";
  var responses = e.namedValues || {};
  
  var payload = {
    name: (responses["Name"] || responses["Full Name"] || [""])[0],
    email: (responses["Email"] || responses["Email Address"] || [""])[0],
    phone: (responses["Phone"] || responses["Mobile"] || responses["Contact"] || [""])[0],
    company: (responses["Company"] || responses["Organization"] || [""])[0],
    source: "google_form",
    notes: "Submitted via Google Form on " + new Date().toLocaleString()
  };

  UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}`;

  const linkedInCurl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Priya Mehta",
    "email": "priya.mehta@enterprise.com",
    "phone": "+91 9811223344",
    "company": "Enterprise Cloud Solutions",
    "source": "linkedin_ads",
    "jobTitle": "VP of Technology",
    "linkedinUrl": "https://www.linkedin.com/in/priyamehta",
    "notes": "Submitted LinkedIn Lead Gen form for AI Sales Platform demo"
  }'`;

  const indeedCurl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Vikas Patel",
    "email": "vikas.patel@gmail.com",
    "phone": "+91 9988776655",
    "company": "Current Tech Co.",
    "source": "indeed",
    "jobTitle": "Senior Full Stack Engineer",
    "resume": "https://indeed.com/r/vikas-patel-resume.pdf",
    "notes": "Applied via Indeed with 6 years experience in Node & React"
  }'`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Ingestion Integrations"
        description="Automatically capture leads from external sources directly into your Leads CRM with name, email, and phone."
      >
        <Button
          onClick={() => testLeadMutation.mutate()}
          disabled={testLeadMutation.isPending}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
        >
          <Send className="h-4 w-4" />
          {testLeadMutation.isPending ? 'Sending Test...' : 'Send Test Lead'}
        </Button>
      </PageHeader>

      {/* Quick summary banner */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-950 dark:text-blue-200 text-sm">
                Instant Zero-Cost Multi-Channel Pipeline
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                All external leads automatically get scored (Hot/Warm/Cold), appear in your Leads dashboard, and trigger real-time alerts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white/80 dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-blue-200">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" />
              Auto Deduplication Active
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tabs for Integrations */}
      <Tabs defaultValue="universal" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="universal" className="gap-2">
            <Globe className="h-4 w-4" />
            Universal
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="gap-2">
            <Linkedin className="h-4 w-4 text-sky-600" />
            LinkedIn Ads
          </TabsTrigger>
          <TabsTrigger value="indeed" className="gap-2">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            Indeed / Jobs
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Share2 className="h-4 w-4 text-blue-600" />
            Meta Ads
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-amber-600" />
            Google Forms
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: Universal Webhook ─── */}
        <TabsContent value="universal" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Plug className="h-5 w-5 text-blue-600" />
                  Your Universal Inbound Webhook URL
                </h3>
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200">
                  Ready to receive
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Post JSON data to this endpoint from WordPress, Elementor, Typeform, Shopify, Zapier, Make, n8n, or any custom form.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border font-mono text-sm break-all">
              <span className="flex-1 text-slate-800 dark:text-slate-200">{webhookUrl}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(webhookUrl, 'webhookUrl')}
                className="shrink-0 gap-1.5"
              >
                {copiedKey === 'webhookUrl' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                Copy URL
              </Button>
            </div>

            {/* Field Mapping Guide */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Accepted Lead Fields</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Full Name / First & Last</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keys: <code className="text-pink-600">name</code>, <code className="text-pink-600">firstName</code>, <code className="text-pink-600">lastName</code>
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Email Address</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keys: <code className="text-pink-600">email</code>, <code className="text-pink-600">emailAddress</code>
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Phone Number</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keys: <code className="text-pink-600">phone</code>, <code className="text-pink-600">mobile</code>, <code className="text-pink-600">contact</code>
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Company Name</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keys: <code className="text-pink-600">company</code>, <code className="text-pink-600">organization</code>
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Lead Source</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keys: <code className="text-pink-600">source</code> (e.g. &quot;landing_page&quot;, &quot;elementor&quot;)
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-white dark:bg-slate-950">
                  <span className="font-semibold text-xs text-blue-600">Notes & Custom Fields</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Any extra parameters are automatically captured in custom fields.
                  </p>
                </div>
              </div>
            </div>

            {/* Code Examples */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  cURL Example
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(curlExample, 'curl')}
                  className="h-8 gap-1 text-xs"
                >
                  {copiedKey === 'curl' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy cURL
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto">
                {curlExample}
              </pre>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: Meta Ads ─── */}
        <TabsContent value="meta" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-600" />
                Meta (Facebook & Instagram) Lead Ads Webhook
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Receive Facebook and Instagram lead form submissions into your Leads CRM in under 5 seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Webhook Callback URL</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                  <span className="flex-1">{metaWebhookUrl}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(metaWebhookUrl, 'metaUrl')}>
                    {copiedKey === 'metaUrl' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Verify Token</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                  <span className="flex-1">{tenantId}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(tenantId, 'metaToken')}>
                    {copiedKey === 'metaToken' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">How to Connect Meta Ads (Zero Cost):</h4>
              <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li>Go to <strong className="text-foreground">developers.facebook.com</strong> and open your Meta App.</li>
                <li>Add the <strong className="text-foreground">Webhooks</strong> product and select <strong className="text-foreground">Page</strong>.</li>
                <li>Paste the Callback URL and Verify Token from above and click <strong className="text-foreground">Verify and Save</strong>.</li>
                <li>Subscribe to the <strong className="text-foreground">leadgen</strong> field.</li>
                <li>Done! When anyone submits a Facebook or Instagram Lead Ad form, it flows directly into your Leads table.</li>
              </ol>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: WhatsApp Cloud API ─── */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                Meta WhatsApp Business Cloud API
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Receive incoming WhatsApp chats as leads with verified phone number and sender name. Free 1,000 conversations/month from Meta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">WhatsApp Webhook Callback URL</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                  <span className="flex-1">{whatsAppWebhookUrl}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(whatsAppWebhookUrl, 'waUrl')}>
                    {copiedKey === 'waUrl' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Verify Token</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                  <span className="flex-1">{tenantId}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(tenantId, 'waToken')}>
                    {copiedKey === 'waToken' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">How to Connect WhatsApp Cloud API:</h4>
              <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li>In Meta Developer Portal, go to your WhatsApp App &gt; <strong className="text-foreground">Configuration</strong>.</li>
                <li>In the Webhook section, paste the Callback URL and Verify Token above.</li>
                <li>Click <strong className="text-foreground">Verify and Save</strong>, then click <strong className="text-foreground">Manage Webhook Fields</strong> and check <strong className="text-foreground">messages</strong>.</li>
                <li>Now, any visitor who texts your WhatsApp Business number automatically gets captured as a lead with their phone number and name!</li>
              </ol>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: Google Forms ─── */}
        <TabsContent value="google" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  Google Forms & Google Sheets (100% Free)
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect any Google Form to your Leads CRM using Google Apps Script without paying for Zapier.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(googleAppsScriptCode, 'appsScript')}
                className="gap-1.5"
              >
                {copiedKey === 'appsScript' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                Copy Apps Script
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">3-Step Setup Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                <li>Open your Google Sheet linked to the Google Form.</li>
                <li>Go to <strong className="text-foreground">Extensions &gt; Apps Script</strong>.</li>
                <li>Delete existing code, paste the script below, and click <strong className="text-foreground">Save (Floppy icon)</strong>.</li>
                <li>Click <strong className="text-foreground">Triggers (Alarm Clock icon on left) &gt; Add Trigger</strong>:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li>Function: <code className="text-pink-600">onFormSubmit</code></li>
                    <li>Event source: <strong className="text-foreground">From spreadsheet</strong></li>
                    <li>Event type: <strong className="text-foreground">On form submit</strong></li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                {googleAppsScriptCode}
              </pre>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 5: LinkedIn Lead Gen Ads ─── */}
        <TabsContent value="linkedin" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Linkedin className="h-5 w-5 text-sky-600" />
                  LinkedIn Lead Gen Ads & Prospecting
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically capture high-value B2B leads from LinkedIn Lead Gen Forms, InMail campaigns, and prospecting tools.
                </p>
              </div>
              <Badge className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200">
                B2B Lead Flow
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Inbound Webhook URL for LinkedIn</label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                <span className="flex-1">{webhookUrl}</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webhookUrl, 'liUrl')}>
                  {copiedKey === 'liUrl' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">How to Connect LinkedIn:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <span className="font-semibold text-xs text-sky-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Option 1: LinkedIn Lead Gen Ads
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Connect via <strong>Zapier, Make, or n8n</strong> using trigger <em>&quot;New Lead Gen Form Response in LinkedIn&quot;</em> and action <em>&quot;Webhook POST&quot;</em> to the URL above. Leads flow into CRM in 2 seconds.
                  </p>
                </div>
                <div className="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <span className="font-semibold text-xs text-sky-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Option 2: Apollo / Waalaxy / Prospecting
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set your LinkedIn automation tool (Apollo.io, Phantombuster, Waalaxy) to fire a webhook with name, email, company, and LinkedIn URL directly into this endpoint.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  cURL Payload Example
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(linkedInCurl, 'liCurl')}
                  className="h-8 gap-1 text-xs"
                >
                  {copiedKey === 'liCurl' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy cURL
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto">
                {linkedInCurl}
              </pre>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 6: Indeed / Candidate Ingestion ─── */}
        <TabsContent value="indeed" className="space-y-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                  Indeed Apply & Candidate Lead Capture
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ingest applicants and hiring leads directly from Indeed Apply or Indeed candidate email notifications.
                </p>
              </div>
              <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
                Talent & Hiring Leads
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Candidate Webhook Ingestion URL</label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border font-mono text-xs break-all">
                <span className="flex-1">{webhookUrl}</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webhookUrl, 'indeedUrl')}>
                  {copiedKey === 'indeedUrl' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">How to Connect Indeed:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <span className="font-semibold text-xs text-indigo-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Method A: Indeed Apply API (Direct ATS)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    In your Indeed Employer portal or ATS integration, set the webhook callback URL to the URL above. Applications post candidate name, phone, resume link, and job title.
                  </p>
                </div>
                <div className="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <span className="font-semibold text-xs text-indigo-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Method B: Indeed Email Forwarding
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When candidates apply, Indeed sends email alerts. Use Zapier Email Parser, Make, or Mailparser to auto-extract candidate details and push to this webhook.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Candidate Application cURL Example
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(indeedCurl, 'indeedCurl')}
                  className="h-8 gap-1 text-xs"
                >
                  {copiedKey === 'indeedCurl' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy cURL
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto">
                {indeedCurl}
              </pre>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
