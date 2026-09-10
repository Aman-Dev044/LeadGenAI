'use client';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Database,
  Server,
  Cpu,
  Mail,
  MessageCircle,
  HardDrive,
  Radio,
  CheckCircle2,
  XCircle,
  Wifi,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Bot,
  Flame,
  AlertTriangle,
  Clock,
  Terminal,
  Key,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/shared/loading';
import { formatNumber } from '@/components/admin/admin-ui';
import { formatDate, cn } from '@/lib/utils';

function StatusPill({ ok, label, subtitle }: { ok: boolean; label: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2 text-xs transition-colors hover:bg-card">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('flex h-2 w-2 shrink-0 rounded-full shadow-xs', ok ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-rose-500 ring-2 ring-rose-500/20')} />
        <span className="font-semibold text-foreground truncate">{label}</span>
      </div>
      {subtitle && <span className="text-[11px] text-muted-foreground truncate ml-2">{subtitle}</span>}
    </div>
  );
}

function DiagnosticRow({ k, v, highlight }: { k: string; v: any; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-xs last:border-0">
      <span className="text-muted-foreground font-medium">{k}</span>
      <span className={cn('font-mono text-xs', highlight ? 'font-bold text-foreground' : 'text-muted-foreground')}>
        {typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : String(v ?? '—')}
      </span>
    </div>
  );
}

const fmtUptime = (s?: number) => {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}d ` : ''}${h}h ${m}m`;
};

