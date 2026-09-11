'use client';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, Database, Server, Cpu, Mail, MessageCircle, HardDrive, Radio, Wifi, Zap, Activity, Bot, Terminal, Globe,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { formatNumber } from '@/components/admin/admin-ui';
import { formatDate, cn } from '@/lib/utils';

function StatusPill({ ok, label, subtitle, icon: Icon }: { ok: boolean; label: string; subtitle?: string; icon?: any }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition-colors', ok ? 'bg-card hover:border-emerald-500/40' : 'bg-muted/30 border-dashed')}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{label}</p>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <Badge variant={ok ? 'success' : 'secondary'} dot className="shrink-0">{ok ? 'Configured' : 'Not set'}</Badge>
    </div>
  );
}

function DiagnosticRow({ k, v, highlight }: { k: string; v: any; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-xs last:border-0">
      <span className="text-muted-foreground font-medium">{k}</span>
      <span className={cn('font-mono text-right text-xs', highlight ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
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

  if (isLoading) return <Loading label="Checking system health" />;
  const s = data?.data || {};

  const isHealthy = s.database?.state === 'connected' && !s.runtime?.maintenanceMode;
  const memoryRss = s.memory?.rssMB || 0;
  const heapUsed = s.memory?.heapUsedMB || 0;
  const heapTotal = s.memory?.heapTotalMB || 1;
  const heapPct = Math.min(100, Math.round((heapUsed / heapTotal) * 100));
  const heapTone = heapPct >= 90 ? 'danger' : heapPct >= 70 ? 'warning' : 'primary';

  const collectionsObj: Record<string, number> = s.database?.collections || {};
  const collectionEntries = Object.entries(collectionsObj).sort((a, b) => b[1] - a[1]);
  const maxCollectionCount = Math.max(...Object.values(collectionsObj), 1);
  const totalDocs = Object.values(collectionsObj).reduce((a, b) => a + b, 0);

  const integrations = [
    { ok: !!s.integrations?.ai?.openaiConfigured, label: 'OpenAI', subtitle: s.integrations?.ai?.openaiConfigured ? `Embeddings: ${s.integrations?.ai?.embeddingModel}` : 'OPENAI_API_KEY missing', icon: Bot },
    { ok: !!s.integrations?.ai?.anthropicConfigured, label: 'Anthropic Claude', subtitle: s.integrations?.ai?.anthropicConfigured ? s.integrations?.ai?.anthropicModel : 'ANTHROPIC_API_KEY missing', icon: Bot },
    { ok: !!s.integrations?.email?.configured, label: `Email (${s.integrations?.email?.provider || 'SMTP'})`, subtitle: s.integrations?.email?.from ? `from: ${s.integrations?.email?.from}` : 'No sender configured', icon: Mail },
    { ok: !!s.integrations?.sms?.configured, label: 'Twilio SMS / WhatsApp', subtitle: s.integrations?.sms?.configured ? `SMS: ${s.integrations?.sms?.phone}` : 'Add TWILIO_* in env', icon: MessageCircle },
    { ok: !!s.integrations?.storage?.configured, label: `Storage (${s.integrations?.storage?.provider || 'S3'})`, subtitle: s.integrations?.storage?.configured ? `Bucket: ${s.integrations?.storage?.bucket}` : 'Local storage', icon: HardDrive },
  ];
  const configuredCount = integrations.filter((i) => i.ok).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner console"
        icon={Activity}
        title="System health"
        description="Real-time infrastructure health, database collections, external integrations, memory and runtime state."
        actions={
          <>
            <Badge variant={isHealthy ? 'success' : 'warning'} className="h-8 px-3">
              <span className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
              {isHealthy ? 'All systems operational' : 'Attention needed'}
            </Badge>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Engine uptime"
          value={fmtUptime(s.app?.uptimeSec)}
          icon={Server}
          tone="success"
          description={`Booted ${s.app?.startedAt ? formatDate(s.app.startedAt) : 'recently'}`}
        />
        <StatCard
          title="Memory (RSS)"
          value={`${memoryRss} MB`}
          icon={Cpu}
          tone={heapTone === 'danger' ? 'danger' : heapTone === 'warning' ? 'warning' : 'info'}
          description={`${heapUsed} / ${heapTotal} MB heap (${heapPct}%)`}
          footer={<Progress value={heapPct} tone={heapTone} className="h-1.5" />}
        />
        <StatCard
          title="Database"
          value={String(s.database?.state || 'connected').replace(/^\w/, (c) => c.toUpperCase())}
          icon={Database}
          tone={s.database?.state === 'connected' ? 'violet' : 'danger'}
          description={`${s.database?.stats?.dataSizeMB ?? 0} MB · ${s.database?.stats?.collections ?? 0} collections · ${s.database?.stats?.indexes ?? 0} indexes`}
        />
        <StatCard
          title="Live sockets"
          value={s.sockets?.onlineUsers ?? 0}
          icon={Wifi}
          tone="warning"
          description={`Redis cache: ${s.redis?.status || 'connected'}`}
          footer={
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" /> {s.redis?.status === 'disabled' ? 'Running without cache' : 'Cache online'}
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Integrations */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /> Integrations</CardTitle>
              <CardDescription>AI models, communication providers and object storage.</CardDescription>
            </div>
            <Badge variant="secondary" className="tabular">{configuredCount}/{integrations.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {integrations.map((i) => <StatusPill key={i.label} {...i} />)}
          </CardContent>
        </Card>

        {/* Collections */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Database storage</CardTitle>
              <CardDescription>{formatNumber(totalDocs)} documents across {collectionEntries.length} collections.</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono normal-case tracking-normal">{s.database?.name || 'ai_lead_gen'}</Badge>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
              {collectionEntries.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No collection stats available.</p>}
              {collectionEntries.map(([colName, count]) => {
                const pct = Math.max(3, Math.round(((count as number) / maxCollectionCount) * 100));
                return (
                  <div key={colName} className="group rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium">{colName}</span>
                      <span className="font-semibold tabular">{formatNumber(count as number)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Runtime */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Runtime diagnostics</CardTitle>
            <CardDescription>Node environment, server specs and active limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 px-4">
              <DiagnosticRow k="Platform version" v={`v${s.app?.version || '1.0.0'}`} highlight />
              <DiagnosticRow k="Node runtime" v={s.app?.node} highlight />
              <DiagnosticRow k="Operating system" v={`${s.app?.platform} (${s.app?.arch || 'x64'})`} />
              <DiagnosticRow k="Process PID" v={s.app?.pid} />
              <DiagnosticRow k="Environment" v={s.app?.env} highlight />
              <DiagnosticRow k="Maintenance mode" v={s.runtime?.maintenanceMode ? 'Active (traffic blocked)' : 'Disabled (serving)'} highlight={!!s.runtime?.maintenanceMode} />
              <DiagnosticRow k="Follow-up scheduler" v={s.runtime?.followUpScheduler ? `Active (every ${Math.round((s.runtime?.followUpPollMs || 60000) / 1000)}s)` : 'Disabled'} />
              <DiagnosticRow k="Swagger OpenAPI" v={s.runtime?.swagger ? 'Enabled (/api/docs)' : 'Disabled'} />
              <DiagnosticRow k="Rate limiting" v={`${s.runtime?.rateLimit?.max || 100} req / ${s.runtime?.rateLimit?.ttl || 60}s`} />
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> Authorized CORS origins
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(s.runtime?.corsOrigins || []).length === 0 && <span className="text-xs text-muted-foreground">None configured</span>}
                {(s.runtime?.corsOrigins || []).map((origin: string) => (
                  <Badge key={origin} variant="outline" className="bg-card font-mono text-[10px] normal-case tracking-normal">{origin}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
