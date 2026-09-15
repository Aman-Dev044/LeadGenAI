'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Bot, Copy, MoreHorizontal, Trash2, ArrowUpRight, Cpu, Sparkles, Wrench, Calendar } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate } from '@/lib/utils';
import type { Agent } from '@/types';

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  draft: 'secondary',
  inactive: 'destructive',
};

export default function AgentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, impersonation, activeTenantId } = useAuthStore();
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

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', systemPrompt: '', welcomeMessage: 'Hi! How can I help you today?' });

  const { data, isLoading } = useQuery({
    queryKey: ['agents', activeTenantId],
    queryFn: () => api.get<any>('/agents'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/agents', body),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowCreate(false);
      setForm({ name: '', description: '', systemPrompt: '', welcomeMessage: 'Hi! How can I help you today?' });
      toast.success('Agent created');
      router.push(`/dashboard/agents/${res.data._id || res.data?.data?._id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/agents/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent duplicated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setDeleteId(null);
      toast.success('Agent deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const agents: Agent[] = (data as any)?.data?.data || (data as any)?.data || [];
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const draftCount = agents.filter((a) => a.status === 'draft').length;
  const toolCount = agents.reduce((sum, a) => sum + (a.enabledTools?.length || 0), 0);

  return (
    <div>
      <PageHeader
        icon={Bot}
        title="AI Agents"
        description="Design, train and deploy the assistants that talk to your visitors."
        actions={
          <Button variant="gradient" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create Agent
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[112px]" />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[190px]" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Agents" value={agents.length} icon={Bot} tone="primary" description="in this workspace" />
            <StatCard title="Active" value={activeCount} icon={Sparkles} tone="success" description="live on your site" />
            <StatCard title="Drafts" value={draftCount} icon={Wrench} tone="warning" description="not yet published" />
            <StatCard title="Tools Enabled" value={toolCount} icon={Cpu} tone="violet" description="across all agents" />
          </div>

          {agents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Create your first AI agent to start qualifying visitors and capturing leads automatically."
              actionLabel="Create Agent"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const color = agent.widgetConfig?.primaryColor || '#6366f1';
                return (
                  <Card
                    key={agent._id}
                    interactive
                    className="group relative flex flex-col overflow-hidden p-5"
                    onClick={() => router.push(`/dashboard/agents/${agent._id}`)}
                  >
                    <div
                      className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25"
                      style={{ background: color }}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                          style={{ background: color, boxShadow: `0 6px 16px -6px ${color}` }}
                        >
                          <Bot className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="truncate font-semibold leading-tight">{agent.name}</p>
                            {isOwner && (agent as any).tenantId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                🏢 {tenantMap.get((agent as any).tenantId)?.name || 'Tenant'}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {agent.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 -mt-1">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/agents/${agent._id}`); }}>
                            <ArrowUpRight className="mr-2 h-4 w-4" /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(agent._id); }}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(agent._id); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="relative mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[agent.status] || 'secondary'} dot>{agent.status}</Badge>
                      <Badge variant="outline" className="font-mono normal-case">
                        <Cpu className="h-3 w-3" /> {agent.aiConfig?.model || 'default model'}
                      </Badge>
                    </div>

                    <div className="relative mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5" /> {agent.enabledTools?.length || 0} tools
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> {formatDate(agent.createdAt)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Agent</DialogTitle>
            <DialogDescription>Give your assistant a name and a personality. You can fine-tune everything else afterwards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sales Assistant" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Handles initial lead qualification" />
            </div>
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="You are a helpful sales assistant..." rows={4} />
              <p className="text-xs text-muted-foreground">Describe who the agent is, what it sells and how it should behave.</p>
            </div>
            <div className="space-y-2">
              <Label>Welcome Message</Label>
              <Input value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.systemPrompt}>
              {createMutation.isPending ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>Are you sure? This will deactivate the agent and its widget will stop working.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