export default function AdminSystemPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: () => api.get<any>('/admin/system'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Loading />;
  const s = data?.data || {};

  const isHealthy = s.database?.state === 'connected' && !s.runtime?.maintenanceMode;
  const memoryRss = s.memory?.rssMB || 0;
  const heapUsed = s.memory?.heapUsedMB || 0;
  const heapTotal = s.memory?.heapTotalMB || 1;
  const heapPct = Math.min(100, Math.round((heapUsed / heapTotal) * 100));

  const collectionsObj: Record<string, number> = s.database?.collections || {};
  const collectionEntries = Object.entries(collectionsObj).sort((a, b) => b[1] - a[1]);
  const maxCollectionCount = Math.max(...Object.values(collectionsObj), 1);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">System Health & Telemetry</h1>
            <Badge
              variant="outline"
              className={cn(
                'font-bold text-xs flex items-center gap-1.5 px-2.5 py-0.5',
                isHealthy
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
              {isHealthy ? 'All Systems Operational' : 'Action / Maintenance Mode Active'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time infrastructure health, database collections, external integrations, memory utilization, and runtime state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="shadow-xs">
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            {isFetching ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Uptime */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engine Uptime</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{fmtUptime(s.app?.uptimeSec)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Booted {s.app?.startedAt ? formatDate(s.app.startedAt) : 'Recently'}
          </p>
        </div>

        {/* Memory Load */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Memory (RSS / Heap)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{memoryRss} MB</span>
            <span className="text-xs text-muted-foreground font-medium">({heapPct}% heap)</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${heapPct}%` }} />
          </div>
        </div>

        {/* Database */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Database Cluster</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground capitalize">
              {s.database?.state || 'Connected'}
            </span>
            <span className="text-xs text-muted-foreground font-medium">({s.database?.stats?.dataSizeMB ?? 0} MB)</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {s.database?.stats?.collections ?? 0} collections · {s.database?.stats?.indexes ?? 0} indexes
          </p>
        </div>

        {/* Real-time WebSockets & Redis */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Sockets & Cache</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Wifi className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">
              {s.sockets?.onlineUsers ?? 0} Online
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" /> Redis Cache: {s.redis?.status || 'Connected'}
          </p>
        </div>
      </div>

      {/* Main 3 Column Health Hub */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Col 1: Integrated Providers & External APIs */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Radio className="h-4 w-4 text-primary" /> Integrated Providers & AI
            </CardTitle>
            <CardDescription className="text-xs">
              Live status of AI models, communication providers, and object storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            {/* AI Providers */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Bot className="h-3.5 w-3.5 text-primary" /> AI Inference Engines
              </p>
              <div className="space-y-1.5">
                <StatusPill
                  ok={!!s.integrations?.ai?.openaiConfigured}
                  label="OpenAI GPT-4o"
                  subtitle={s.integrations?.ai?.openaiConfigured ? `Embeddings: ${s.integrations?.ai?.embeddingModel}` : 'Not configured'}
                />
                <StatusPill
                  ok={!!s.integrations?.ai?.anthropicConfigured}
                  label="Anthropic Claude"
                  subtitle={s.integrations?.ai?.anthropicConfigured ? s.integrations?.ai?.anthropicModel : 'Key not provided'}
                />
              </div>
            </div>

            {/* Email Providers */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-primary" /> Email Notifications ({s.integrations?.email?.provider || 'SMTP'})
              </p>
              <StatusPill
                ok={!!s.integrations?.email?.configured}
                label={s.integrations?.email?.configured ? `Connected (${s.integrations?.email?.provider})` : 'Unconfigured'}
                subtitle={s.integrations?.email?.from ? `from: ${s.integrations?.email?.from}` : ''}
              />
            </div>

            {/* Messaging & SMS */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5 text-primary" /> SMS & WhatsApp (Twilio)
              </p>
              <StatusPill
                ok={!!s.integrations?.sms?.configured}
                label={s.integrations?.sms?.configured ? 'Twilio Active' : 'Not configured'}
                subtitle={s.integrations?.sms?.configured ? `SMS: ${s.integrations?.sms?.phone}` : 'Add TWILIO_* in env'}
              />
            </div>

            {/* Storage */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5 text-primary" /> Object Storage ({s.integrations?.storage?.provider || 'S3'})
              </p>
              <StatusPill
                ok={!!s.integrations?.storage?.configured}
                label={s.integrations?.storage?.configured ? `Bucket: ${s.integrations?.storage?.bucket}` : 'Local storage'}
                subtitle={s.integrations?.storage?.endpoint || ''}
              />
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Database Collections & Data Volume */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Database className="h-4 w-4 text-primary" /> Database Storage
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono bg-muted/40">
                {s.database?.name || 'ai_lead_gen'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Live record volume across all collections on disk.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {collectionEntries.map(([colName, count]) => {
                const pct = Math.max(4, Math.round(((count as number) / maxCollectionCount) * 100));
                return (
                  <div key={colName} className="rounded-lg border bg-card/60 p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{colName}</span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formatNumber(count as number)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Col 3: Runtime Diagnostics & System Specs */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Terminal className="h-4 w-4 text-primary" /> Runtime Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">
              Node environment, server specifications, and active security limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="divide-y rounded-lg border bg-card/60 p-3">
              <DiagnosticRow k="Platform Version" v={`v${s.app?.version || '1.0.0'}`} highlight />
              <DiagnosticRow k="Node Runtime" v={s.app?.node} highlight />
              <DiagnosticRow k="Operating System" v={`${s.app?.platform} (${s.app?.arch || 'x64'})`} />
              <DiagnosticRow k="Process PID" v={s.app?.pid} />
              <DiagnosticRow k="Environment" v={s.app?.env} highlight />
              <DiagnosticRow
                k="Maintenance Mode"
                v={s.runtime?.maintenanceMode ? 'Active (Traffic Blocked)' : 'Disabled (Serving)'}
                highlight={!!s.runtime?.maintenanceMode}
              />
              <DiagnosticRow
                k="Follow-up Scheduler"
                v={s.runtime?.followUpScheduler ? `Active (Every ${Math.round((s.runtime?.followUpPollMs || 60000) / 1000)}s)` : 'Disabled'}
              />
              <DiagnosticRow k="Swagger OpenAPI" v={s.runtime?.swagger ? 'Enabled (/api/docs)' : 'Disabled'} />
              <DiagnosticRow
                k="Global Rate Limiting"
                v={`${s.runtime?.rateLimit?.max || 100} req / ${s.runtime?.rateLimit?.ttl || 60}s`}
              />
            </div>

            {/* Allowed CORS Origins */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Authorized CORS Origins
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(s.runtime?.corsOrigins || []).map((origin: string) => (
                  <Badge key={origin} variant="outline" className="font-mono text-[10px] bg-card">
                    {origin}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
