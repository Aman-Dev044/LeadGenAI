'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, UserCheck, UserX, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { formatDate } from '@/lib/utils';

const ROLES = ['ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'];

const roleColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ADMIN: 'destructive', SALES_MANAGER: 'default', SALESPERSON: 'secondary', VIEWER: 'secondary',
};

const emptyForm = { firstName: '', lastName: '', email: '', password: '', role: 'SALESPERSON', phone: '' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Edit
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: '', phone: '' });

  // Delete
  const [deleteUser, setDeleteUser] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, limit, search],
    queryFn: () => api.get<any>('/users', { page, limit, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/users', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast.success('User created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      toast.success('User updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUser(null);
      toast.success('User deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const allUsers = (data as any)?.data?.data || (data as any)?.data || [];
  const meta = (data as any)?.data?.meta;
  const total = meta?.total ?? (data as any)?.data?.total ?? allUsers.length;
  const totalPages = meta?.totalPages ?? (data as any)?.data?.totalPages ?? 1;

  // Client-side role filter
  const users = roleFilter ? allUsers.filter((u: any) => u.role === roleFilter) : allUsers;

  const activeCount = allUsers.filter((u: any) => u.isActive).length;
  const inactiveCount = allUsers.filter((u: any) => !u.isActive).length;

  const handleCreate = () => {
    const payload: Record<string, any> = {};
    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.password) payload.password = form.password;
    if (form.phone.trim()) payload.phone = form.phone.trim();
    payload.role = form.role;

    if (!payload.firstName) { toast.error('First name is required'); return; }
    if (!payload.lastName) { toast.error('Last name is required'); return; }
    if (!payload.email) { toast.error('Email is required'); return; }
    if (!payload.password || payload.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    createMutation.mutate(payload);
  };

  const handleEdit = (user: any) => {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'SALESPERSON',
      phone: user.phone || '',
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    const payload: Record<string, any> = {};
    if (editForm.firstName.trim() !== (editUser.firstName || '')) payload.firstName = editForm.firstName.trim();
    if (editForm.lastName.trim() !== (editUser.lastName || '')) payload.lastName = editForm.lastName.trim();
    if (editForm.role !== editUser.role) payload.role = editForm.role;
    if (editForm.phone.trim() !== (editUser.phone || '')) payload.phone = editForm.phone.trim();

    if (Object.keys(payload).length === 0) { toast.info('No changes'); setEditUser(null); return; }
    updateMutation.mutate({ id: editUser._id, body: payload });
  };

  const handleToggleActive = (user: any) => {
    if (user.isActive) {
      deactivateMutation.mutate(user._id);
    } else {
      activateMutation.mutate(user._id);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      key: 'name', label: 'Name', render: (u: any) => (
        <div>
          <span className="font-medium">{u.firstName} {u.lastName}</span>
          {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u: any) => <span className="text-sm">{u.email}</span> },
    { key: 'role', label: 'Role', render: (u: any) => <Badge variant={roleColors[u.role] || 'secondary'}>{u.role}</Badge> },
    {
      key: 'isActive', label: 'Status', render: (u: any) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={u.isActive ?? true}
            onCheckedChange={() => handleToggleActive(u)}
          />
          <span className="text-xs">{u.isActive ? 'Active' : 'Inactive'}</span>
        </div>
      ),
    },
    { key: 'lastLoginAt', label: 'Last Login', render: (u: any) => u.lastLoginAt ? formatDate(u.lastLoginAt) : <span className="text-muted-foreground text-xs">Never</span> },
    {
      key: 'actions', label: '', render: (u: any) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEdit(u); }}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteUser(u); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage team members"
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Total Users" value={total} icon={Users} />
        <StatCard title="Active" value={activeCount} icon={UserCheck} />
        <StatCard title="Inactive" value={inactiveCount} icon={UserX} />
        <StatCard title="Admins" value={allUsers.filter((u: any) => u.role === 'ADMIN').length} icon={ShieldCheck} />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-[250px]"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={users} total={total} page={page} limit={limit} totalPages={totalPages} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password * (min 8 characters)</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="********" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">Email: {editUser.email}</div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1234567890" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteUser?.firstName} {deleteUser?.lastName}</strong> ({deleteUser?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteUser && deleteMutation.mutate(deleteUser._id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
