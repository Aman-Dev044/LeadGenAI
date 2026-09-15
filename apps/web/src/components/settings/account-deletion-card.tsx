'use client';
import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Trash2,
  AlertTriangle,
  UserCheck,
  Building2,
  Mail,
  Clock,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Loader2,
  UserX,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, cn } from '@/lib/utils';

interface AccountDeletionCardProps {
  userRole: string;
  userEmail: string;
  tenantName: string;
  onLogout: () => void;
}

const ADMIN_DELETION_REASONS = [
  'Switching to another platform',
  'Too expensive / Budget constraints',
  'Missing required features',
  'Temporary project ended',
  'Company restructuring or closing',
  'Dissatisfied with AI responses / performance',
  'Other reason',
];

const SALESPERSON_DELETION_REASONS = [
  'Left the organization / role',
  'No longer responsible for sales',
  'Switching to another tool',
  'Personal data removal request',
  'Other reason',
];

export function AccountDeletionCard({
  userRole,
  userEmail,
  tenantName,
  onLogout,
}: AccountDeletionCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = userRole === 'ADMIN';

  // Request state
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Ownership transfer state
  const [transferStep, setTransferStep] = useState<'idle' | 'otp_sent'>('idle');
  const [transferTimer, setTransferTimer] = useState(0);
  const [transferOtp, setTransferOtp] = useState('');
  const [transferForm, setTransferForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  // Query active pending deletion request
  const { data: myRequest, isLoading: isLoadingRequest, refetch: refetchMyRequest } = useQuery({
    queryKey: ['my-deletion-request'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/account-deletion/my-request');
        return res?.data || res;
      } catch (err: any) {
        return null;
      }
    },
  });

  // Countdown timer for 2-min OTP
  useEffect(() => {
    if (transferTimer <= 0) return;
    const interval = setInterval(() => {
      setTransferTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [transferTimer]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Calculate word count
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;

  // Submit Deletion Request Mutation
  const submitRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<any>('/account-deletion/request', {
        reason,
        description: description.trim(),
      });
      return res?.data || res;
    },
    onSuccess: () => {
      toast.success(
        isAdmin
          ? 'Organization deletion request submitted to Platform SuperAdmin. You will be notified upon review.'
          : 'Account deletion request submitted to your Organization Administrator. You will be notified upon review.'
      );
      setReason('');
      setDescription('');
      setConfirmed(false);
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit deletion request.');
    },
  });

  // Cancel Request Mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete<any>('/account-deletion/my-request');
      return res?.data || res;
    },
    onSuccess: () => {
      toast.success('Deletion request has been cancelled.');
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel deletion request.');
    },
  });

  // Request Ownership Transfer OTP Mutation
  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<any>('/account-deletion/transfer-ownership/otp');
      return res?.data || res;
    },
    onSuccess: () => {
      toast.success(`6-character verification code sent to ${userEmail}. Valid for 2 minutes.`);
      setTransferStep('otp_sent');
      setTransferTimer(120);
      setTransferOtp('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send verification code.');
    },
  });

  // Execute Ownership Transfer Mutation
  const executeTransferMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<any>('/account-deletion/transfer-ownership/execute', {
        otp: transferOtp.trim().toUpperCase(),
        firstName: transferForm.firstName.trim(),
        lastName: transferForm.lastName.trim(),
        email: transferForm.email.trim(),
        phone: transferForm.phone.trim(),
        password: transferForm.password,
      });
      return res?.data || res;
    },
    onSuccess: (data: any) => {
      toast.success('Ownership transferred successfully! Signing you out...');
      setTimeout(() => {
        onLogout();
        router.push('/auth/login');
      }, 1500);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to execute ownership transfer.');
    },
  });

  const handleSubmitRequest = () => {
    if (!reason) {
      toast.error('Please select a reason for deletion.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide a short description / feedback (required, up to 100 words).');
      return;
    }
    if (wordCount > 100) {
      toast.error('Description must be 100 words or fewer.');
      return;
    }
    if (!confirmed) {
      toast.error('Please confirm your deletion request by checking the box.');
      return;
    }
    submitRequestMutation.mutate();
  };

  const handleExecuteTransfer = () => {
    if (!transferOtp.trim() || transferOtp.trim().length !== 6) {
      toast.error('Please enter the 6-character verification code.');
      return;
    }
    if (!transferForm.firstName.trim() || !transferForm.lastName.trim()) {
      toast.error('Please enter the new owner’s full name.');
      return;
    }
    if (!transferForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferForm.email)) {
      toast.error('Please enter a valid email for the new owner.');
      return;
    }
    if (transferForm.email.trim().toLowerCase() === userEmail.toLowerCase()) {
      toast.error('New owner email cannot be identical to your current email.');
      return;
    }
    if (!transferForm.password || transferForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    executeTransferMutation.mutate();
  };

  return (
    <Card className="border-rose-500/30 overflow-hidden">
      <CardHeader className="bg-rose-500/5 pb-4 border-b border-rose-500/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-rose-700 dark:text-rose-400">
              {isAdmin ? 'Account & Organization Deletion' : 'Delete Account'}
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? 'Transfer organization ownership or submit a formal workspace deletion request.'
                : 'Request deletion of your salesperson account from the workspace.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Active Pending Request Banner */}
        {myRequest && myRequest.status === 'pending' ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="gap-1.5 font-semibold text-xs">
                    <Clock className="w-3.5 h-3.5 animate-pulse" /> Deletion Request Pending Review
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Submitted {formatDate(myRequest.createdAt)}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground text-sm pt-1">
                  {isAdmin
                    ? 'Your request has been dispatched to Platform SuperAdmin'
                    : 'Your request has been dispatched to your Organization Administrator'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAdmin
                    ? 'SuperAdmin has received your organization deletion request. Once reviewed and approved, your workspace will be permanently deleted and you will receive a confirmation email.'
                    : 'Your Organization Administrator has received your account deletion request. Once reviewed and approved, your individual profile will be removed and you will receive a confirmation email.'}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelRequestMutation.mutate()}
                disabled={cancelRequestMutation.isPending}
                className="text-xs shrink-0"
              >
                {cancelRequestMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
              </Button>
            </div>

            <div className="rounded-lg bg-background/80 border p-3 text-xs space-y-1">
              <p><strong>Selected Reason:</strong> {myRequest.reason}</p>
              {myRequest.description && (
                <p><strong>Your Feedback:</strong> &ldquo;{myRequest.description}&rdquo;</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* If Admin: Show two options: Transfer Ownership vs Request Organization Deletion */}
            {isAdmin ? (
              <Tabs defaultValue="transfer" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="transfer" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    <span>Transfer Ownership & Leave</span>
                    <Badge variant="secondary" className="ml-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Safe
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="delete_org" className="gap-2 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Delete Organization</span>
                  </TabsTrigger>
                </TabsList>

                {/* Option 1: Ownership Transfer */}
                <TabsContent value="transfer" className="space-y-5">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 text-xs text-emerald-900 dark:text-emerald-200">
                    <p className="font-semibold flex items-center gap-1.5 text-sm">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      Preserve Your Sales Team & Company Data
                    </p>
                    <p className="leading-relaxed">
                      If your organization is continuing operations, transfer ownership to a new or existing colleague. Your admin account will be safely deactivated, while <strong>all registered salespersons, agents, leads, and customer chats remain 100% active and completely unaffected</strong>.
                    </p>
                  </div>

                  {transferStep === 'idle' ? (
                    <div className="space-y-4 rounded-xl border p-5 bg-card">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold">Step 1: Verify Current Administrator Email</h4>
                        <p className="text-xs text-muted-foreground">
                          To protect against unauthorized transfers, a 6-character alphanumeric verification code will be sent to your email <strong>({userEmail})</strong>.
                        </p>
                      </div>

                      <Button
                        onClick={() => requestOtpMutation.mutate()}
                        disabled={requestOtpMutation.isPending}
                        className="gap-2"
                      >
                        {requestOtpMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending Code...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            Send 2-Minute Verification Code
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5 rounded-xl border p-5 bg-card border-primary/20">
                      <div className="flex items-center justify-between pb-3 border-b">
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <span>Step 2: Enter Verification Code & New Owner Details</span>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Code sent to <strong>{userEmail}</strong>
                          </p>
                        </div>
                        {transferTimer > 0 ? (
                          <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-600 bg-amber-500/10">
                            <Clock className="w-3 h-3 mr-1 animate-pulse" /> {formatTimer(transferTimer)}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Code Expired
                          </Badge>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2 max-w-xs">
                          <Label className="text-xs">6-Character Verification Code</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={transferOtp}
                              onChange={(e) => setTransferOtp(e.target.value.toUpperCase().slice(0, 6))}
                              placeholder="e.g. 8K2M9P"
                              maxLength={6}
                              className="font-mono text-center tracking-widest font-bold uppercase"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => requestOtpMutation.mutate()}
                              disabled={requestOtpMutation.isPending || transferTimer > 0}
                              className="text-xs"
                            >
                              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', requestOtpMutation.isPending && 'animate-spin')} />
                              Resend
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">New Owner First Name</Label>
                          <Input
                            value={transferForm.firstName}
                            onChange={(e) => setTransferForm({ ...transferForm, firstName: e.target.value })}
                            placeholder="Alex"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">New Owner Last Name</Label>
                          <Input
                            value={transferForm.lastName}
                            onChange={(e) => setTransferForm({ ...transferForm, lastName: e.target.value })}
                            placeholder="Morgan"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">New Owner Email Address</Label>
                          <Input
                            type="email"
                            value={transferForm.email}
                            onChange={(e) => setTransferForm({ ...transferForm, email: e.target.value })}
                            placeholder="alex.morgan@company.com"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">New Owner Phone Number (Optional)</Label>
                          <Input
                            value={transferForm.phone}
                            onChange={(e) => setTransferForm({ ...transferForm, phone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">New Owner Initial Password (Min 8 Characters)</Label>
                          <Input
                            type="password"
                            value={transferForm.password}
                            onChange={(e) => setTransferForm({ ...transferForm, password: e.target.value })}
                            placeholder="••••••••••••"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTransferStep('idle')}
                          className="text-xs text-muted-foreground"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleExecuteTransfer}
                          disabled={
                            executeTransferMutation.isPending ||
                            transferOtp.trim().length !== 6 ||
                            transferTimer === 0
                          }
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {executeTransferMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Transferring Ownership...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Verify Code & Complete Transfer
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Option 2: Organization Deletion */}
                <TabsContent value="delete_org" className="space-y-5">
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-900 dark:text-rose-200">
                    <p className="font-bold flex items-center gap-1.5 text-sm text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      Critical Workspace Destruction Notice
                    </p>
                    <p className="leading-relaxed">
                      Submitting this request will ask the platform SuperAdmin to permanently delete the entire organization <strong>{tenantName}</strong>. Upon approval, <strong>all registered salespersons, customer conversations, knowledge chunks, and billing profiles will be deleted</strong>.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-xl border p-5 bg-card">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Select Reason for Deletion <span className="text-rose-500">*</span>
                      </Label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a primary reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ADMIN_DELETION_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          Feedback & Description <span className="text-rose-500">*</span>{' '}
                          <span className="text-muted-foreground font-normal">(Required, Max 100 words)</span>
                        </Label>
                        <span
                          className={cn(
                            'text-[11px]',
                            wordCount > 100 || (!description.trim() && 'text-muted-foreground'),
                            wordCount > 100 && 'text-rose-600 font-bold'
                          )}
                        >
                          {wordCount} / 100 words
                        </span>
                      </div>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Please tell us what went wrong or how we could have helped you better (required, up to 100 words)..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-start gap-2.5 pt-2">
                      <Checkbox
                        id="confirm-delete-org"
                        checked={confirmed}
                        onCheckedChange={(c) => setConfirmed(!!c)}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="confirm-delete-org"
                        className="text-xs text-muted-foreground leading-snug cursor-pointer select-none"
                      >
                        I understand that this action is irreversible and will delete the entire organization <strong>{tenantName}</strong> and all associated staff accounts upon SuperAdmin approval.
                      </label>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="destructive"
                        onClick={handleSubmitRequest}
                        disabled={
                          submitRequestMutation.isPending ||
                          !reason ||
                          !description.trim() ||
                          !confirmed ||
                          wordCount > 100
                        }
                        className="gap-2"
                      >
                        {submitRequestMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting Request...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Submit Organization Deletion Request
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              /* Salesperson Account Deletion */
              <div className="space-y-5">
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2 text-xs text-sky-900 dark:text-sky-200">
                  <p className="font-semibold flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-300">
                    <UserX className="h-4 w-4" />
                    Sales Staff Profile Deletion
                  </p>
                  <p className="leading-relaxed">
                    You can request deletion of your salesperson account. Submitting this request will notify your <strong>Organization Administrator</strong> for review and approval. Upon approval, your individual user account and login will be removed in real-time, while the organization <strong>({tenantName})</strong> and other team members remain active.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border p-5 bg-card">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Select Reason for Deletion <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SALESPERSON_DELETION_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        Feedback & Description <span className="text-rose-500">*</span>{' '}
                        <span className="text-muted-foreground font-normal">(Required, Max 100 words)</span>
                      </Label>
                      <span
                        className={cn(
                          'text-[11px]',
                          wordCount > 100 ? 'text-rose-600 font-bold' : 'text-muted-foreground'
                        )}
                      >
                        {wordCount} / 100 words
                      </span>
                    </div>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please share feedback or the reason for requesting account deletion (required, up to 100 words)..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-start gap-2.5 pt-2">
                    <Checkbox
                      id="confirm-delete-sales"
                      checked={confirmed}
                      onCheckedChange={(c) => setConfirmed(!!c)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="confirm-delete-sales"
                      className="text-xs text-muted-foreground leading-snug cursor-pointer select-none"
                    >
                      I confirm that I want to request the permanent deletion of my salesperson account.
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      onClick={handleSubmitRequest}
                      disabled={
                        submitRequestMutation.isPending ||
                        !reason ||
                        !description.trim() ||
                        !confirmed ||
                        wordCount > 100
                      }
                      className="gap-2"
                    >
                      {submitRequestMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting Request...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Submit Account Deletion Request
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
