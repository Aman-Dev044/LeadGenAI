'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Globe, Type, RefreshCw, Trash2, BookOpen, Search, Pencil, Eye, Map, Upload } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import type { KnowledgeSource } from '@/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'default', processing: 'warning', completed: 'success', failed: 'destructive',
};

const typeIcons: Record<string, any> = { file: Upload, url: Globe, text: Type, sitemap: Map };

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

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Train your AI agents with custom knowledge"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSearch(true)}>
              <Search className="mr-2 h-4 w-4" /> Test Search
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Source
            </Button>
          </div>
        }
      />

      {hasProcessing && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
          <span className="text-sm text-yellow-700 dark:text-yellow-400">Processing sources... Auto-refreshing every 5 seconds.</span>
        </div>
      )}

      {sources.length === 0 ? (
        <EmptyState icon={BookOpen} title="No knowledge sources" description="Add documents, URLs, or text to train your AI agents" actionLabel="Add Source" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => {
            const Icon = typeIcons[source.type] || FileText;
            return (
              <Card key={source._id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                      <CardDescription className="text-xs capitalize">{source.type}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusColors[source.status]}>{source.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1 mb-3">
                    {source.chunkCount != null && <p>Chunks: {source.chunkCount}</p>}
                    {source.fileName && <p>File: {source.fileName}</p>}
                    {source.sourceUrl && <p className="truncate">URL: {source.sourceUrl}</p>}
                    <p>Added: {formatDate(source.createdAt)}</p>
                    {source.errorMessage && <p className="text-destructive text-xs">{source.errorMessage}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setViewSource(source)}>
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(source)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => reprocessMutation.mutate(source._id)}>
                      <RefreshCw className="mr-1 h-3 w-3" /> Reprocess
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(source._id)}>
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Knowledge Source</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product FAQ" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={sourceType} onValueChange={(v) => { setSourceType(v); setForm({ ...form, type: v }); setSelectedFile(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="sitemap">Sitemap</SelectItem>
                  <SelectItem value="file">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sourceType === 'text' && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea value={form.rawContent} onChange={(e) => setForm({ ...form, rawContent: e.target.value })} rows={8} placeholder="Paste your knowledge content here..." />
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
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <Input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv,.md"
                    className="max-w-xs mx-auto"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Supported: PDF, DOCX, TXT, CSV, Markdown (max 10MB)</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || uploadMutation.isPending}>
              {(createMutation.isPending || uploadMutation.isPending) ? 'Adding...' : 'Add Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSource} onOpenChange={() => setEditSource(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Source</DialogTitle></DialogHeader>
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
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{editSource.fileName || 'Uploaded file'}</span>
                    {editSource.fileSize && (
                      <span className="text-xs text-muted-foreground">({(editSource.fileSize / 1024).toFixed(1)} KB)</span>
                    )}
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Source Details</DialogTitle></DialogHeader>
          {viewSource && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{viewSource.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{viewSource.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusColors[viewSource.status]}>{viewSource.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chunks</p>
                  <p className="font-medium">{viewSource.chunkCount ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(viewSource.createdAt)}</p>
                </div>
                {viewSource.lastProcessedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Last Processed</p>
                    <p className="font-medium">{formatDate(viewSource.lastProcessedAt)}</p>
                  </div>
                )}
              </div>

              {viewSource.sourceUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Source URL</p>
                  <a href={viewSource.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{viewSource.sourceUrl}</a>
                </div>
              )}

              {viewSource.fileName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">File</p>
                  <p className="text-sm">{viewSource.fileName}</p>
                </div>
              )}

              {viewSource.errorMessage && (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                  <p className="text-sm text-destructive">{viewSource.errorMessage}</p>
                </div>
              )}

              {viewSource.rawContent && (
                <div>
                  <Separator />
                  <p className="text-xs text-muted-foreground mb-2 mt-3">Content Preview</p>
                  <pre className="text-xs bg-muted p-4 rounded-md max-h-60 overflow-y-auto whitespace-pre-wrap break-words">
                    {viewSource.rawContent.length > 3000
                      ? viewSource.rawContent.substring(0, 3000) + '\n\n... (truncated)'
                      : viewSource.rawContent}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Source ID</p>
                <code className="text-xs text-muted-foreground">{viewSource._id}</code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search Test Dialog */}
      <Dialog open={showSearch} onOpenChange={(v) => { setShowSearch(v); if (!v) { setSearchQuery(''); setSearchResults([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Knowledge Search</DialogTitle>
            <DialogDescription>Test semantic search against your knowledge base to see what results your AI agents will use</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask a question..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{searchResults.length} result(s) found</p>
                {searchResults.map((result: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {result.metadata?.sourceName || 'Unknown source'}
                        </Badge>
                        {result.score != null && (
                          <span className="text-xs text-muted-foreground">
                            Score: {(result.score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{result.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">No results. Try a different query or add more knowledge sources.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
