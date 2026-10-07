'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PlatformBanner } from '@/components/layout/platform-banner';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { Loading } from '@/components/shared/loading';
import { canAccessPath, homePathFor } from '@/lib/permissions';
import { AccessDenied } from '@/components/shared/access-denied';
import { PoweredBy } from '@/components/brand/logo';
import { BRAND } from '@/lib/brand';
import { SubscriptionLock } from '@/components/billing/subscription-lock';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hasHydrated, user, impersonation, logout } = useAuthStore();

  // Trial over or subscription lapsed: the whole product is behind the paywall,
  // and the only thing anyone can do is pay. Owners browsing a workspace are exempt.
  const { data: subData } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get<any>('/billing/subscription'),
    enabled: hasHydrated && isAuthenticated && user?.role !== 'SUPER_ADMIN',
    staleTime: 60_000,
    retry: false,
  });
  const locked = !!((subData as any)?.data ?? (subData as any))?.requiresPayment;
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  // Wait for the persisted auth state to load before deciding; the server render
  // never has it, so redirecting during render would kick logged-in users out on refresh.
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [hasHydrated, isAuthenticated, pathname, router]);

  // Collapse the sidebar automatically on narrow screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setSidebarOpen(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setSidebarOpen]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loading label="Preparing your workspace" />
      </div>
    );
  }

  if (locked && !pathname.startsWith('/dashboard/admin')) {
    return (
      <SubscriptionLock
        onSignOut={() => {
          logout();
          router.replace('/auth/login');
        }}
      />
    );
  }

  // Role gate: owner console has its own layout; every other dashboard route is checked here
  // so a typed URL never renders a page the role cannot use.
  const isOwnerConsole = pathname.startsWith('/dashboard/admin');
  const effectiveRole = user?.role === 'SUPER_ADMIN' && impersonation ? 'ADMIN' : user?.role;
  const allowed = isOwnerConsole || canAccessPath(effectiveRole, pathname);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={cn('flex min-h-screen flex-col transition-[margin] duration-300', sidebarOpen ? 'ml-64' : 'ml-16')}>
        <PlatformBanner />
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div key={pathname} className="mx-auto w-full max-w-[1600px] page-enter">
            <ErrorBoundary>{allowed ? children : <AccessDenied homeHref={homePathFor(effectiveRole)} />}</ErrorBoundary>
          </div>
        </main>
        <footer className="border-t border-border/50 px-4 py-4 md:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-2 text-[11.5px] text-muted-foreground sm:flex-row">
            <p>
              {BRAND.name} · {BRAND.tagline}
            </p>
            <PoweredBy className="text-[11.5px]" />
          </div>
        </footer>
      </div>
    </div>
  );
}
