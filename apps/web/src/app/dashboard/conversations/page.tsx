'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Bot, UserRound, Sparkles, Radio, Smile, Frown, Meh } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Toolbar, ToolbarSpacer } from '@/components/shared/toolbar';
import type { Conversation } from '@/types';
import { formatDate, cn } from '@/lib/utils';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'info'> = {
  active: 'success', ended: 'secondary', handed_off: 'warning', archived: 'info',
};

const MODE_META: Record<string, { label: string; icon: any; cls: string }> = {
  bot: { label: 'AI bot', icon: Bot, cls: 'bg-primary/10 text-primary' },
  human: { label: 'Human', icon: UserRound, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  hybrid: { label: 'Hybrid', icon: Sparkles, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
};

function Sentiment({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toLowerCase();
  const meta = v.includes('pos')
    ? { icon: Smile, cls: 'text-emerald-600 dark:text-emerald-400' }
    : v.includes('neg')
      ? { icon: Frown, cls: 'text-rose-600 dark:text-rose-400' }
      : { icon: Meh, cls: 'text-amber-600 dark:text-amber-400' };
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm capitalize', meta.cls)}>
      <Icon className="h-4 w-4" /> {value}
    </span>
  );
}

// Deterministic avatar gradient per visitor id
const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];
function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

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

  const activeOnPage = conversations.filter((c: Conversation) => c.status === 'active').length;
  const handedOffOnPage = conversations.filter((c: Conversation) => c.status === 'handed_off' || c.mode === 'human').length;
  const messagesOnPage = conversations.reduce((s: number, c: Conversation) => s + (c.messageCount || 0), 0);

  const columns = [
    {
      key: 'visitorId', label: 'Visitor',
      render: (c: Conversation) => {
        const vid = c.visitorId || '';
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={cn('bg-gradient-to-br', gradientFor(vid))}>
                {vid.slice(0, 2).toUpperCase() || 'V'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold truncate">Visitor <span className="font-mono text-xs font-normal text-muted-foreground">{vid.slice(0, 8)}</span></div>
              <div className="text-xs text-muted-foreground truncate">
                {[c.visitorInfo?.city, c.visitorInfo?.country].filter(Boolean).join(', ') || 'Location unknown'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'status', label: 'Status',
      render: (c: Conversation) => (
        <Badge variant={statusColors[c.status] || 'secondary'} dot>
          {c.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'mode', label: 'Handled by',
      render: (c: Conversation) => {
        const m = MODE_META[c.mode] || MODE_META.bot;
        const Icon = m.icon;
        return (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', m.cls)}><Icon className="h-3.5 w-3.5" /></span>
            {m.label}
          </span>
        );
      },
    },
    {
      key: 'messageCount', label: 'Messages',
      render: (c: Conversation) => (
        <span className="inline-flex items-center gap-1.5 tabular font-semibold">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> {c.messageCount}
        </span>
      ),
    },
    { key: 'sentiment', label: 'Sentiment', render: (c: Conversation) => <Sentiment value={c.sentiment} /> },
    {
      key: 'createdAt', label: 'Started',
      render: (c: Conversation) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Every chat your AI agents and team have with website visitors, updated live."
        icon={MessageSquare}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total conversations" value={total} icon={MessageSquare} description="matching current filter" tone="primary" />
        <StatCard title="Active on this page" value={activeOnPage} icon={Radio} description={`of ${conversations.length} shown`} tone="success" />
        <StatCard title="With a human" value={handedOffOnPage} icon={UserRound} description="handed off or live" tone="warning" />
        <StatCard title="Messages on this page" value={messagesOnPage} icon={Sparkles} description="exchanged in shown chats" tone="violet" />
      </div>

      <Toolbar>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value="handed_off">Handed Off</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="hidden sm:inline-flex items-center gap-1.5 pr-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Auto-refreshing
        </span>
      </Toolbar>

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
        emptyMessage="No conversations yet"
        emptyDescription="Once your widget is live, visitor chats will appear here."
      />
    </div>
  );
}
