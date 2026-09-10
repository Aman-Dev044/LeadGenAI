'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ScrollText } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { formatDate } from '@/lib/utils';

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
    { key: 'createdAt', label: 'When', render: (a: any) => <span className="text-xs whitespace-nowrap">{formatDate(a.createdAt)}</span> },
    {
      key: 'action', label: 'Action', render: (a: any) => (
        <div>
          <p className="font-mono text-xs">{a.action}</p>
          {a.details?.summary && <p className="text-xs text-muted-foreground max-w-[360px] truncate">{a.details.summary}</p>}
        </div>
      ),
    },
    {
      key: 'user', label: 'Actor', render: (a: any) => a.user ? (
        <div>
          <p className="text-sm">{a.user.name}</p>
          <p className="text-xs text-muted-foreground">{a.user.email} · {a.user.role}</p>
        </div>
      ) : <span className="text-xs text-muted-foreground">{a.details?.actorEmail || a.userId || 'system'}</span>,
    },
    {
      key: 'tenant', label: 'Tenant', render: (a: any) => a.tenantId ? (
        <Link href={`/dashboard/admin/tenants/${a.tenantId}`} className="text-sm hover:underline" onClick={(e) => e.stopPropagation()}>{a.tenantName || a.tenantId}</Link>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    { key: 'ip', label: 'IP', render: (a: any) => <span className="font-mono text-xs">{a.ip || '—'}</span> },
    {
      key: 'status', label: 'Status', render: (a: any) => (
        <div className="flex items-center gap-2">
          <Badge variant={a.status === 'failure' ? 'destructive' : 'success'}>{a.status}</Badge>
          {a.details?.byOwner && <Badge variant="warning">owner</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit logs" description="Every mutation across the platform, including owner-console actions and impersonations" />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          <Input placeholder="Action, resource, summary, IP..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-[280px]" onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
          <Button variant="outline" size="icon" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
        </div>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[160px]" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[160px]" />
      </div>

      <DataTable columns={columns} data={rows} total={meta?.total || 0} page={page} limit={limit} totalPages={meta?.totalPages || 1} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} onRowClick={setDetail} emptyMessage="No audit entries" />

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> {detail?.action}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">When:</span> {formatDate(detail.createdAt)}</p>
              <p><span className="text-muted-foreground">Resource:</span> {detail.resource} {detail.resourceId && <code className="rounded bg-muted px-1 text-xs">{detail.resourceId}</code>}</p>
              <p><span className="text-muted-foreground">Actor:</span> {detail.user?.email || detail.details?.actorEmail || detail.userId || 'system'}</p>
              <p><span className="text-muted-foreground">Tenant:</span> {detail.tenantName || detail.tenantId || '—'}</p>
              <p><span className="text-muted-foreground">IP / UA:</span> {detail.ip || '—'} · <span className="text-xs">{detail.userAgent || '—'}</span></p>
              {detail.duration !== undefined && <p><span className="text-muted-foreground">Duration:</span> {detail.duration} ms</p>}
              {detail.errorMessage && <p className="text-destructive">{detail.errorMessage}</p>}
              <pre className="max-h-[320px] overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(detail.details || {}, null, 2)}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
