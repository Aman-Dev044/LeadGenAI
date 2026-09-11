import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean; label?: string };
  tone?: StatTone;
  className?: string;
  onClick?: () => void;
  /** Optional small element rendered at the bottom (progress bar, sparkline, chips) */
  footer?: React.ReactNode;
}

const TONES: Record<StatTone, { tile: string; glow: string }> = {
  primary: { tile: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400', glow: 'from-indigo-500/15' },
  success: { tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', glow: 'from-emerald-500/15' },
  warning: { tile: 'bg-amber-500/14 text-amber-600 dark:text-amber-400', glow: 'from-amber-500/15' },
  danger: { tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', glow: 'from-rose-500/15' },
  info: { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', glow: 'from-sky-500/15' },
  violet: { tile: 'bg-violet-500/12 text-violet-600 dark:text-violet-400', glow: 'from-violet-500/15' },
  neutral: { tile: 'bg-slate-500/12 text-slate-600 dark:text-slate-300', glow: 'from-slate-500/10' },
};

export function StatCard({ title, value, description, icon: Icon, trend, tone = 'primary', className, onClick, footer }: StatCardProps) {
  const t = TONES[tone];
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cn('group relative overflow-hidden p-5', className)}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity group-hover:opacity-100',
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-2 text-[28px] font-bold leading-none tracking-tight tabular">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', t.tile)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {(description || trend) && (
        <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
                trend.isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
              )}
            >
              {trend.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </span>
          )}
          {trend?.label && <span>{trend.label}</span>}
          {description && <span className="min-w-0">{description}</span>}
        </div>
      )}
      {footer && <div className="relative mt-4">{footer}</div>}
    </Card>
  );
}
