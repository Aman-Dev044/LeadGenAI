import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, SessionTenant } from '@/types';

/**
 * Non-sensitive "logged in" marker cookie. Tokens stay in localStorage; this
 * flag only lets the Next.js middleware protect /dashboard on the server side
 * (hard refresh / direct URL) without shipping tokens in cookies.
 */
export const AUTH_COOKIE = 'la_auth';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // matches refresh-token lifetime

export function setAuthCookie() {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_COOKIE}=1; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function persistTokens(accessToken: string, refreshToken: string) {
  try {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  } catch {}
  setAuthCookie();
}

/** Snapshot of the owner's own session while they are impersonating a tenant user. */
export interface ImpersonationState {
  ownerUser: User;
  ownerTenant: SessionTenant | null;
  ownerAccessToken: string;
  ownerRefreshToken: string;
  startedAt: string;
}

export interface SessionPayload {
  user: User;
  tenant?: SessionTenant | null;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tenant: SessionTenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** Non-null while a SUPER_ADMIN is acting as a tenant user. */
  impersonation: ImpersonationState | null;
  /** True once the persisted state has been read from localStorage on the client. */
  hasHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string, tenant?: SessionTenant | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  startImpersonation: (session: SessionPayload) => void;
  stopImpersonation: () => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      impersonation: null,
      hasHydrated: false,
      setAuth: (user, accessToken, refreshToken, tenant) => {
        persistTokens(accessToken, refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true, tenant: tenant ?? get().tenant ?? null });
      },
      setTokens: (accessToken, refreshToken) => {
        persistTokens(accessToken, refreshToken);
        set({ accessToken, refreshToken });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      startImpersonation: (session) => {
        const s = get();
        if (!s.user || !s.accessToken || !s.refreshToken) return;
        // Never nest impersonations: keep the original owner session as the backup
        const backup: ImpersonationState = s.impersonation ?? {
          ownerUser: s.user,
          ownerTenant: s.tenant,
          ownerAccessToken: s.accessToken,
          ownerRefreshToken: s.refreshToken,
          startedAt: new Date().toISOString(),
        };
        persistTokens(session.accessToken, session.refreshToken);
        set({
          user: session.user,
          tenant: session.tenant ?? null,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: true,
          impersonation: backup,
        });
      },
      stopImpersonation: () => {
        const imp = get().impersonation;
        if (!imp) return;
        persistTokens(imp.ownerAccessToken, imp.ownerRefreshToken);
        set({
          user: imp.ownerUser,
          tenant: imp.ownerTenant,
          accessToken: imp.ownerAccessToken,
          refreshToken: imp.ownerRefreshToken,
          isAuthenticated: true,
          impersonation: null,
        });
      },
      logout: () => {
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        } catch {}
        clearAuthCookie();
        set({ user: null, tenant: null, accessToken: null, refreshToken: null, isAuthenticated: false, impersonation: null });
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        impersonation: state.impersonation,
      }),
      onRehydrateStorage: () => (state) => {
        // Keep the middleware cookie in sync with what the client actually has
        if (state?.isAuthenticated) setAuthCookie();
        else clearAuthCookie();
        state?.setHasHydrated(true);
      },
    },
  ),
);

export const isSuperAdminUser = (user: User | null | undefined) => user?.role === 'SUPER_ADMIN';
