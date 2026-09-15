'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserX,
  AlertTriangle,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Mail,
  ShieldAlert,
  Loader2,
  Trash2,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate, cn } from '@/lib/utils';

export default function DeletionRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [roleFilter, setRoleFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants-list'],
    queryFn: async () => {
      const res: any = await api.get('/admin/tenants?limit=100');
      return res?.data?.data || res?.data || [];
    },
  });

  const clientTenants = (tenantsData || []).filter(
    (t: any) => !t.isPlatformOwner && t.slug !== 'owner' && !t.name?.toLowerCase().includes('platform owner')
  );

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-deletion-requests', statusFilter, roleFilter, tenantFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (tenantFilter !== 'all') params.set('tenantId', tenantFilter);
      const res = await api.get<any>(`/account-deletion/admin/requests?${params.toString()}`);
      return (res as any)?.data || res;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<any>(`/account-deletion/admin/requests/${id}/approve`);
      return (res as any)?.data || res;
    },
    onSuccess: () => {
      toast.success('Account deletion request approved and processed successfully.');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to approve deletion request.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post<any>(`/account-deletion/admin/requests/${id}/reject`, { reason });
      return (res as any)?.data || res;
    },
    onSuccess: () => {
      toast.success('Account deletion request rejected.');
      setRejectTarget(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reject deletion request.');
    },
  });

  const payload = (data as any)?.data || data || {};
  const requests: any[] = Array.isArray(payload?.requests) ? payload.requests : (Array.isArray(payload) ? payload : []);
  const pendingCount: number = payload?.pendingCount ?? requests.filter((r) => r.status === 'pending').length;
  const total: number = payload?.total ?? requests.length;

  const adminRequestsCount = requests.filter((r) => r.userRole === 'ADMIN').length;
  const salesRequestsCount = requests.filter((r) => r.userRole !== 'ADMIN').length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserX}
        title="Deletion Requests"
        description="Review, approve, and process account and organization deletion requests from Admins and Salespersons."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </PageHeader>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>Pending Requests</span>
              <Clock className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-200">{pendingCount}</div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">Requires platform review</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between">
              <span>Organization Requests</span>
              <Building2 className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-900 dark:text-rose-200">{adminRequestsCount}</div>
            <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">Deletes workspace & all sales staff</p>
          </CardContent>
        </Card>

        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-700 dark:text-sky-400 flex items-center justify-between">
              <span>Sales Staff Requests</span>
              <Users className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-900 dark:text-sky-200">{salesRequestsCount}</div>
            <p className="text-xs text-sky-700/80 dark:text-sky-400/80 mt-1">Individual user accounts only</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter By:</span>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin (Org)</SelectItem>
                <SelectItem value="SALESPERSON">Salesperson</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {clientTenants.map((t: any) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <strong>{requests.length}</strong> of {total} requests
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading deletion requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={UserX}
          title="No deletion requests found"
          description={
            statusFilter === 'pending'
              ? 'There are currently no pending deletion requests requiring review.'
              : 'No deletion requests match your selected filters.'
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isAdmin = req.userRole === 'ADMIN';
            const isPending = req.status === 'pending';

            return (
              <Card
                key={req._id}
                className={cn(
                  'transition-all border',
                  isPending
                    ? isAdmin
                      ? 'border-rose-500/40 bg-rose-500/[0.02]'
                      : 'border-amber-500/40 bg-amber-500/[0.02]'
                    : 'opacity-85'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{req.userName}</span>
                        <Badge
                          variant={isAdmin ? 'destructive' : 'secondary'}
                          className="text-[11px] uppercase tracking-wider font-semibold"
                        >
                          {isAdmin ? 'Organization Admin' : 'Salesperson'}
                        </Badge>
                        <Badge
                          variant={
                            req.status === 'pending'
                              ? 'warning'
                              : req.status === 'approved'
                              ? 'destructive'
                              : req.status === 'rejected'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="capitalize text-[11px]"
                        >
                          {req.status === 'pending' ? 'Pending Review' : req.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Mail className="h-3 w-3" /> {req.userEmail}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Building2 className="h-3 w-3 text-muted-foreground" /> {req.tenantName}
                        </span>
                        <span>&bull;</span>
                        <span>Requested {formatDate(req.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action buttons for pending requests */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setApproveTarget(req)}
                          className="gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Approve & Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRejectTarget(req);
                            setRejectionReason('');
                          }}
                          className="gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Warning banner for Admin requests */}
                  {isAdmin && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                      <div>
                        <strong>Cascade Impact Warning:</strong> Approving this request will permanently delete the organization workspace <strong>{req.tenantName}</strong> and terminate all <strong>{req.affectedUsersCount} registered sales staff accounts</strong> and lead databases.
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Reason:</span>
                      <Badge variant="outline" className="text-xs font-medium">
                        {req.reason}
                      </Badge>
                    </div>
                    {req.description && (
                      <div className="text-xs text-foreground/90 pl-1 italic border-l-2 border-primary/40 mt-1">
                        &ldquo;{req.description}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Review details for finished requests */}
                  {!isPending && req.reviewedAt && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1 border-t">
                      <span>Reviewed on {formatDate(req.reviewedAt)}</span>
                      {req.rejectionReason && (
                        <span>&bull; Rejection note: <em>{req.rejectionReason}</em></span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Approving Deletion */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>Confirm Account Deletion</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-left">
              Are you sure you want to approve this deletion request?
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
                <p><strong>User:</strong> {approveTarget.userName} ({approveTarget.userEmail})</p>
                <p><strong>Role:</strong> {approveTarget.userRole}</p>
                <p><strong>Workspace:</strong> {approveTarget.tenantName}</p>
                <p><strong>Reason:</strong> {approveTarget.reason}</p>
              </div>

              {approveTarget.userRole === 'ADMIN' ? (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                  <p className="font-bold mb-1">⚠️ Full Organization Cascade:</p>
                  <p>
                    This will delete organization <strong>{approveTarget.tenantName}</strong>, deactivate all <strong>{approveTarget.affectedUsersCount} registered salespersons</strong>, and immediately dispatch a confirmation email to <strong>{approveTarget.userEmail}</strong>.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Salesperson Profile Deletion:</p>
                  <p>
                    This will remove user <strong>{approveTarget.userEmail}</strong> from <strong>{approveTarget.tenantName}</strong>. The organization and remaining team members will remain active. A confirmation email will be sent.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => approveMutation.mutate(approveTarget._id)}
              disabled={approveMutation.isPending}
              className="gap-1.5"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Deletion Request</DialogTitle>
            <DialogDescription>
              Provide an optional note to explain why this request is not approved. The user will be notified via email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Rejection Reason / Note</label>
              <Textarea
                placeholder="e.g. Please resolve outstanding invoices or contact customer support first."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                rejectMutation.mutate({
                  id: rejectTarget._id,
                  reason: rejectionReason,
                })
              }
              disabled={rejectMutation.isPending}
              className="gap-1.5"
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Submit Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
