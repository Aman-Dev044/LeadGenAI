'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ScrollText, Building2, Clock, Globe, Monitor, Timer, AlertCircle, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { Toolbar, SearchInput, ToolbarDivider } from '@/components/shared/toolbar';
import { formatDate, getInitials, cn } from '@/lib/utils';

/** Colour the action badge by its verb (create / update / delete / login ...). */
function actionVariant(action: string): 'success' | 'destructive' | 'warning' | 'info' | 'violet' | 'secondary' {
  const a = (action || '').toLowerCase();
  if (/(create|add|register|invite)/.test(a)) return 'success';
  if (/(delete|purge|remove|revoke|suspend)/.test(a)) return 'destructive';
  if (/(update|patch|edit|activate|reset)/.test(a)) return 'warning';
  if (/(login|logout|impersonat|auth)/.test(a)) return 'violet';
  if (/(export|download|read|search)/.test(a)) return 'info';
  return 'secondary';
}

function DetailRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium">{children}</span>
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', page, limit, search, status, from, to],
    queryFn: () => api.get<any>('/admin/audit-logs', {
      page, limit, search: search || undefined, status: status || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    }),
    refetchInterval: 30_000,
  });
  const rows: any[] = data?.data?.data || [];
  const meta = data?.data?.meta;

  const columns = [
    {
      key: 'createdAt', label: 'When', className: 'whitespace-nowrap',
      render: (a: any) => (
        <div className="text-xs">
          <p className="font-medium">{formatDate(a.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'action', label: 'Action', render: (a: any) => (
        <div className="min-w-0">
          <Badge variant={actionVariant(a.action)} className="font-mono normal-case tracking-normal">{a.action}</Badge>
          {a.details?.summary && <p className="mt-1 max-w-[380px] truncate text-xs text-muted-foreground">{a.details.summary}</p>}
        </div>
      ),
    },
    {
      key: 'user', label: 'Actor', render: (a: any) => a.user ? (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7"><AvatarFallback className="text-[9px]">{getInitials(a.user.name || 'U')}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{a.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{a.user.email} · {a.user.role}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"><Monitor className="h-3.5 w-3.5" /></div>
          <span className="text-xs text-muted-foreground">{a.details?.actorEmail || a.userId || 'system'}</span>
        </div>
      ),
    },
    {
      key: 'tenant', label: 'Tenant', render: (a: any) => a.tenantId ? (
        <Link
          href={`/dashboard/admin/tenants/${a.tenantId}`}
          className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{a.tenantName || a.tenantId}</span>
        </Link>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    { key: 'ip', label: 'IP', render: (a: any) => <span className="font-mono text-xs text-muted-foreground">{a.ip || '—'}</span> },
    {
      key: 'status', label: 'Status', render: (a: any) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={a.status === 'failure' ? 'destructive' : 'success'} dot>{a.status}</Badge>
          {a.details?.byOwner && <Badge variant="warning">owner</Badge>}
        </div>
      ),
    },
  ];

  const applySearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div>
      <PageHeader
        eyebrow="Owner console"
        icon={ScrollText}
        title="Audit logs"
        description="Every mutation across the platform, including owner-console actions and impersonations"
        actions={meta?.total !== undefined ? <Badge variant="secondary" className="h-8 px-3 text-xs tabular">{meta.total} entries</Badge> : undefined}
      />

      <Toolbar>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Action, resource, summary, IP…"
          onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
        />
        <Button variant="soft" size="sm" className="h-9" onClick={applySearch}><Search className="h-4 w-4" /> Search</Button>
        <ToolbarDivider />
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 w-[140px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 w-[140px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={rows}
        total={meta?.total || 0}
        page={page}
        limit={limit}
        totalPages={meta?.totalPages || 1}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isLoading}
        onRowClick={setDetail}
        emptyMessage="No audit entries"
        emptyDescription="Try widening the date range or clearing the filters."
      />

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><ScrollText className="h-4 w-4" /></span>
              <span className="font-mono text-base">{detail?.action}</span>
            </DialogTitle>
            <DialogDescription>Full record of this audit entry, including the raw details payload.</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={detail.status === 'failure' ? 'destructive' : 'success'} dot>{detail.status}</Badge>
                {detail.details?.byOwner && <Badge variant="warning">owner action</Badge>}
                {detail.resource && <Badge variant="outline" className="normal-case tracking-normal">{detail.resource}</Badge>}
              </div>
              <div className="rounded-xl border bg-muted/20 px-4">
                <DetailRow icon={Clock} label="When">{formatDate(detail.createdAt)}</DetailRow>
                <DetailRow icon={ScrollText} label="Resource">
                  {detail.resource} {detail.resourceId && <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{detail.resourceId}</code>}
                </DetailRow>
                <DetailRow icon={Monitor} label="Actor">{detail.user?.email || detail.details?.actorEmail || detail.userId || 'system'}</DetailRow>
                <DetailRow icon={Building2} label="Tenant">{detail.tenantName || detail.tenantId || '—'}</DetailRow>
                <DetailRow icon={Globe} label="IP / UA">
                  <span className="font-mono text-xs">{detail.ip || '—'}</span>
                  <span className="ml-2 text-xs text-muted-foreground break-all">{detail.userAgent || '—'}</span>
                </DetailRow>
                {detail.duration !== undefined && <DetailRow icon={Timer} label="Duration">{detail.duration} ms</DetailRow>}
              </div>
              {detail.errorMessage && (
                <div className={cn('flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400')}>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {detail.errorMessage}
                </div>
              )}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
                <pre className="max-h-[320px] overflow-auto rounded-lg bg-muted p-3 text-xs scrollbar-thin">{JSON.stringify(detail.details || {}, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
