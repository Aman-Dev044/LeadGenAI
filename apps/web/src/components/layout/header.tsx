'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronRight, Command, Crown, LogOut, Moon, Search, Sun, User, UserCog } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, getInitials } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { exitImpersonation } from '@/lib/impersonation';
import { useQuery } from '@tanstack/react-query';
import { allNavItems, type NavItem } from './sidebar';

function useBreadcrumb(pathname: string, isOwner: boolean) {
  return useMemo(() => {
    const items = allNavItems(isOwner);
    const match = [...items]
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + '/')));
    const crumbs: { label: string; href?: string }[] = [];
    if (pathname.startsWith('/dashboard/admin')) crumbs.push({ label: 'Owner console', href: '/dashboard/admin' });
    else crumbs.push({ label: 'Workspace', href: '/dashboard' });
    if (match && match.href !== crumbs[0].href) {
      crumbs.push({ label: match.label.replace('Owner · ', ''), href: match.href });
    }
    if (match && pathname !== match.href && pathname.startsWith(match.href + '/')) crumbs.push({ label: 'Details' });
    return crumbs;
  }, [pathname, isOwner]);
}

function QuickJump({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => i.label.toLowerCase().includes(s)).slice(0, 8);
  }, [q, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setCursor(0), [q]);

  const go = (item?: NavItem) => {
    if (!item) return;
    router.push(item.href);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative hidden md:block w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          if (e.key === 'Enter') go(results[cursor]);
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Jump to a page…"
        className="h-9 w-full rounded-lg border border-input bg-card/70 pl-9 pr-16 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/15"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex">
        <Command className="h-3 w-3" />K
      </kbd>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-float animate-in fade-in-0 zoom-in-95">
          {results.map((item, i) => (
            <button
              key={item.href}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(item)}
              onMouseEnter={() => setCursor(i)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors cursor-pointer',
                i === cursor ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-[10px] text-muted-foreground">{item.href.replace('/dashboard', '') || '/'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, tenant, impersonation, logout } = useAuthStore();
  const { theme, setTheme, unreadNotificationsCount } = useUIStore();
  const isOwner = user?.role === 'SUPER_ADMIN' && !impersonation;
  const crumbs = useBreadcrumb(pathname, isOwner);
  const navItems = useMemo(() => allNavItems(isOwner, user?.role), [isOwner, user?.role]);

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b glass px-4 md:px-6">
      {/* Breadcrumb */}
      <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={cn('truncate', i === crumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {c.label}
              </span>
            )}
          </span>
        ))}
        {impersonation && <Badge variant="warning" dot className="ml-2">Impersonating</Badge>}
        {isOwner && !pathname.startsWith('/dashboard/admin') && (
          <Badge variant="warning" className="ml-2 hidden sm:inline-flex">Platform owner</Badge>
        )}
      </nav>

      <QuickJump items={navItems} />

      <div className="flex items-center gap-1">
        {isOwner && !pathname.startsWith('/dashboard/admin') && (
          <Button variant="outline" size="sm" className="hidden lg:inline-flex" onClick={() => router.push('/dashboard/admin')}>
            <Crown className="h-4 w-4 text-amber-500" /> Owner console
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full"
              onClick={() => router.push('/dashboard/notifications')}
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full border bg-card/70 py-1 pl-1 pr-2.5 shadow-xs transition-colors hover:bg-accent cursor-pointer">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar} alt={user?.firstName} />
                <AvatarFallback>{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:block max-w-[120px] truncate text-[13px] font-medium">{user?.firstName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar} alt={user?.firstName} />
                  <AvatarFallback>{user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="secondary" className="capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</Badge>
                {tenant && <span className="truncate text-[11px] text-muted-foreground">{tenant.name}</span>}
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
                <Crown className="mr-2 h-4 w-4 text-amber-500" /> Owner console
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <User className="mr-2 h-4 w-4" /> Profile & settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10">
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
