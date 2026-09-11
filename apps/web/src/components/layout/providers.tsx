'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SocketInitializer } from '@/components/layout/socket-initializer';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Restore the theme the user picked last time (stored by ui-store.setTheme)
  const setTheme = useUIStore((s) => s.setTheme);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('la_theme');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch {}
  }, [setTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SocketInitializer />
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'rounded-xl shadow-float' }} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
