'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Phone, Building2, Globe, Tag, MessageSquare, Pencil, Trash2, X, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loading } from '@/components/shared/loading';
import { formatDate } from '@/lib/utils';

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

  if (isLoading) return <Loading />;

  const lead = (data as any)?.data;
  if (!lead) return <div className="text-center py-10 text-muted-foreground">Lead not found</div>;

  const activityList = (activities as any)?.data?.data || (activities as any)?.data || [];
  const users = (usersData as any)?.data?.data || (usersData as any)?.data || [];
  const noteActivities = activityList.filter((a: any) => a.type === 'note_added');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/leads')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left - Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Lead Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{lead.firstName} {lead.lastName}</CardTitle>
                <div className="flex gap-2">
                  <Badge>{lead.status}</Badge>
                  <Badge variant="outline">{lead.temperature}</Badge>
                  <Badge variant="secondary">Score: {lead.score}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" /> {lead.email}
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone}
                  </div>
                )}
                {lead.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> {lead.company}
                  </div>
                )}
                {lead.source && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" /> {lead.source}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {(lead.tags || []).length === 0 && <span className="text-sm text-muted-foreground">No tags</span>}
                  {(lead.tags || []).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="gap-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    className="h-8 w-40 text-sm"
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button size="sm" variant="outline" className="h-8" onClick={addTag} disabled={!newTag.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Activity, Conversations, Notes */}
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="conversations">Conversations ({lead.conversationIds?.length || 0})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({noteActivities.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardContent className="pt-6">
                  {activityList.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No activity yet</p>
                  ) : (
                    <div className="space-y-4">
                      {activityList.map((activity: any) => (
                        <div key={activity._id} className="flex gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div className="flex-1">
                            <p>{activity.description}</p>
                            <p className="text-muted-foreground text-xs">{formatDate(activity.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversations">
              <Card>
                <CardContent className="pt-6">
                  {(lead.conversationIds || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No conversations</p>
                  ) : (
                    <div className="space-y-2">
                      {lead.conversationIds.map((convId: string) => (
                        <Button key={convId} variant="outline" className="w-full justify-start" onClick={() => router.push(`/dashboard/conversations/${convId}`)}>
                          <MessageSquare className="mr-2 h-4 w-4" /> Conversation {convId.slice(-6)}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Textarea placeholder="Write a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                    <Button size="sm" onClick={() => addNoteMutation.mutate(note)} disabled={!note.trim() || addNoteMutation.isPending}>
                      {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                    </Button>
                  </div>
                  {noteActivities.length > 0 && <Separator />}
                  <div className="space-y-3">
                    {noteActivities.map((activity: any) => (
                      <div key={activity._id} className="border rounded-lg p-3">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(activity.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">Update Lead</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(lead.createdAt)}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{formatDate(lead.updatedAt)}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Last Activity</span><span>{lead.lastActivityAt ? formatDate(lead.lastActivityAt) : '-'}</span></div>
              {lead.convertedAt && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Converted</span><span>{formatDate(lead.convertedAt)}</span></div></>)}
              {lead.metadata?.country && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{lead.metadata.country}</span></div></>)}
              {lead.metadata?.city && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">City</span><span>{lead.metadata.city}</span></div></>)}
              {lead.metadata?.utmSource && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">UTM Source</span><span>{lead.metadata.utmSource}</span></div></>)}
              {lead.metadata?.utmCampaign && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">UTM Campaign</span><span>{lead.metadata.utmCampaign}</span></div></>)}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
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
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {lead.firstName} {lead.lastName}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
