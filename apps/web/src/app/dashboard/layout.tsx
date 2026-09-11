'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PlatformBanner } from '@/components/layout/platform-banner';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { Loading } from '@/components/shared/loading';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hasHydrated } = useAuthStore();
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

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={cn('flex min-h-screen flex-col transition-[margin] duration-300', sidebarOpen ? 'ml-64' : 'ml-16')}>
        <PlatformBanner />
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div key={pathname} className="mx-auto w-full max-w-[1600px] page-enter">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
