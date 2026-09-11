'use client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const PLANS = ['free', 'starter', 'professional', 'enterprise'];
export const TENANT_STATUSES = ['trial', 'active', 'suspended', 'cancelled'];
export const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON', 'VIEWER'];

export function PlanBadge({ plan }: { plan?: string }) {
  const variant = plan === 'enterprise' ? 'violet' : plan === 'professional' ? 'default' : plan === 'starter' ? 'info' : 'outline';
  return <Badge variant={variant as any} className="capitalize">{plan || 'free'}</Badge>;
}

export function StatusBadge({ status }: { status?: string }) {
  const variant = status === 'active' ? 'success' : status === 'trial' ? 'warning' : status === 'suspended' ? 'destructive' : 'secondary';
  return <Badge variant={variant as any} dot className="capitalize">{status || 'unknown'}</Badge>;
}

export function RoleBadge({ role }: { role?: string }) {
  const variant = role === 'SUPER_ADMIN' ? 'warning' : role === 'ADMIN' ? 'violet' : role === 'SALES_MANAGER' ? 'info' : 'secondary';
  return <Badge variant={variant as any} className="normal-case">{role?.toLowerCase().replace('_', ' ')}</Badge>;
}

/** Thin progress bar with colour that reflects how close a tenant is to its limit. */
export function UsageBar({ used, limit, label }: { used: number; limit?: number; label?: string }) {
  const pct = !limit || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = limit ? used > limit : false;
  const color = over || pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1 min-w-[140px]">
      {label && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{label}</span>
          <span className={cn(over && 'text-red-600 font-semibold')}>
            {formatNumber(used)} / {limit ? formatNumber(limit) : '∞'}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function formatNumber(n?: number) {
  if (n === undefined || n === null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-IN').format(n);
}

export function timeAgo(date?: string | Date | null) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

/** Download an authenticated file (the API needs the bearer token, so no plain <a href>). */
export async function downloadAuthenticated(path: string, filename: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
