'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Loading } from '@/components/shared/loading';

/** Owner console: only a SUPER_ADMIN that is NOT impersonating may enter. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, impersonation, hasHydrated } = useAuthStore();
  const allowed = user?.role === 'SUPER_ADMIN' && !impersonation;

  useEffect(() => {
    if (hasHydrated && !allowed) router.replace('/dashboard');
  }, [hasHydrated, allowed, router]);

  if (!hasHydrated || !allowed) return <Loading label="Opening the owner console" />;
  return <>{children}</>;
}
