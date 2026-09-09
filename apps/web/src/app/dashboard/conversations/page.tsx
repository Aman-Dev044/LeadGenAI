'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import type { Conversation } from '@/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  active: 'success', ended: 'secondary', handed_off: 'warning', archived: 'default',
};

const modeColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  bot: 'default', human: 'secondary', hybrid: 'outline',
};

export default function ConversationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['conversations', page, limit, status],
    queryFn: () => api.get<any>('/conversations', {
      page, limit, status: status || undefined,
    }),
    refetchInterval: 5000,
  });

  const conversations = (data as any)?.data?.data || (data as any)?.data || [];
  const total = (data as any)?.data?.total || 0;
  const totalPages = (data as any)?.data?.totalPages || 1;

  const columns = [
    {
      key: 'visitorId', label: 'Visitor',
      render: (c: Conversation) => <span className="font-mono text-sm">{c.visitorId?.slice(0, 12)}...</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (c: Conversation) => <Badge variant={statusColors[c.status]}>{c.status}</Badge>,
    },
    {
      key: 'mode', label: 'Mode',
      render: (c: Conversation) => <Badge variant={modeColors[c.mode]}>{c.mode}</Badge>,
    },
    { key: 'messageCount', label: 'Messages', render: (c: Conversation) => c.messageCount },
    { key: 'sentiment', label: 'Sentiment', render: (c: Conversation) => c.sentiment || '-' },
    { key: 'createdAt', label: 'Started', render: (c: Conversation) => formatDate(c.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Conversations" description="View and manage all chat conversations" />

      <div className="flex items-center gap-4 mb-4">
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value="handed_off">Handed Off</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={conversations}
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isLoading}
        onRowClick={(c) => router.push(`/dashboard/conversations/${c._id}`)}
      />
    </div>
  );
}
