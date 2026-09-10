'use client';
import { useRouter } from 'next/navigation';
import { Bell, Crown, LogOut, Moon, Sun, User, UserCog } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { exitImpersonation } from '@/lib/impersonation';
import { useQuery } from '@tanstack/react-query';

export function Header() {
  const router = useRouter();
  const { user, tenant, impersonation, logout } = useAuthStore();
  const { theme, setTheme, unreadNotificationsCount } = useUIStore();
  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<any>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
  const unreadCount: number = Math.max(unreadNotificationsCount, (unreadData as any)?.data?.count ?? 0);

  const handleLogout = async () => {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      await api.post('/auth/logout', refreshToken ? { refreshToken } : undefined);
    } catch {}
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        {tenant && (
          <span className="truncate text-sm text-muted-foreground">
            {tenant.name} <span className="opacity-60">/ {tenant.slug}</span>
          </span>
        )}
        {impersonation && <Badge variant="warning">Impersonating</Badge>}
        {isOwner && <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">Platform owner</Badge>}
      </div>

      {isOwner && (
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin')}>
          <Crown className="mr-2 h-4 w-4 text-amber-500" /> Owner console
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <Button variant="ghost" size="icon" className="relative" onClick={() => router.push('/dashboard/notifications')} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-bold leading-4 text-white text-center shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} alt={user?.firstName} />
              <AvatarFallback>{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground">{user?.role}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {impersonation && (
            <>
              <DropdownMenuItem onClick={exitImpersonation}>
                <UserCog className="mr-2 h-4 w-4" /> Exit impersonation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isOwner && (
            <DropdownMenuItem onClick={() => router.push('/dashboard/admin')}>
              <Crown className="mr-2 h-4 w-4" /> Owner console
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
            <User className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
