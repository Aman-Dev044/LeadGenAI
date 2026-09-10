'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  XCircle,
  Flame,
  Sun,
  Snowflake,
  BarChart3,
  Grid3X3,
  Layers,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { formatNumber } from './admin-ui';

const PLAN_COLORS = {
  light: {
    free: '#3b82f6',
    starter: '#0d9488',
    professional: '#8b5cf6',
    enterprise: '#f59e0b',
  },
  dark: {
    free: '#60a5fa',
    starter: '#14b8a6',
    professional: '#a78bfa',
    enterprise: '#fbbf24',
  },
};

const PLAN_BG_STYLES: Record<string, { badge: string; border: string; glow: string; desc: string }> = {
  free: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    border: 'border-blue-500/30 hover:border-blue-500/60',
    glow: 'from-blue-500/10 via-transparent to-transparent',
    desc: 'Up to 100 leads · 1 agent',
  },
  starter: {
    badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    border: 'border-teal-500/30 hover:border-teal-500/60',
    glow: 'from-teal-500/10 via-transparent to-transparent',
    desc: 'Up to 1,000 leads · 3 agents',
  },
  professional: {
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    border: 'border-purple-500/30 hover:border-purple-500/60',
    glow: 'from-purple-500/10 via-transparent to-transparent',
    desc: 'Up to 10,000 leads · 10 agents',
  },
  enterprise: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    glow: 'from-amber-500/10 via-transparent to-transparent',
    desc: 'Unlimited scale · 100+ agents',
  },
};

const STATUS_COLORS = {
  light: { active: '#16a34a', trial: '#d97706', suspended: '#dc2626', cancelled: '#64748b' },
  dark: { active: '#22c55e', trial: '#f59e0b', suspended: '#ef4444', cancelled: '#94a3b8' },
};

const STATUS_BG_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  trial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  suspended: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  cancelled: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

const TEMP_COLORS = {
  light: { hot: '#dc2626', warm: '#d97706', cold: '#2563eb' },
  dark: { hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6' },
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  active: CheckCircle2,
  trial: Clock,
  suspended: Ban,
  cancelled: XCircle,
};

const TEMP_ICONS: Record<string, LucideIcon> = {
  hot: Flame,
  warm: Sun,
  cold: Snowflake,
};

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  icon?: LucideIcon;
  onClick?: () => void;
}

