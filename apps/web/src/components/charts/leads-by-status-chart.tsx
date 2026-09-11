'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS, ChartEmpty, ChartTooltip } from './chart-kit';

interface Props {
  data: { _id: string; count: number }[];
  height?: number;
}

export function LeadsByStatusChart({ data, height = 300 }: Props) {
  const chartData = data.map((item) => ({ name: item._id, value: item.count }));
  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (chartData.length === 0 || total === 0) return <ChartEmpty height={height} />;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row" style={{ minHeight: height }}>
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={6}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular leading-none">{total}</span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="w-full sm:w-1/2 space-y-2">
        {chartData.map((d, i) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center gap-3 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="flex-1 capitalize text-muted-foreground truncate">{d.name}</span>
              <span className="font-semibold tabular">{d.value}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
