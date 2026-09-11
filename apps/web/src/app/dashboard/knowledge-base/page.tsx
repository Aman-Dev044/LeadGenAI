'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, FileText, Globe, Type, RefreshCw, Trash2, BookOpen, Search, Pencil, Eye, Map, Upload,
  Layers, CheckCircle2, AlertTriangle, Loader2, MoreHorizontal, ExternalLink, Calendar, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Toolbar, SearchInput, ToolbarSpacer } from '@/components/shared/toolbar';
import type { KnowledgeSource } from '@/types';
import { cn, formatDate } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'default', processing: 'warning', completed: 'success', failed: 'destructive',
};

const typeIcons: Record<string, any> = { file: Upload, url: Globe, text: Type, sitemap: Map };
const typeTile: Record<string, string> = {
  file: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  url: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  text: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  sitemap: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};
const TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type, hint: 'Paste FAQs, policies or product notes' },
  { value: 'url', label: 'URL', icon: Globe, hint: 'Extract content from a single page' },
  { value: 'sitemap', label: 'Sitemap', icon: Map, hint: 'Crawl up to 20 pages' },
  { value: 'file', label: 'Document', icon: Upload, hint: 'PDF, DOCX, TXT, CSV, MD' },
];

function StatusBadge({ status }: { status: string }) {
  const busy = status === 'processing' || status === 'pending';
  return (
    <Badge variant={statusColors[status] || 'default'}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : status === 'failed' ? <AlertTriangle className="h-3 w-3" /> : null}
      {status}
    </Badge>
  );
}

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sourceType, setSourceType] = useState('text');
  const [form, setForm] = useState({ name: '', type: 'text', rawContent: '', sourceUrl: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Edit
  const [editSource, setEditSource] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', rawContent: '', sourceUrl: '' });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Detail view
  const [viewSource, setViewSource] = useState<any>(null);

  // Search test
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // List filters (client-side, presentation only)
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-sources'],
    queryFn: () => api.get<any>('/knowledge-base/sources'),
  });

  const sources: KnowledgeSource[] = (data as any)?.data?.data || (data as any)?.data || [];

  // Auto-refresh when any source is processing
  const hasProcessing = sources.some((s) => s.status === 'pending' || s.status === 'processing');
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasProcessing, queryClient]);

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/knowledge-base/sources', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
      setShowCreate(false);
      setForm({ name: '', type: 'text', rawContent: '', sourceUrl: '' });
      setSourceType('text');
      setSelectedFile(null);
      toast.success('Knowledge source added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.upload('/knowledge-base/sources/upload', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
      setShowCreate(false);
      setForm({ name: '', type: 'text', rawContent: '', sourceUrl: '' });
      setSourceType('text');
      setSelectedFile(null);
      toast.success('Document uploaded successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/knowledge-base/sources/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
      setEditSource(null);
      toast.success('Source updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge-base/sources/${id}/reprocess`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
      toast.success('Reprocessing started');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-base/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
      setDeleteId(null);
      toast.success('Deleted');
    },
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }

    if (sourceType === 'file') {
      if (!selectedFile) { toast.error('Please select a file'); return; }
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('file', selectedFile);
      uploadMutation.mutate(formData);
      return;
    }

    const payload: Record<string, any> = { name: form.name, type: sourceType };
    if (sourceType === 'text' && form.rawContent.trim()) payload.rawContent = form.rawContent.trim();
    if ((sourceType === 'url' || sourceType === 'sitemap') && form.sourceUrl.trim()) payload.sourceUrl = form.sourceUrl.trim();
    if (sourceType === 'text' && !payload.rawContent) { toast.error('Content is required'); return; }
    if ((sourceType === 'url' || sourceType === 'sitemap') && !payload.sourceUrl) { toast.error('URL is required'); return; }
    createMutation.mutate(payload);
  };

  const handleEdit = (source: any) => {
    setEditSource(source);
    setEditForm({ name: source.name, rawContent: source.rawContent || '', sourceUrl: source.sourceUrl || '' });
  };

  const handleEditSave = () => {
    if (!editSource) return;
    const payload: Record<string, any> = {};
    if (editForm.name.trim() && editForm.name !== editSource.name) payload.name = editForm.name.trim();
    if (editSource.type === 'text' && editForm.rawContent !== editSource.rawContent) payload.rawContent = editForm.rawContent;
    if ((editSource.type === 'url' || editSource.type === 'sitemap') && editForm.sourceUrl !== editSource.sourceUrl) payload.sourceUrl = editForm.sourceUrl;
    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditSource(null); return; }
    updateMutation.mutate({ id: editSource._id, body: payload });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get<any>(`/knowledge-base/search?q=${encodeURIComponent(searchQuery.trim())}&limit=5`);
      setSearchResults((res as any)?.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const totalChunks = sources.reduce((s, x) => s + (x.chunkCount || 0), 0);
  const readyCount = sources.filter((s) => s.status === 'completed').length;
  const processingCount = sources.filter((s) => s.status === 'processing' || s.status === 'pending').length;
  const failedCount = sources.filter((s) => s.status === 'failed').length;

  const visible = sources.filter((s) => {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.sourceUrl || '').toLowerCase().includes(q) || (s.fileName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const fmtSize = (bytes?: number) => (bytes ? `${(bytes / 1024).toFixed(1)} KB` : null);

  return (
    <div>
      <PageHeader
        icon={BookOpen}
        title="Knowledge Base"
        description="Everything your agents know. Add documents, pages and notes and they are chunked, embedded and searchable within seconds."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowSearch(true)}>
              <Search className="h-4 w-4" /> Test Search
            </Button>
            <Button variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Add Source
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[112px]" />)}
          </div>
          <Skeleton className="h-14" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[180px]" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Sources" value={sources.length} icon={BookOpen} tone="primary" description="documents, pages & notes" />
            <StatCard title="Ready" value={readyCount} icon={CheckCircle2} tone="success" description="indexed and searchable" />
            <StatCard title="Chunks Indexed" value={totalChunks} icon={Layers} tone="violet" description="vector embeddings" />
            <StatCard
              title={failedCount > 0 ? 'Needs Attention' : 'Processing'}
              value={failedCount > 0 ? failedCount : processingCount}
              icon={failedCount > 0 ? AlertTriangle : RefreshCw}
              tone={failedCount > 0 ? 'danger' : 'warning'}
              description={failedCount > 0 ? 'failed to process' : 'being embedded'}
            />
          </div>

          {hasProcessing && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
              <span className="flex-1">Processing {processingCount} source{processingCount === 1 ? '' : 's'}… this list refreshes automatically every 5 seconds.</span>
            </div>
          )}

          {sources.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No knowledge sources"
              description="Add documents, URLs, or text to train your AI agents. The more they know, the better they answer."
              actionLabel="Add Source"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <>
              <Toolbar>
                <SearchInput value={filter} onChange={setFilter} placeholder="Search sources…" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="sitemap">Sitemap</SelectItem>
                    <SelectItem value="file">Document</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <ToolbarSpacer />
                <span className="px-1 text-xs text-muted-foreground tabular">{visible.length} of {sources.length}</span>
              </Toolbar>

              {visible.length === 0 ? (
                <EmptyState compact icon={Search} title="No matching sources" description="Try a different search or clear the filters." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((source) => {
                    const Icon = typeIcons[source.type] || FileText;
                    const busy = source.status === 'processing' || source.status === 'pending';
                    return (
                      <Card key={source._id} className="group flex flex-col p-5 transition-all hover:shadow-card-hover hover:border-primary/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', typeTile[source.type] || 'bg-primary/10 text-primary')}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight" title={source.name}>{source.name}</p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground capitalize">
                                {source.type}{source.fileName ? ` · ${source.fileName}` : ''}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 -mt-1">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewSource(source)}><Eye className="mr-2 h-4 w-4" /> View details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(source)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => reprocessMutation.mutate(source._id)}><RefreshCw className="mr-2 h-4 w-4" /> Reprocess</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10" onClick={() => setDeleteId(source._id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <StatusBadge status={source.status} />
                          {source.chunkCount != null && (
                            <Badge variant="outline" className="normal-case"><Layers className="h-3 w-3" /> {source.chunkCount} chunks</Badge>
                          )}
                          {fmtSize(source.fileSize) && <Badge variant="outline" className="normal-case">{fmtSize(source.fileSize)}</Badge>}
                        </div>

                        {busy && <Progress value={source.status === 'processing' ? 66 : 20} tone="warning" className="mt-3 h-1.5 animate-pulse-soft" />}

                        {source.sourceUrl && (
                          <a
                            href={source.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{source.sourceUrl}</span>
                          </a>
                        )}
                        {source.errorMessage && (
                          <p className="mt-3 line-clamp-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400">{source.errorMessage}</p>
                        )}

                        <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(source.createdAt)}</span>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewSource(source)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => handleEdit(source)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Reprocess" onClick={() => reprocessMutation.mutate(source._id)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Knowledge Source</DialogTitle>
            <DialogDescription>Choose where the content comes from. It will be processed and embedded automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPE_OPTIONS.map((t) => {
                  const on = sourceType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setSourceType(t.value); setForm({ ...form, type: t.value }); setSelectedFile(null); }}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer',
                        on ? 'border-primary bg-primary/5 shadow-glow' : 'hover:border-muted-foreground/40 hover:bg-accent/40',
                      )}
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', on ? 'bg-primary/15 text-primary' : typeTile[t.value])}>
                        <t.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product FAQ" />
            </div>
            {sourceType === 'text' && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea value={form.rawContent} onChange={(e) => setForm({ ...form, rawContent: e.target.value })} rows={8} placeholder="Paste your knowledge content here..." />
                <p className="text-xs text-muted-foreground tabular">{form.rawContent.length.toLocaleString()} characters</p>
              </div>
            )}
            {sourceType === 'url' && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://example.com/faq" />
                <p className="text-xs text-muted-foreground">Page content will be automatically extracted</p>
              </div>
            )}
            {sourceType === 'sitemap' && (
              <div className="space-y-2">
                <Label>Sitemap URL</Label>
                <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://example.com/sitemap.xml" />
                <p className="text-xs text-muted-foreground">Up to 20 pages from the sitemap will be crawled and processed</p>
              </div>
            )}
            {sourceType === 'file' && (
              <div className="space-y-2">
                <Label>Upload Document</Label>
                <label
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                    selectedFile ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/40 hover:bg-accent/40',
                  )}
                >
                  <Input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv,.md"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', selectedFile ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                    {selectedFile ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                  </div>
                  {selectedFile ? (
                    <>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB · click to change</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Click to choose a file <span className="text-muted-foreground font-normal">or drag it here</span></p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, CSV, Markdown · max 10MB</p>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={createMutation.isPending || uploadMutation.isPending}>
              {(createMutation.isPending || uploadMutation.isPending) ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding...</> : 'Add Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSource} onOpenChange={() => setEditSource(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Source</DialogTitle>
            <DialogDescription>Rename the source or update its content.</DialogDescription>
          </DialogHeader>
          {editSource && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              {editSource.type === 'text' && (
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={editForm.rawContent} onChange={(e) => setEditForm({ ...editForm, rawContent: e.target.value })} rows={8} />
                  <p className="text-xs text-muted-foreground">Changing content will trigger reprocessing (chunking + embeddings)</p>
                </div>
              )}
              {(editSource.type === 'url' || editSource.type === 'sitemap') && (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input value={editForm.sourceUrl} onChange={(e) => setEditForm({ ...editForm, sourceUrl: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Changing URL will trigger reprocessing</p>
                </div>
              )}
              {editSource.type === 'file' && (
                <div className="space-y-2">
                  <Label>Document</Label>
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', typeTile.file)}><FileText className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{editSource.fileName || 'Uploaded file'}</p>
                      {editSource.fileSize && <p className="text-xs text-muted-foreground">{(editSource.fileSize / 1024).toFixed(1)} KB</p>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">To change the document, delete this source and upload a new one</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSource(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Knowledge Source</DialogTitle>
            <DialogDescription>Are you sure? This will delete all associated chunks and embeddings. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Source Detail Dialog */}
      <Dialog open={!!viewSource} onOpenChange={() => setViewSource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Source Details</DialogTitle>
            <DialogDescription>Processing status and a preview of the indexed content.</DialogDescription>
          </DialogHeader>
          {viewSource && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
                {(() => { const Icon = typeIcons[viewSource.type] || FileText; return (
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', typeTile[viewSource.type] || 'bg-primary/10 text-primary')}>
                    <Icon className="h-5 w-5" />
                  </div>
                ); })()}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{viewSource.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{viewSource.type}</p>
                </div>
                <StatusBadge status={viewSource.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Chunks</p>
                  <p className="mt-1 text-lg font-bold tabular">{viewSource.chunkCount ?? '—'}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(viewSource.createdAt)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Last Processed</p>
                  <p className="mt-1 text-sm font-medium">{viewSource.lastProcessedAt ? formatDate(viewSource.lastProcessedAt) : '—'}</p>
                </div>
              </div>

              {viewSource.sourceUrl && (
                <div className="text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">Source URL</p>
                  <a href={viewSource.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {viewSource.sourceUrl}
                  </a>
                </div>
              )}

              {viewSource.fileName && (
                <div className="text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">File</p>
                  <p>{viewSource.fileName}{viewSource.fileSize ? <span className="text-muted-foreground"> · {(viewSource.fileSize / 1024).toFixed(1)} KB</span> : null}</p>
                </div>
              )}

              {viewSource.errorMessage && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3.5 w-3.5" /> Error</p>
                  <p className="text-sm text-rose-700 dark:text-rose-300">{viewSource.errorMessage}</p>
                </div>
              )}

              {viewSource.rawContent && (
                <div>
                  <Separator />
                  <p className="mb-2 mt-3 text-xs text-muted-foreground">Content Preview</p>
                  <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed scrollbar-thin">
                    {viewSource.rawContent.length > 3000
                      ? viewSource.rawContent.substring(0, 3000) + '\n\n... (truncated)'
                      : viewSource.rawContent}
                  </pre>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Source ID</p>
                <code className="text-xs text-muted-foreground">{viewSource._id}</code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search Test Dialog */}
      <Dialog open={showSearch} onOpenChange={(v) => { setShowSearch(v); if (!v) { setSearchQuery(''); setSearchResults([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Knowledge Search</DialogTitle>
            <DialogDescription>Test semantic search against your knowledge base to see what results your AI agents will use</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask a question..."
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching...</> : <><Search className="h-4 w-4" /> Search</>}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{searchResults.length} result(s) found</p>
                {searchResults.map((result: any, i: number) => {
                  const pct = result.score != null ? Math.round(result.score * 100) : null;
                  return (
                    <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Badge variant="outline" className="normal-case">
                          <BookOpen className="h-3 w-3" /> {result.metadata?.sourceName || 'Unknown source'}
                        </Badge>
                        {pct != null && (
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 w-20" tone={pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger'} />
                            <span className="text-xs font-semibold tabular text-muted-foreground">{(result.score * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <EmptyState compact icon={Search} title="No results" description="Try a different query or add more knowledge sources." />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