/** Interactive Segmented Progress Bar with rich hover, percentages, and drilldown click */
function SegmentedBar({
  title,
  segments,
  unit,
  onSegmentClick,
}: {
  title: string;
  segments: Segment[];
  unit: string;
  onSegmentClick?: (key: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="rounded-lg border bg-card/60 p-3.5 backdrop-blur-sm transition-all hover:bg-card/90">
      <div className="mb-2.5 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        </div>
        <p className="text-xs font-medium text-foreground">
          {formatNumber(total)} <span className="text-muted-foreground">{unit}</span>
        </p>
      </div>

      <div
        className="flex h-3.5 w-full gap-[3px] overflow-hidden rounded-full bg-muted/80 p-[1.5px] shadow-inner"
        role="img"
        aria-label={`${title}: ${visible.map((s) => `${s.label} ${s.value}`).join(', ')}`}
      >
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-muted" />
        ) : (
          visible.map((s) => (
            <TooltipProvider key={s.key}>
              <Tooltip delayDuration={50}>
                <TooltipTrigger asChild>
                  <div
                    onMouseEnter={() => setHover(s.key)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (s.onClick) s.onClick();
                      else if (onSegmentClick) onSegmentClick(s.key);
                    }}
                    className={cn(
                      'h-full cursor-pointer transition-all duration-200 first:rounded-l-full last:rounded-r-full hover:scale-y-110',
                      hover && hover !== s.key ? 'opacity-35' : 'opacity-100 shadow-sm'
                    )}
                    style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color, minWidth: 8 }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-medium">
                  <span className="capitalize">{s.label}</span>: {formatNumber(s.value)} ({pct(s.value)}%)
                  {onSegmentClick && <span className="block text-[10px] text-muted-foreground">Click to view</span>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))
        )}
      </div>

      <ul className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {segments.map((s) => {
          const Icon = s.icon;
          const dim = hover && hover !== s.key;
          const isSelected = hover === s.key;
          return (
            <li
              key={s.key}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (s.onClick) s.onClick();
                else if (onSegmentClick) onSegmentClick(s.key);
              }}
              className={cn(
                'group flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1 text-xs transition-all',
                dim && 'opacity-40',
                isSelected && 'border-border bg-accent/70 shadow-xs',
                !isSelected && 'hover:bg-accent/40',
                s.value === 0 && 'text-muted-foreground/60'
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5 truncate">
                <span className="h-2 w-2 shrink-0 rounded-full shadow-xs" style={{ backgroundColor: s.color }} />
                {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />}
                <span className="truncate capitalize font-medium">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="font-semibold text-foreground">{s.value}</span>
                <span className="text-[10px] text-muted-foreground">({pct(s.value)}%)</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface TenantMixProps {
  byPlan?: Record<string, number>;
  byStatus?: Record<string, number>;
  byPlanAndStatus?: Record<string, Record<string, number>>;
  leadsByTemperature?: Record<string, number>;
  totalTenants?: number;
}

export function TenantMixCard({
  byPlan = {},
  byStatus = {},
  byPlanAndStatus = {},
  leadsByTemperature = {},
  totalTenants = 0,
}: TenantMixProps) {
  const router = useRouter();
  const theme = useUIStore((s) => s.theme);
  const mode = theme === 'dark' ? 'dark' : 'light';
  const [activeTab, setActiveTab] = useState<'visual' | 'matrix' | 'tiers'>('visual');

  const plansList = ['free', 'starter', 'professional', 'enterprise'] as const;
  const statusList = ['active', 'trial', 'suspended', 'cancelled'] as const;

  const plans: Segment[] = plansList.map((p) => ({
    key: p,
    label: p,
    value: byPlan[p] || 0,
    color: PLAN_COLORS[mode][p],
    onClick: () => router.push(`/dashboard/admin/tenants?plan=${p}`),
  }));

  const statuses: Segment[] = statusList.map((s) => ({
    key: s,
    label: s,
    value: byStatus[s] || 0,
    color: STATUS_COLORS[mode][s],
    icon: STATUS_ICONS[s],
    onClick: () => router.push(`/dashboard/admin/tenants?status=${s}`),
  }));

  const temps: Segment[] = (['hot', 'warm', 'cold'] as const).map((t) => ({
    key: t,
    label: t,
    value: leadsByTemperature[t] || 0,
    color: TEMP_COLORS[mode][t],
    icon: TEMP_ICONS[t],
  }));

  const payingTenants = (byPlan.starter || 0) + (byPlan.professional || 0) + (byPlan.enterprise || 0);
  const payingPct = totalTenants ? Math.round((payingTenants / totalTenants) * 100) : 0;
  const activeTenants = byStatus.active || 0;
  const activePct = totalTenants ? Math.round((activeTenants / totalTenants) * 100) : 0;
  const trialTenants = byStatus.trial || 0;
  const trialPct = totalTenants ? Math.round((trialTenants / totalTenants) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border shadow-sm">
      {/* Background ambient accent */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              Tenant Mix & Platform Distribution
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Live breakdown across {totalTenants} workspaces by tier, health status, and lead capture.
            </CardDescription>
          </div>

          {/* View switcher buttons */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('visual')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all',
                activeTab === 'visual'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Visual Mix
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all',
                activeTab === 'matrix'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              Matrix
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all',
                activeTab === 'tiers'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Plan Tiers
            </button>
          </div>
        </div>

        {/* Quick KPI summary chips */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-medium text-muted-foreground">Paid Mix</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-foreground">{payingPct}%</span>
              <span className="ml-1 text-[10px] text-muted-foreground">({payingTenants})</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground">Active Health</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-foreground">{activePct}%</span>
              <span className="ml-1 text-[10px] text-muted-foreground">({activeTenants})</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-muted-foreground">In Trial</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-foreground">{trialPct}%</span>
              <span className="ml-1 text-[10px] text-muted-foreground">({trialTenants})</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* VIEW 1: Visual Stacked Bars */}
        {activeTab === 'visual' && (
          <div className="space-y-3.5 animate-in fade-in-50 duration-200">
            <SegmentedBar
              title="Distribution by Plan"
              segments={plans}
              unit="tenants"
              onSegmentClick={(plan) => router.push(`/dashboard/admin/tenants?plan=${plan}`)}
            />
            <SegmentedBar
              title="Distribution by Status"
              segments={statuses}
              unit="tenants"
              onSegmentClick={(status) => router.push(`/dashboard/admin/tenants?status=${status}`)}
            />
            <SegmentedBar
              title="Captured Leads by Temperature"
              segments={temps}
              unit="leads"
            />
          </div>
        )}

        {/* VIEW 2: Plan x Status Cross-Tabulation Matrix */}
        {activeTab === 'matrix' && (
          <div className="animate-in fade-in-50 duration-200 space-y-3">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Plan / Tier</th>
                    {statusList.map((st) => {
                      const Icon = STATUS_ICONS[st];
                      return (
                        <th key={st} className="px-3 py-2.5 font-semibold text-center">
                          <span className="inline-flex items-center gap-1 capitalize">
                            {Icon && <Icon className="h-3 w-3" />} {st}
                          </span>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plansList.map((p) => {
                    const planTotal = byPlan[p] || 0;
                    const planPct = totalTenants ? Math.round((planTotal / totalTenants) * 100) : 0;
                    return (
                      <tr key={p} className="hover:bg-accent/40 transition-colors">
                        <td className="px-3 py-2.5 font-medium">
                          <button
                            onClick={() => router.push(`/dashboard/admin/tenants?plan=${p}`)}
                            className="flex items-center gap-1.5 font-semibold capitalize text-foreground hover:underline"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAN_COLORS[mode][p] }} />
                            {p}
                          </button>
                        </td>

                        {statusList.map((st) => {
                          const count = byPlanAndStatus[p]?.[st] ?? (
                            (byPlan[p] && byStatus[st] && totalTenants)
                              ? Math.round(((byPlan[p] * byStatus[st]) / totalTenants))
                              : 0
                          );
                          return (
                            <td key={st} className="px-3 py-2.5 text-center">
                              {count > 0 ? (
                                <button
                                  onClick={() => router.push(`/dashboard/admin/tenants?plan=${p}&status=${st}`)}
                                  className={cn(
                                    'inline-flex min-w-[28px] items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold transition-all hover:scale-105',
                                    STATUS_BG_STYLES[st]
                                  )}
                                >
                                  {count}
                                </button>
                              ) : (
                                <span className="text-muted-foreground/40 font-mono">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                          {planTotal}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                          {planPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold text-foreground">
                    <td className="px-3 py-2.5">Total</td>
                    {statusList.map((st) => (
                      <td key={st} className="px-3 py-2.5 text-center font-bold tabular-nums">
                        {byStatus[st] || 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                      {totalTenants}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Tip: Click any cell count or plan name to view filtered workspaces.
            </p>
          </div>
        )}

        {/* VIEW 3: Plan Tiers Deep Dive Cards */}
        {activeTab === 'tiers' && (
          <div className="grid gap-3 sm:grid-cols-2 animate-in fade-in-50 duration-200">
            {plansList.map((p) => {
              const count = byPlan[p] || 0;
              const pct = totalTenants ? Math.round((count / totalTenants) * 100) : 0;
              const styles = PLAN_BG_STYLES[p];
              const pStatus = byPlanAndStatus[p] || {};

              return (
                <div
                  key={p}
                  className={cn(
                    'relative flex flex-col justify-between rounded-lg border bg-gradient-to-br p-3.5 transition-all duration-200',
                    styles.border,
                    styles.glow
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn('capitalize font-bold', styles.badge)}>
                        {p}
                      </Badge>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {count} <span className="text-muted-foreground font-normal">({pct}%)</span>
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {styles.desc}
                    </p>

                    {/* Mini status distribution for this tier */}
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {statusList.map((st) => {
                        const stCount = pStatus[st] ?? 0;
                        if (stCount === 0) return null;
                        const Icon = STATUS_ICONS[st];
                        return (
                          <span
                            key={st}
                            className={cn(
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border',
                              STATUS_BG_STYLES[st]
                            )}
                          >
                            {Icon && <Icon className="h-2.5 w-2.5" />}
                            {stCount} {st}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {p === 'free' ? 'Free tier' : 'Paid subscription'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-primary hover:text-primary"
                      onClick={() => router.push(`/dashboard/admin/tenants?plan=${p}`)}
                    >
                      View tenants <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
