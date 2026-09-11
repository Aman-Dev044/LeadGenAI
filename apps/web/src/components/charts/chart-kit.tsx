'use client';
import { BarChart3 } from 'lucide-react';

/** Shared categorical palette so every chart on the dashboard reads as one system. */
export const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#14b8a6', '#64748b'];

export function ChartEmpty({ height = 300, message = 'No data yet' }: { height?: number; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground" style={{ height }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  labelFormatter?: (label: any) => string;
  valueFormatter?: (value: any, name?: string) => string;
}

/** Themed Recharts tooltip (pass as `content={<ChartTooltip />}`). */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-float">
      {label !== undefined && label !== '' && (
        <p className="mb-1 font-medium text-muted-foreground">{labelFormatter ? labelFormatter(label) : String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill || p.fill }} />
            <span className="capitalize text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold tabular text-foreground">
              {valueFormatter ? valueFormatter(p.value, p.name) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
