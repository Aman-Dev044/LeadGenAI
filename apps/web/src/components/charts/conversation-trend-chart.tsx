'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { _id: string; count: number }[];
}

export function ConversationTrendChart({ data }: Props) {
  const chartData = data.map((item) => ({ date: item._id, conversations: item.count }));

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Area type="monotone" dataKey="conversations" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
