'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartEmpty, ChartTooltip } from './chart-kit';

interface Props {
  data: { _id: string; count: number }[];
  height?: number;
  label?: string;
  color?: string;
}

export function ConversationTrendChart({ data, height = 300, label = 'Conversations', color = '#6366f1' }: Props) {
  const chartData = data.map((item) => ({ date: item._id, value: item.count }));

  if (chartData.length === 0) return <ChartEmpty height={height} />;

  const id = `grad-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip content={<ChartTooltip labelFormatter={(v) => String(v)} />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          name={label}
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
