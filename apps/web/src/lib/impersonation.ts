import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Owner console: log in as a user of another tenant. The API returns a short-lived
 * session flagged with `impersonatedBy`; the owner's own session is kept in the store
 * so "Exit" can restore it. A full reload resets sockets/queries for the new identity.
 */
export async function impersonateTenant(tenantId: string, userId?: string) {
  try {
    const res: any = await api.post(`/admin/tenants/${tenantId}/impersonate`, userId ? { userId } : {});
    const session = res?.data;
    if (!session?.accessToken) throw new Error('Impersonation failed');
    useAuthStore.getState().startImpersonation({
      user: session.user,
      tenant: session.tenant,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    toast.success(`Now viewing as ${session.user?.email}`);
    window.location.href = '/dashboard';
  } catch (err: any) {
    toast.error(err?.message || 'Impersonation failed');
  }
}

export async function exitImpersonation() {
  const state = useAuthStore.getState();
  if (!state.impersonation) return;
  // Best effort: revoke the impersonation refresh token before switching back
  try {
    const refreshToken = state.refreshToken;
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } catch {}
  state.stopImpersonation();
  window.location.href = '/dashboard/admin';
}
