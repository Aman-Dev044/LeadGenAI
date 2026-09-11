'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, Building2, Globe, Tag, MessageSquare, Pencil, Trash2, X, Plus,
  Activity, StickyNote, Flame, MapPin, Megaphone, Clock, CheckCircle2, UserRound, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate, getInitials, cn } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'destructive'> = {
  new: 'default', contacted: 'info', qualified: 'success', unqualified: 'warning', converted: 'success', lost: 'destructive',
};
const tempColors: Record<string, 'destructive' | 'warning' | 'info'> = { hot: 'destructive', warm: 'warning', cold: 'info' };

function ScoreRing({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = s >= 70 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r}
          className={cn('fill-none transition-[stroke-dashoffset] duration-700 ease-out', color)}
          stroke="currentColor" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * s) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-bold tabular">{s}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">score</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

const ACTIVITY_ICON: Record<string, { icon: any; cls: string }> = {
  note_added: { icon: StickyNote, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  status_changed: { icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  assigned: { icon: UserRound, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  conversation: { icon: MessageSquare, cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  score_changed: { icon: Flame, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<any>(`/leads/${id}`),
  });

  const { data: activities } = useQuery({
    queryKey: ['lead-activities', id],
    queryFn: () => api.get<any>(`/leads/${id}/activities`),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get<any>('/users/assignable'),
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/leads/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', id] });
      toast.success('Lead updated');
    },
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  });

  const addNoteMutation = useMutation({
    mutationFn: (noteText: string) => api.post(`/leads/${id}/notes`, { note: noteText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', id] });
      setNote('');
      toast.success('Note added');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add note'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/leads/${id}`),
    onSuccess: () => {
      toast.success('Lead deleted');
      router.push('/dashboard/leads');
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed'),
  });

  if (isLoading) return <Loading label="Loading lead" />;

  const lead = (data as any)?.data;
  if (!lead) {
    return (
      <EmptyState
        icon={UserRound}
        title="Lead not found"
        description="This lead may have been deleted or you don't have access to it."
        actionLabel="Back to leads"
        onAction={() => router.push('/dashboard/leads')}
      />
    );
  }

  const activityList = (activities as any)?.data?.data || (activities as any)?.data || [];
  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];
  const noteActivities = activityList.filter((a: any) => a.type === 'note_added');
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Unnamed lead';
  const assignedUser = users.find((u: any) => u._id === lead.assignedTo);

  const openEdit = () => {
    setEditForm({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
    });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    const payload: Record<string, string> = {};
    Object.entries(editForm).forEach(([k, v]) => {
      const trimmed = v.trim();
      const original = (lead as any)[k] || '';
      if (trimmed !== original) payload[k] = trimmed;
    });
    if (Object.keys(payload).length === 0) {
      setShowEdit(false);
      return;
    }
    updateMutation.mutate(payload);
    setShowEdit(false);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    if (lead.tags?.includes(tag)) {
      toast.error('Tag already exists');
      return;
    }
    updateMutation.mutate({ tags: [...(lead.tags || []), tag] });
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    updateMutation.mutate({ tags: (lead.tags || []).filter((t: string) => t !== tag) });
  };

  const contactItems = [
    lead.email && { icon: Mail, label: 'Email', value: lead.email, href: `mailto:${lead.email}` },
    lead.phone && { icon: Phone, label: 'Phone', value: lead.phone, href: `tel:${lead.phone}` },
    lead.company && { icon: Building2, label: 'Company', value: lead.company },
    lead.source && { icon: Globe, label: 'Source', value: lead.source },
  ].filter(Boolean) as { icon: any; label: string; value: string; href?: string }[];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/leads')}>
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/40" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Summary header */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/15 via-violet-500/10 to-transparent" />
        <CardContent className="relative p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-16 w-16 ring-4 ring-card shadow-md">
                <AvatarFallback className="text-lg">{getInitials(fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">{fullName}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={statusColors[lead.status] || 'secondary'} dot>{lead.status}</Badge>
                  <Badge variant={tempColors[lead.temperature] || 'secondary'}>
                    <Flame className="h-3 w-3" /> {lead.temperature}
                  </Badge>
                  {lead.source && <Badge variant="outline" className="capitalize">{lead.source}</Badge>}
                  {assignedUser && (
                    <Badge variant="violet"><UserRound className="h-3 w-3" /> {assignedUser.firstName} {assignedUser.lastName}</Badge>
                  )}
                </div>
                {lead.company && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {lead.company}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={lead.score} />
              <div className="hidden sm:flex flex-col gap-2">
                {lead.email && (
                  <Button variant="soft" size="sm" asChild>
                    <a href={`mailto:${lead.email}`}><Mail className="h-4 w-4" /> Email</a>
                  </Button>
                )}
                {lead.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> Call</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact + tags */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Contact information</CardTitle>
              <CardDescription>How to reach this lead and where they came from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {contactItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contact details yet — edit the lead to add some.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {contactItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        {item.href ? (
                          <a href={item.href} className="block truncate text-sm font-medium hover:text-primary hover:underline underline-offset-2">{item.value}</a>
                        ) : (
                          <p className="truncate text-sm font-medium capitalize">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Tags
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(lead.tags || []).length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
                  {(lead.tags || []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="normal-case pr-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-rose-500/15 hover:text-rose-600 cursor-pointer" aria-label={`Remove ${tag}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Add tag…"
                      value={newTag}
                      className="h-8 w-36 text-sm"
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button size="sm" variant="soft" className="h-8" onClick={addTag} disabled={!newTag.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Activity, Conversations, Notes */}
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity"><Activity className="h-4 w-4" /> Activity</TabsTrigger>
              <TabsTrigger value="conversations"><MessageSquare className="h-4 w-4" /> Conversations ({lead.conversationIds?.length || 0})</TabsTrigger>
              <TabsTrigger value="notes"><StickyNote className="h-4 w-4" /> Notes ({noteActivities.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardContent className="p-6">
                  {activityList.length === 0 ? (
                    <EmptyState compact icon={Activity} title="No activity yet" description="Status changes, notes and conversations will show up here." />
                  ) : (
                    <ol className="relative space-y-0 border-l border-border/80 ml-4">
                      {activityList.map((activity: any) => {
                        const meta = ACTIVITY_ICON[activity.type] || { icon: Clock, cls: 'bg-primary/10 text-primary' };
                        const Icon = meta.icon;
                        return (
                          <li key={activity._id} className="relative pl-8 pb-6 last:pb-0">
                            <span className={cn('absolute -left-[15px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-card', meta.cls)}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-snug">{activity.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversations">
              <Card>
                <CardContent className="p-6">
                  {(lead.conversationIds || []).length === 0 ? (
                    <EmptyState compact icon={MessageSquare} title="No conversations" description="Chats this lead has with your agents will be linked here." />
                  ) : (
                    <div className="space-y-2">
                      {lead.conversationIds.map((convId: string) => (
                        <button
                          key={convId}
                          onClick={() => router.push(`/dashboard/conversations/${convId}`)}
                          className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.03] cursor-pointer"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Conversation <span className="font-mono text-xs text-muted-foreground">#{convId.slice(-6)}</span></p>
                            <p className="text-xs text-muted-foreground">Open transcript</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Textarea placeholder="Write a note about this lead…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => addNoteMutation.mutate(note)} disabled={!note.trim() || addNoteMutation.isPending}>
                        <Plus className="h-4 w-4" /> {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                      </Button>
                    </div>
                  </div>
                  {noteActivities.length === 0 ? (
                    <EmptyState compact icon={StickyNote} title="No notes yet" description="Keep context for your team by adding a note above." />
                  ) : (
                    <div className="space-y-3">
                      {noteActivities.map((activity: any) => (
                        <div key={activity._id} className="rounded-xl border-l-4 border-amber-400 bg-amber-500/[0.06] p-4">
                          <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {formatDate(activity.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Update lead</CardTitle>
              <CardDescription>Changes save instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={lead.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Select value={lead.temperature} onValueChange={(v) => updateMutation.mutate({ temperature: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select value={lead.assignedTo || ''} onValueChange={(v) => updateMutation.mutate({ assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u._id} value={u._id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Created" value={formatDate(lead.createdAt)} />
              <InfoRow label="Updated" value={formatDate(lead.updatedAt)} />
              <InfoRow label="Last activity" value={lead.lastActivityAt ? formatDate(lead.lastActivityAt) : '—'} />
              {lead.convertedAt && <InfoRow label="Converted" value={formatDate(lead.convertedAt)} />}
              {(lead.metadata?.country || lead.metadata?.city) && (
                <InfoRow
                  label="Location"
                  value={<span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{[lead.metadata?.city, lead.metadata?.country].filter(Boolean).join(', ')}</span>}
                />
              )}
              {lead.metadata?.utmSource && <InfoRow label="UTM source" value={lead.metadata.utmSource} />}
              {lead.metadata?.utmCampaign && (
                <InfoRow label="UTM campaign" value={<span className="inline-flex items-center gap-1"><Megaphone className="h-3.5 w-3.5 text-muted-foreground" />{lead.metadata.utmCampaign}</span>} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
            <DialogDescription>Update the contact details for {fullName}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {fullName}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" /> {deleteMutation.isPending ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
