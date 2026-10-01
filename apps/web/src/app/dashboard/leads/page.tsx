'use client';
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Download, Upload, Flame, CheckSquare, X, FileSpreadsheet, ExternalLink, LayoutGrid, List, AlertTriangle, Bot } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { perms } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, SearchInput, ToolbarDivider } from '@/components/shared/toolbar';
import { TablePagination, TableSkeleton } from '@/components/shared/data-table';
import type { Lead, PaginatedResponse } from '@/types';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { LEAD_STATUSES, statusLabel, statusTone } from '@/lib/pipeline';
import { PipelineBoard, FollowUpCell } from '@/components/leads/pipeline-board';

const tempColors: Record<string, 'destructive' | 'warning' | 'info'> = {
  hot: 'destructive',
  warm: 'warning',
  cold: 'info',
};

function ScoreBar({ score }: { score: number }) {
  const s = Number(score) || 0;
  return (
    <div className="flex items-center gap-2">
      <Progress value={s} className="h-1.5 w-16" tone={s >= 70 ? 'success' : s >= 40 ? 'warning' : 'danger'} />
      <span className="tabular text-xs font-semibold">{s}</span>
    </div>
  );
}

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', company: '', source: '', status: '', temperature: '', tags: '', requirement: '' };

export default function LeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const impersonation = useAuthStore((s) => s.impersonation);
  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;
  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants-list'],
    queryFn: async () => {
      const res: any = await api.get('/admin/tenants?limit=100');
      return res?.data?.data || res?.data || [];
    },
    enabled: !!isOwner,
  });
  const tenantMap = useMemo(() => {
    const map = new Map<string, any>();
    (tenantsData || []).forEach((t: any) => {
      if (!t.isPlatformOwner && t.slug !== 'owner' && !t.name?.toLowerCase().includes('platform owner')) {
        map.set(t._id, t);
      }
    });
    return map;
  }, [tenantsData]);

  const role = user?.role;
  const canCreate = perms.createLead(role);
  const canDelete = perms.deleteLead(role);
  const canBulkAssign = perms.bulkAssignLeads(role);
  const canImportExport = perms.importExportLeads(role);
  const isSalesperson = perms.isSalesperson(role);
  const canSelect = canBulkAssign || canCreate;
  const tableCols = 8 + (canSelect ? 1 : 0) + (canDelete ? 1 : 0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [followUp, setFollowUp] = useState<string>('');
  const [view, setView] = useState<'table' | 'pipeline'>('table');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Bulk assign
  const [selected, setSelected] = useState<string[]>([]);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // CSV Import
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTenantId = useAuthStore((s) => s.activeTenantId);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', activeTenantId, page, limit, search, status, temperature, source, followUp],
    queryFn: () => api.get<PaginatedResponse<Lead>['data']>('/leads', {
      page, limit, search: search || undefined,
      status: status || undefined,
      temperature: temperature || undefined,
      source: source || undefined,
      followUp: followUp || undefined,
    }),
    enabled: view === 'table',
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['leads-pipeline', activeTenantId],
    queryFn: () => api.get<any>('/leads/pipeline'),
    enabled: view === 'pipeline',
    refetchInterval: view === 'pipeline' ? 15_000 : false,
  });
  const pipeline = (pipelineData as any)?.data || {};

  const stageMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/leads/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead moved');
    },
    onError: (err: any) => toast.error(err.message || 'Could not move lead'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable', activeTenantId],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/leads', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      setForm(emptyForm);
      toast.success('Lead created successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setDeleteId(null);
      toast.success('Lead deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete lead'),
  });

  // Bulk AI call
  const [showBulkCall, setShowBulkCall] = useState(false);
  const [bulkCallWhen, setBulkCallWhen] = useState<'now' | 'later'>('now');
  const [bulkCallAt, setBulkCallAt] = useState('');
  const bulkCallMutation = useMutation({
    mutationFn: (body: { leadIds: string[]; at?: string }) => api.post<any>('/calling/bulk-call', body),
    onSuccess: (res: any) => {
      const r = res?.data || res || {};
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      setSelected([]);
      setShowBulkCall(false);
      const why = r.reasons && Object.keys(r.reasons).length ? ` (${Object.entries(r.reasons).map(([k, v]) => `${v} ${k}`).join(', ')})` : '';
      toast.success(`AI will call ${r.queued || 0} lead${r.queued === 1 ? '' : 's'}${bulkCallWhen === 'later' ? ' at the scheduled time' : ' now, one by one'}${r.skipped ? ` · ${r.skipped} skipped${why}` : ''}`, { duration: 7000 });
    },
    onError: (err: any) => toast.error(err.message || 'Could not queue the calls'),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (body: { leadIds: string[]; assignTo: string }) => api.post('/leads/bulk/assign', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelected([]);
      setShowBulkAssign(false);
      setAssignTo('');
      toast.success('Leads assigned successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to assign leads'),
  });

  const importMutation = useMutation({
    mutationFn: (formData: FormData) => api.upload<any>('/leads/import/csv', formData),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowImport(false);
      const result = data?.data || data;
      toast.success(
        `Imported ${result.imported} leads, ${result.skipped} skipped${result.callsQueued ? ` · AI will call ${result.callsQueued} of them one by one` : ''}`,
        { duration: 6000 },
      );
      if (result.errors?.length > 0) {
        toast.error(`${result.errors.length} errors during import`);
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to import the sheet'),
  });
  const [importAutoCall, setImportAutoCall] = useState(true);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (temperature) params.set('temperature', temperature);
      if (source) params.set('source', source);
      const qs = params.toString();

      const token = localStorage.getItem('accessToken');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiBase}/leads/export/csv${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Leads exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('autoCall', importAutoCall ? 'true' : 'false');
    importMutation.mutate(formData);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const leads = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;
  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];

  const allSelected = leads.length > 0 && leads.every((l: Lead) => selected.includes(l._id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(leads.map((l: Lead) => l._id));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleCreate = () => {
    const payload: Record<string, any> = {};
    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.company.trim()) payload.company = form.company.trim();
    if (form.source.trim()) payload.source = form.source.trim();
    if (form.status) payload.status = form.status;
    if (form.temperature) payload.temperature = form.temperature;
    if (form.tags.trim()) payload.tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (form.requirement.trim()) payload.customFields = { requirement: form.requirement.trim() };

    if (!payload.firstName && !payload.email) {
      toast.error('Please enter at least a name or email');
      return;
    }
    createMutation.mutate(payload);
  };

  const leadName = (l: Lead) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed lead';
  const hotOnPage = leads.filter((l: Lead) => l.temperature === 'hot').length;
  const workingOnPage = leads.filter((l: Lead) => ['interested', 'follow_up', 'meeting'].includes(l.status)).length;
  const overdueOnPage = leads.filter((l: Lead) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < Date.now()).length;

  return (
    <div>
      <PageHeader
        title="Leads"
        description={
          isSalesperson
            ? 'The prospects assigned to you — work them from first touch to close.'
            : 'Every prospect captured by your agents, imports and team — in one pipeline.'
        }
        icon={Users}
        actions={
          <>
            {canImportExport && (
              <>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" onClick={() => setShowImport(true)}>
                  <Upload className="h-4 w-4" /> Import Excel / CSV
                </Button>
              </>
            )}
            {canCreate && (
              <Button variant="gradient" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Add Lead
              </Button>
            )}
          </>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total leads" value={total} icon={Users} description="matching current filters" tone="primary" />
        <StatCard title="Hot on this page" value={hotOnPage} icon={Flame} description={`of ${leads.length} shown`} tone="danger" />
        <StatCard title="In progress on this page" value={workingOnPage} icon={CheckSquare} description="interested, follow-up or meeting" tone="success" />
        <StatCard
          title="Overdue follow-ups"
          value={overdueOnPage}
          icon={AlertTriangle}
          description={overdueOnPage ? 'need attention now' : selected.length ? `${selected.length} selected` : 'nothing slipping on this page'}
          tone={overdueOnPage ? 'warning' : 'violet'}
          onClick={() => { setFollowUp('overdue'); setView('table'); setPage(1); }}
        />
      </div>

      {/* Filters */}
      <Toolbar>
        <SearchInput
          placeholder="Search by name, email, company…"
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
        />
        <ToolbarDivider />
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={followUp || 'all'} onValueChange={(v) => { setFollowUp(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Follow-up" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any follow-up</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <Select value={temperature || 'all'} onValueChange={(v) => { setTemperature(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Temperature" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Temp</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="widget">Widget</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="import">Import</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="google_maps">Google Maps</SelectItem>
          </SelectContent>
        </Select>
        <ToolbarDivider />
        <div className="ml-auto flex items-center rounded-lg border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setView('table')}
            className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors', view === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setView('pipeline')}
            className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors', view === 'pipeline' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </button>
        </div>
      </Toolbar>

      {view === 'pipeline' ? (
        <PipelineBoard
          stages={pipeline.stages || []}
          loading={pipelineLoading}
          onOpen={(id) => router.push(`/dashboard/leads/${id}`)}
          onMove={canCreate ? (id, s) => stageMutation.mutate({ id, status: s }) : undefined}
        />
      ) : isLoading ? (
        <TableSkeleton cols={8} />
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canSelect && (
                  <TableHead className="w-[44px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                )}
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>AI / Follow-up</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                {canDelete && <TableHead className="w-[56px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={tableCols} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No leads found</p>
                      <p className="text-xs">{canCreate ? 'Try clearing filters, or add your first lead.' : 'Try clearing filters.'}</p>
                      {canCreate && (
                        <Button size="sm" variant="soft" className="mt-2" onClick={() => setShowCreate(true)}>
                          <Plus className="h-4 w-4" /> Add lead
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead: Lead) => {
                  const isSel = selected.includes(lead._id);
                  return (
                    <TableRow
                      key={lead._id}
                      className="cursor-pointer"
                      data-state={isSel ? 'selected' : undefined}
                      onClick={() => router.push(`/dashboard/leads/${lead._id}`)}
                    >
                      {canSelect && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggleOne(lead._id)} aria-label="Select lead" />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{getInitials(leadName(lead))}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold truncate flex items-center gap-1.5">
                              <span>{leadName(lead)}</span>
                              {isOwner && (lead as any).tenantId && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                  🏢 {tenantMap.get((lead as any).tenantId)?.name || 'Tenant'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{lead.email || lead.phone || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{lead.company || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant={statusTone(lead.status)} dot>{statusLabel(lead.status)}</Badge></TableCell>
                      <TableCell><Badge variant={tempColors[lead.temperature] || 'secondary'}>{lead.temperature}</Badge></TableCell>
                      <TableCell><ScoreBar score={lead.score} /></TableCell>
                      <TableCell><FollowUpCell lead={lead} /></TableCell>
                      <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                        <span className="capitalize">{lead.source?.replace(/_/g, ' ') || <span className="text-muted-foreground">—</span>}</span>
                        {/* Prospected leads link back to the listing they came from, for verification */}
                        {lead.metadata?.url && ['ai_automation', 'leads_scrap_ai'].includes(lead.metadata?.utmSource ?? '') && (
                          <a
                            href={lead.metadata.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> See original
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(lead.createdAt)}</TableCell>
                      {canDelete && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" onClick={() => setDeleteId(lead._id)} aria-label="Delete lead">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <TablePagination
            total={total}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </div>
      )}

      {/* Floating bulk action bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-2">
          <div className="flex items-center gap-2 rounded-full border py-2 pl-4 pr-2 shadow-float glass">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground tabular">
                {selected.length}
              </span>
              selected
            </span>
            <div className="h-5 w-px bg-border" />
            {canCreate && (
              <Button size="sm" variant="gradient" onClick={() => { setBulkCallWhen('now'); setShowBulkCall(true); }}>
                <Bot className="h-4 w-4" /> AI Call
              </Button>
            )}
            {canBulkAssign && (
              <Button size="sm" variant="outline" onClick={() => setShowBulkAssign(true)}>
                <Users className="h-4 w-4" /> Assign
              </Button>
            )}
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setSelected([])} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create lead</DialogTitle>
            <DialogDescription>Add a prospect manually. A name and a phone number is enough — with AI calling on, the agent phones them within minutes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input placeholder="John" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input placeholder="Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="widget">Widget</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Select value={form.temperature} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requirement / description <span className="text-muted-foreground text-xs">(the AI uses this on the call)</span></Label>
              <Input placeholder="Wants a website for their clinic, budget ~50k, needs it before Diwali" value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tags <span className="text-muted-foreground text-xs">(comma separated)</span></Label>
              <Input placeholder="vip, enterprise, follow-up" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" /> {createMutation.isPending ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>Are you sure you want to delete this lead? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" /> {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk AI Call Dialog */}
      <Dialog open={showBulkCall} onOpenChange={setShowBulkCall}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> AI call {selected.length} lead{selected.length > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              The AI phones each lead one by one, introduces itself, confirms the name, asks about their requirement (using the lead's description), qualifies them and can book a meeting or fix a callback on the spot. Won / lost leads and leads without a phone are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setBulkCallWhen('now')} className={cn('rounded-xl border p-3 text-left text-sm transition-colors', bulkCallWhen === 'now' ? 'border-primary/50 bg-primary/[0.06]' : 'hover:bg-accent')}>
                <p className="font-medium">Call now</p>
                <p className="text-xs text-muted-foreground">Starts within a minute</p>
              </button>
              <button type="button" onClick={() => setBulkCallWhen('later')} className={cn('rounded-xl border p-3 text-left text-sm transition-colors', bulkCallWhen === 'later' ? 'border-primary/50 bg-primary/[0.06]' : 'hover:bg-accent')}>
                <p className="font-medium">Schedule</p>
                <p className="text-xs text-muted-foreground">Pick a date & time</p>
              </button>
            </div>
            {bulkCallWhen === 'later' && (
              <div className="space-y-1.5">
                <Label>Start calling at</Label>
                <Input type="datetime-local" value={bulkCallAt} onChange={(e) => setBulkCallAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Calls stay inside your calling hours (Settings › AI Calling).</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCall(false)}>Cancel</Button>
            <Button
              variant="gradient"
              disabled={bulkCallMutation.isPending || (bulkCallWhen === 'later' && !bulkCallAt)}
              onClick={() => bulkCallMutation.mutate({ leadIds: selected, at: bulkCallWhen === 'later' && bulkCallAt ? new Date(bulkCallAt).toISOString() : undefined })}
            >
              <Bot className="h-4 w-4" /> {bulkCallMutation.isPending ? 'Queuing…' : bulkCallWhen === 'now' ? 'Start calling' : 'Schedule calls'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selected.length} Lead{selected.length > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>Select a team member to assign these leads to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Assign To</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssign(false)}>Cancel</Button>
            <Button onClick={() => bulkAssignMutation.mutate({ leadIds: selected, assignTo })} disabled={!assignTo || bulkAssignMutation.isPending}>
              {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import leads from a sheet</DialogTitle>
            <DialogDescription>
              Excel (.xlsx) or CSV. Columns are matched by name: <strong>Name, Phone, Email, Description</strong> — plus Company, City, Tags if you have them.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', importAutoCall ? 'border-primary/40 bg-primary/[0.05]' : 'hover:bg-accent')}>
              <Checkbox checked={importAutoCall} onCheckedChange={(c) => setImportAutoCall(c === true)} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">AI calls every lead in this sheet, one by one</span>
                <span className="block text-xs text-muted-foreground">Each call uses that row's <em>Description</em> as context (what they need). Runs within calling hours; no-answers get a WhatsApp and a retry.</span>
              </span>
            </label>
            <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03] p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.06]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium mb-0.5">Upload an Excel or CSV file</p>
              <p className="text-xs text-muted-foreground mb-3">Up to 10MB · duplicate phones/emails are skipped</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : 'Select file'}
              </Button>
            </div>
            <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary">•</span> Example header row: <code className="rounded bg-background px-1">Name | Phone | Email | Description</code></li>
              <li className="flex gap-2"><span className="text-primary">•</span> Phone can be 10 digits (India +91 is assumed) or international</li>
              <li className="flex gap-2"><span className="text-primary">•</span> Rows without a name, phone or email are skipped</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
