import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  Database,
  UserCheck,
  Server,
  FileText,
  Mail,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Bot,
  Layers,
  Globe,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Privacy Policy | LeadAI',
  description: 'Learn how LeadAI collects, protects, processes, and safeguards your customer leads, conversational data, and organizational privacy.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'September 14, 2026';

  const highlights = [
    {
      icon: EyeOff,
      title: 'Zero Training on Customer Data',
      description:
        'We never use your organization’s conversations, lead records, or uploaded knowledge documents to train public or foundational AI models.',
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    },
    {
      icon: Lock,
      title: 'AES-256 & TLS 1.3 Encryption',
      description:
        'All database records are encrypted at rest with AES-256 and transmitted securely with TLS 1.3 over modern cryptographic ciphers.',
      color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    },
    {
      icon: Database,
      title: 'Strict Multi-Tenant Isolation',
      description:
        'Tenant data is logically separated using strict database tenant guards, preventing cross-tenant leakage or unauthorized access.',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      icon: UserCheck,
      title: 'GDPR & CCPA Compliant',
      description:
        'Full compliance with global privacy standards, granting leads and users complete rights to data export, rectification, and erasure.',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
  ];

  const sections = [
    { id: 'introduction', title: '1. Introduction & Scope' },
    { id: 'data-collection', title: '2. Information We Collect' },
    { id: 'ai-transparency', title: '3. AI & Large Language Model Transparency' },
    { id: 'data-usage', title: '4. How We Use Your Data' },
    { id: 'tenant-isolation', title: '5. Multi-Tenancy & Data Segregation' },
    { id: 'security', title: '6. Security & Encryption Standards' },
    { id: 'retention-erasure', title: '7. Data Retention & Erasure' },
    { id: 'user-rights', title: '8. Your Rights (GDPR / CCPA / DPDP)' },
    { id: 'cookies-widgets', title: '9. Cookies & Chatbot Widget Data' },
    { id: 'contact', title: '10. Contact Our Privacy Team' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <span>LeadAI</span>
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs py-0.5 font-medium text-muted-foreground">
              Privacy & Legal
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </Button>
            <Button variant="gradient" size="sm" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative border-b bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge variant="info" className="gap-1.5 py-1 px-3 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Enterprise Privacy Policy
              </Badge>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Privacy Policy & Data Protection
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Your trust is our highest priority. This policy outlines how LeadAI safeguards your business information,
                conversations, visitor interactions, and qualified leads.
              </p>
            </div>
            <div className="rounded-2xl border bg-card/80 p-4 shadow-xs backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Document Status</p>
              <p className="mt-1 font-semibold text-foreground">Official Platform Policy</p>
              <p className="text-xs text-muted-foreground mt-0.5">Last updated: {lastUpdated}</p>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h, i) => {
              const Icon = h.icon;
              return (
                <Card key={i} className="border bg-card/60 backdrop-blur transition-all hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', h.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-3 text-base font-semibold">{h.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">{h.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          {/* Table of Contents - Desktop Sticky Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-xs">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" /> Table of Contents
              </p>
              <nav className="mt-4 space-y-1 text-sm">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>

              <div className="mt-6 border-t pt-4">
                <p className="text-xs font-semibold">Have questions?</p>
                <p className="text-[11px] text-muted-foreground mt-1">Our privacy team responds within 24 hours.</p>
                <a
                  href="mailto:info.cyberbells@gmail.com"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Mail className="h-3 w-3" /> info.cyberbells@gmail.com
                </a>
              </div>
            </div>
          </aside>

          {/* Legal Text Body */}
          <div className="lg:col-span-3 space-y-12 leading-relaxed text-foreground/90">
            {/* Section 1 */}
            <section id="introduction" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> 1. Introduction & Scope
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Welcome to <strong>LeadAI</strong> (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). LeadAI provides an enterprise-grade AI-powered lead generation, visitor qualification, customer engagement, and conversation automation service.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Privacy Policy applies to all services, software applications, chat widgets, administrative dashboards, and APIs offered by LeadAI. By accessing or using our platform, you acknowledge that you have read and agree to the practices described herein.
              </p>
            </section>

            {/* Section 2 */}
            <section id="data-collection" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> 2. Information We Collect
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We collect information strictly necessary to provide intelligent lead qualification, appointment booking, and customer support. The categories of information collected include:
              </p>

              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">A. Workspace Account Data</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Administrator and user credentials including full name, business email address, hashed passwords, workspace organization name, and billing details.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">B. Visitor & Lead Information</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Information provided by website visitors during chat conversations, such as name, email address, phone number, company name, requirements, and scheduled appointment slots.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">C. Conversational Transcripts</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Full text messages exchanged between website visitors and automated AI agents or human sales representatives, stored for review, lead scoring, and CRM integration.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">D. Technical & Telemetry Data</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    IP address, approximate geographic location, browser user agent, referring URL, timestamp, and device type to safeguard against spam and abuse.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="ai-transparency" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> 3. AI & Large Language Model Transparency
              </h2>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Strict Zero Data Retention Guarantee with AI Providers</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      We process AI conversations via enterprise endpoints (e.g. OpenAI Enterprise / Anthropic API). Under our enterprise business terms:
                    </p>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span><strong>No Training:</strong> AI providers do not use your inputs, prompts, or chat transcripts to train their models.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span><strong>Zero Retention:</strong> Prompts sent to LLMs are ephemeral and are not persistently stored by LLM providers.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span><strong>Knowledge Isolation:</strong> Your proprietary knowledge base documents are indexed exclusively for your tenant.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="data-usage" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> 4. How We Use Your Data
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                LeadAI utilizes collected data solely for the following commercial purposes:
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
                <li>Automating live responses to your prospective customers through tailored conversational agents.</li>
                <li>Calculating engagement and purchase-intent Lead Scores (Cold, Warm, Hot) to prioritize sales outreach.</li>
                <li>Dispatching immediate notifications (Email, SMS, WhatsApp, Webhooks) when qualified leads submit details.</li>
                <li>Syncing lead records to your connected CRM, Google Sheets, or third-party webhooks.</li>
                <li>Preventing malicious traffic, bot spam, and denial-of-service attempts.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="tenant-isolation" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> 5. Multi-Tenancy & Data Segregation
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                LeadAI is built upon a secure, multi-tenant architecture. Every tenant workspace operates in an isolated logical boundary:
              </p>
              <div className="rounded-xl border bg-card p-4 space-y-2 text-xs text-muted-foreground">
                <p><strong>Database Tenant Guards:</strong> Every database read, write, query, and aggregation automatically enforces a mandatory <code className="text-primary font-mono font-semibold">tenantId</code> scope. Cross-workspace data leakage is strictly prevented at the core driver layer.</p>
                <p><strong>Role-Based Access:</strong> Within a tenant, users are partitioned into <strong>Admin</strong> (full management) and <strong>Salesperson</strong> (individual lead management), guaranteeing internal least-privilege access.</p>
              </div>
            </section>

            {/* Section 6 */}
            <section id="security" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" /> 6. Security & Encryption Standards
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We employ defense-in-depth security measures to protect stored information:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                <div className="rounded-xl border p-3.5 bg-card">
                  <p className="font-semibold text-foreground">Encryption at Rest</p>
                  <p className="mt-1">All primary MongoDB databases, logs, and backups are encrypted at rest using industry-standard AES-256 encryption.</p>
                </div>
                <div className="rounded-xl border p-3.5 bg-card">
                  <p className="font-semibold text-foreground">Encryption in Transit</p>
                  <p className="mt-1">All communications between web clients, customer websites, embed widgets, and our cloud APIs require HTTPS with TLS 1.3.</p>
                </div>
                <div className="rounded-xl border p-3.5 bg-card">
                  <p className="font-semibold text-foreground">Credential Security</p>
                  <p className="mt-1">Passwords are salted and cryptographically hashed with Bcrypt (cost factor 12). Plaintext passwords are never stored or logged.</p>
                </div>
                <div className="rounded-xl border p-3.5 bg-card">
                  <p className="font-semibold text-foreground">API Token Hashing</p>
                  <p className="mt-1">Third-party integration keys and Webhook tokens are stored using irreversible cryptographic digests.</p>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section id="retention-erasure" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> 7. Data Retention & Erasure
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We retain your workspace leads and conversation records for as long as your account remains active. If a workspace subscription is terminated:
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
                <li>You may export all leads and conversation records in CSV/JSON format at any time directly from the dashboard.</li>
                <li>Upon verified workspace deletion request, all tenant records, agents, knowledge base vectors, and leads are purged from active databases within 30 days.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="user-rights" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" /> 8. Your Rights (GDPR & CCPA)
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Depending on your jurisdiction, data subjects possess fundamental rights regarding their personal data:
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <div className="rounded-lg border bg-muted/10 p-3">
                  <strong>Right to Access:</strong> Request a copy of all personal records held about you.
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete contact data.
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <strong>Right to Erasure:</strong> Request permanent deletion of your information (&quot;Right to be Forgotten&quot;).
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <strong>Right to Restrict Processing:</strong> Limit how we process your personal data in certain scenarios.
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section id="cookies-widgets" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> 9. Cookies & Chatbot Widget Data
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our lightweight embeddable chat widget utilizes localized browser storage (LocalSession storage) strictly to maintain continuity of the visitor’s conversation while navigating between pages on your website. We do not use intrusive cross-site third-party tracking cookies or sell visitor browsing history to advertisement networks.
              </p>
            </section>

            {/* Section 10 */}
            <section id="contact" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> 10. Contact Our Privacy & Legal Team
              </h2>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you have questions regarding this Privacy Policy, wish to exercise your data subject rights, or require a Data Processing Addendum (DPA) for your organization, please contact our designated Data Protection Officer:
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">LeadAI Legal & Compliance</p>
                    <p className="text-xs text-muted-foreground">Data Protection Office</p>
                  </div>
                  <div className="h-4 w-px bg-border hidden sm:block" />
                  <div>
                    <a href="mailto:info.cyberbells@gmail.com" className="font-medium text-primary hover:underline flex items-center gap-1.5">
                      <Mail className="h-4 w-4" /> info.cyberbells@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/60 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} LeadAI Inc. All rights reserved. Enterprise AI Lead Generation Platform.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="font-semibold text-foreground hover:underline">Privacy Policy</Link>
            <span>·</span>
            <Link href="/dashboard/settings" className="hover:underline">Workspace Settings</Link>
            <span>·</span>
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
