'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Download, Upload, Flame, CheckSquare, X, Inbox, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api-client';
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
import { formatDate, getInitials } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'destructive'> = {
  new: 'default',
  contacted: 'info',
  qualified: 'success',
  unqualified: 'warning',
  converted: 'success',
  lost: 'destructive',
};

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

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', company: '', source: '', status: '', temperature: '', tags: '' };

export default function LeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [source, setSource] = useState<string>('');
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

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, limit, search, status, temperature, source],
    queryFn: () => api.get<PaginatedResponse<Lead>['data']>('/leads', {
      page, limit, search: search || undefined,
      status: status || undefined,
      temperature: temperature || undefined,
      source: source || undefined,
    }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
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
      toast.success(`Imported ${result.imported} leads, ${result.skipped} skipped`);
      if (result.errors?.length > 0) {
        toast.error(`${result.errors.length} errors during import`);
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to import CSV'),
  });

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

    if (!payload.firstName && !payload.email) {
      toast.error('Please enter at least a name or email');
      return;
    }
    createMutation.mutate(payload);
  };

  const leadName = (l: Lead) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed lead';
  const hotOnPage = leads.filter((l: Lead) => l.temperature === 'hot').length;
  const qualifiedOnPage = leads.filter((l: Lead) => l.status === 'qualified' || l.status === 'converted').length;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Every prospect captured by your agents, imports and team — in one pipeline."
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Add Lead
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total leads" value={total} icon={Users} description="matching current filters" tone="primary" />
        <StatCard title="Hot on this page" value={hotOnPage} icon={Flame} description={`of ${leads.length} shown`} tone="danger" />
        <StatCard title="Qualified on this page" value={qualifiedOnPage} icon={CheckSquare} description="qualified or converted" tone="success" />
        <StatCard title="Selected" value={selected.length} icon={Inbox} description={selected.length ? 'ready for bulk actions' : 'tick rows to bulk assign'} tone="violet" />
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
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="unqualified">Unqualified</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
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
          </SelectContent>
        </Select>
      </Toolbar>

      {/* Table with checkboxes */}
      {isLoading ? (
        <TableSkeleton cols={8} />
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[44px]">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[56px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No leads found</p>
                      <p className="text-xs">Try clearing filters, or add your first lead.</p>
                      <Button size="sm" variant="soft" className="mt-2" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" /> Add lead
                      </Button>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleOne(lead._id)} aria-label="Select lead" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{getInitials(leadName(lead))}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{leadName(lead)}</div>
                            <div className="text-xs text-muted-foreground truncate">{lead.email || lead.phone || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{lead.company || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant={statusColors[lead.status] || 'secondary'} dot>{lead.status}</Badge></TableCell>
                      <TableCell><Badge variant={tempColors[lead.temperature] || 'secondary'}>{lead.temperature}</Badge></TableCell>
                      <TableCell><ScoreBar score={lead.score} /></TableCell>
                      <TableCell className="text-sm capitalize">{lead.source || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(lead.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" onClick={() => setDeleteId(lead._id)} aria-label="Delete lead">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
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
            <Button size="sm" onClick={() => setShowBulkAssign(true)}>
              <Users className="h-4 w-4" /> Assign
            </Button>
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
            <DialogDescription>Add a prospect manually. A name or an email is enough to start.</DialogDescription>
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
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
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
            <DialogTitle>Import Leads from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with lead data. Supported columns: First Name, Last Name, Email, Phone, Company, Status, Temperature, Source, Tags.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03] p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.06]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium mb-0.5">Upload a CSV file</p>
              <p className="text-xs text-muted-foreground mb-3">Up to 5MB · duplicates are skipped automatically</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : 'Select CSV File'}
              </Button>
            </div>
            <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary">•</span> Duplicate emails will be skipped</li>
              <li className="flex gap-2"><span className="text-primary">•</span> Rows without a name or email will be skipped</li>
              <li className="flex gap-2"><span className="text-primary">•</span> Maximum file size: 5MB</li>
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
