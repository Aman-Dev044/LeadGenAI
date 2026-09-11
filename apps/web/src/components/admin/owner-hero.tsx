'use client';
import Link from 'next/link';
import { Crown, Wrench, UserPlus, Megaphone, Plus, SlidersHorizontal, Activity, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { timeAgo } from '@/components/admin/admin-ui';

interface OwnerHeroProps {
  maintenanceMode?: boolean;
  signupEnabled?: boolean;
  announcement?: { message: string; level: string } | null;
  generatedAt?: string;
}

function StatusChip({ on, onLabel, offLabel, icon: Icon, onClass, href }: { on: boolean; onLabel: string; offLabel: string; icon: any; onClass: string; href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10',
        on ? onClass : 'border-white/20 text-white/70',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-current' : 'bg-white/40')} />
      <Icon className="h-3.5 w-3.5" />
      {on ? onLabel : offLabel}
    </Link>
  );
}

/** Gradient header for the owner console with live platform switches and quick actions. */
export function OwnerHero({ maintenanceMode, signupEnabled = true, announcement, generatedAt }: OwnerHeroProps) {
  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-float ring-1 ring-white/10">
      {/* soft glow accents */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Platform owner
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/20 ring-1 ring-amber-300/40">
              <Crown className="h-6 w-6 text-amber-300" />
            </span>
            Owner console
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {greeting}{user?.firstName ? `, ${user.firstName}` : ''}. Platform-wide view across every tenant, user and conversation.
            {generatedAt && <span className="ml-2 text-white/40">Updated {timeAgo(generatedAt)}</span>}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusChip
              on={!!maintenanceMode}
              onLabel="Maintenance mode ON"
              offLabel="Serving normally"
              icon={Wrench}
              onClass="border-orange-400/60 bg-orange-500/20 text-orange-200"
              href="/dashboard/admin/settings"
            />
            <StatusChip
              on={!!signupEnabled}
              onLabel="Signup open"
              offLabel="Signup closed"
              icon={UserPlus}
              onClass="border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
              href="/dashboard/admin/settings"
            />
            <StatusChip
              on={!!announcement}
              onLabel={`Banner live${announcement?.level ? ` · ${announcement.level}` : ''}`}
              offLabel="No banner"
              icon={Megaphone}
              onClass="border-sky-400/60 bg-sky-500/20 text-sky-200"
              href="/dashboard/admin/announcements"
            />
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <Button asChild variant="secondary" className="justify-start bg-white/10 text-white hover:bg-white/20">
            <Link href="/dashboard/admin/tenants"><Plus className="mr-2 h-4 w-4" /> New tenant</Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start bg-white/10 text-white hover:bg-white/20">
            <Link href="/dashboard/admin/announcements"><Megaphone className="mr-2 h-4 w-4" /> Announce</Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start bg-white/10 text-white hover:bg-white/20">
            <Link href="/dashboard/admin/settings"><SlidersHorizontal className="mr-2 h-4 w-4" /> Settings</Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start bg-white/10 text-white hover:bg-white/20">
            <Link href="/dashboard/admin/system"><Activity className="mr-2 h-4 w-4" /> System <ArrowRight className="ml-auto h-3 w-3 opacity-60" /></Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
