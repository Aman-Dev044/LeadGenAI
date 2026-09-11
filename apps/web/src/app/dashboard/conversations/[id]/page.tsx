'use client';
import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Send, Bot, User, ArrowLeftRight, WifiOff, FileText, Loader2, Sparkles, XCircle, MapPin, ArrowRight, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate, cn } from '@/lib/utils';
import { useChatSocket } from '@/hooks/use-chat-socket';

/** Synthesize a crisp ~1-sec message incoming alert tone */
function playIncomingMessageSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Pleasant alert chime (C5 -> G5 -> C6)
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);

    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch {}
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMsgCountRef = useRef(0);

  // WebSocket for real-time chat
  const { isConnected, isVisitorTyping, onNewMessage, emitTyping } = useChatSocket(id);

  const { data: convData, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<any>(`/conversations/${id}`),
  });

  const { data: msgData } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api.get<any>(`/conversations/${id}/messages`),
    refetchInterval: isConnected ? 15000 : 5000, // Slower poll when WS is connected
  });

  const sendMutation = useMutation({
    mutationFn: (body: any) => api.post(`/conversations/${id}/messages`, body),
    onSuccess: (data: any) => {
      const newMsg = data?.data || data;
      if (newMsg?._id) {
        setLocalMessages((prev) => {
          // Remove optimistic, add real
          const withoutOptimistic = prev.filter((m) => !m._optimistic);
          return [...withoutOptimistic, newMsg];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
      setMessage('');
      emitTyping(false);
      inputRef.current?.focus();
    },
    onError: (err: any) => {
      setLocalMessages((prev) => prev.filter((m) => !m._optimistic));
      toast.error(err.message || 'Failed to send message');
    },
  });

  const handoffMutation = useMutation({
    mutationFn: () => api.patch(`/conversations/${id}/handoff`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      toast.success('Conversation handed off');
    },
  });

  const summaryMutation = useMutation({
    mutationFn: () => api.post<any>(`/conversations/${id}/summary`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      toast.success('Summary generated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to generate summary'),
  });

  const endMutation = useMutation({
    mutationFn: () => api.patch(`/conversations/${id}/end`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      toast.success('Conversation ended');
    },
  });

  const conversation = convData?.data || (convData as any)?.data;
  const serverMessages = msgData?.data?.data || msgData?.data || [];

  // Merge server messages with local optimistic messages
  const allMessages = useCallback(() => {
    const serverIds = new Set(serverMessages.map((m: any) => m._id));
    const uniqueLocal = localMessages.filter((m) => !serverIds.has(m._id));
    return [...serverMessages, ...uniqueLocal];
  }, [serverMessages, localMessages]);

  const messages = allMessages();

  // Listen for new messages via WebSocket and play sound on visitor message
  useEffect(() => {
    const cleanup = onNewMessage((newMsg: any) => {
      if (newMsg?.sender === 'visitor') {
        playIncomingMessageSound();
      }
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
    });
    return cleanup;
  }, [onNewMessage, queryClient, id]);

  // Sync local messages & play sound on fallback polling if new visitor message arrived
  useEffect(() => {
    if (prevMsgCountRef.current > 0 && serverMessages.length > prevMsgCountRef.current) {
      const last = serverMessages[serverMessages.length - 1];
      if (last?.sender === 'visitor') {
        playIncomingMessageSound();
      }
    }
    prevMsgCountRef.current = serverMessages.length;
    setLocalMessages((prev) => prev.filter((m) => m._optimistic));
  }, [serverMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isVisitorTyping]);

  const handleSend = () => {
    const text = message.trim();
    if (!text || sendMutation.isPending) return;

    // Optimistic message
    const optimisticMsg = {
      _id: `opt_${Date.now()}`,
      conversationId: id,
      sender: 'agent',
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);

    sendMutation.mutate({ content: text });
  };

  const handleTyping = () => {
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000);
  };

  if (isLoading) return <Loading label="Opening conversation" />;
  if (!conversation) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Conversation not found"
        description="It may have been archived or you don't have access to it."
        actionLabel="Back to conversations"
        onAction={() => router.push('/dashboard/conversations')}
      />
    );
  }

  const isLiveChat = (conversation.mode === 'human' || conversation.mode === 'hybrid') && conversation.status !== 'ended';
  const canSend = isLiveChat && conversation.status !== 'ended';
  const visitorId: string = conversation.visitorId || '';
  const visitorLabel = `Visitor ${visitorId.slice(0, 8)}`;
  const location = [conversation.visitorInfo?.city, conversation.visitorInfo?.country].filter(Boolean).join(', ');
  const statusVariant: Record<string, 'success' | 'secondary' | 'warning' | 'info'> = { active: 'success', ended: 'secondary', handed_off: 'warning', archived: 'info' };
  const modeMeta: Record<string, { label: string; icon: any; cls: string }> = {
    bot: { label: 'AI bot', icon: Bot, cls: 'bg-primary/10 text-primary' },
    human: { label: 'Human', icon: User, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    hybrid: { label: 'Hybrid', icon: Sparkles, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  };
  const mode = modeMeta[conversation.mode] || modeMeta.bot;
  const ModeIcon = mode.icon;

  const senderAvatar = (sender: string) =>
    sender === 'bot' ? (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm">
        <Bot className="h-4 w-4" />
      </div>
    ) : sender === 'agent' ? (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
        <User className="h-4 w-4" />
      </div>
    ) : (
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600 text-[11px]">{visitorId.slice(0, 2).toUpperCase() || 'V'}</AvatarFallback>
      </Avatar>
    );

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="success" className="gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Polling</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Panel */}
        <div className="lg:col-span-2">
          <Card className="flex h-[calc(100vh-13rem)] min-h-[560px] flex-col overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 ring-2 ring-card">
                  <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600">{visitorId.slice(0, 2).toUpperCase() || 'V'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{visitorLabel}</p>
                    <Badge variant={statusVariant[conversation.status] || 'secondary'} dot>{conversation.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <ModeIcon className="h-3 w-3" /> {isLiveChat ? 'Live chat · ' : ''}{mode.label}{location ? ` · ${location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {conversation.status === 'active' && conversation.mode === 'bot' && (
                  <Button variant="gradient" size="sm" onClick={() => handoffMutation.mutate()}>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Take Over
                  </Button>
                )}
                {conversation.status !== 'ended' && (
                  <Button variant="outline" size="sm" onClick={() => endMutation.mutate()}>
                    <XCircle className="h-3.5 w-3.5" /> End Chat
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--color-foreground)_5%,transparent)_1px,transparent_0)] [background-size:18px_18px]">
              <div className="space-y-4 p-4 md:p-5">
                {messages.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">No messages yet.</div>
                )}
                {messages.map((msg: any) => {
                  const isVisitor = msg.sender === 'visitor';
                  const isTool = msg.type === 'tool_result';
                  return (
                    <div
                      key={msg._id}
                      className={cn('flex items-end gap-2.5', !isVisitor && 'flex-row-reverse', msg._optimistic && 'opacity-60')}
                    >
                      {senderAvatar(msg.sender)}
                      <div className={cn('flex max-w-[76%] flex-col gap-1', !isVisitor && 'items-end')}>
                        <div
                          className={cn(
                            'px-4 py-2.5 text-sm shadow-sm',
                            isTool
                              ? 'rounded-xl border border-amber-500/30 bg-amber-500/10 font-mono text-[11px] text-amber-700 dark:text-amber-300'
                              : isVisitor
                                ? 'rounded-2xl rounded-bl-md bg-card border'
                                : msg.sender === 'agent'
                                  ? 'rounded-2xl rounded-br-md bg-emerald-600 text-white'
                                  : 'rounded-2xl rounded-br-md bg-primary text-primary-foreground',
                          )}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-muted-foreground">
                          {msg.sender === 'agent' && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Agent</span>}
                          {msg.sender === 'bot' && <span className="font-semibold text-primary">AI</span>}
                          {isTool && <span className="font-semibold text-amber-600">Tool</span>}
                          <span>{formatDate(msg.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isVisitorTyping && (
                  <div className="flex items-end gap-2.5">
                    {senderAvatar('visitor')}
                    <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-sm">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer - Visible for live chat */}
            {canSend && (
              <div className="border-t bg-card p-3">
                <div className="flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 shadow-xs transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                  <Input
                    ref={inputRef}
                    placeholder="Type a reply… (Enter to send)"
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    autoFocus
                    className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-0"
                  />
                  <Button
                    size="icon"
                    variant="gradient"
                    className="h-9 w-9 shrink-0 rounded-lg"
                    onClick={handleSend}
                    disabled={!message.trim() || sendMutation.isPending}
                    aria-label="Send"
                  >
                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Show notice for bot mode */}
            {conversation.mode === 'bot' && conversation.status === 'active' && (
              <div className="flex items-center justify-center gap-2 border-t bg-primary/[0.04] px-4 py-3 text-center text-sm text-muted-foreground">
                <Bot className="h-4 w-4 text-primary" />
                AI is handling this conversation. Click <span className="font-semibold text-foreground">Take Over</span> to start a live chat.
              </div>
            )}

            {conversation.status === 'ended' && (
              <div className="flex items-center justify-center gap-2 border-t bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" /> This conversation has ended.
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Visitor card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Visitor</CardTitle>
              <CardDescription>Who you are talking to.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600">{visitorId.slice(0, 2).toUpperCase() || 'V'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{visitorLabel}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{visitorId.slice(0, 16)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                <span className="text-muted-foreground">Handled by</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', mode.cls)}><ModeIcon className="h-3.5 w-3.5" /></span>
                  {mode.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium tabular">{conversation.messageCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                <span className="text-muted-foreground">Sentiment</span>
                <span className="font-medium capitalize">{conversation.sentiment || 'N/A'}</span>
              </div>
              {location && (
                <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="inline-flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {location}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium text-right">{formatDate(conversation.createdAt)}</span>
              </div>
              {conversation.endedAt && (
                <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Ended</span>
                  <span className="font-medium text-right">{formatDate(conversation.endedAt)}</span>
                </div>
              )}
              {conversation.leadId && (
                <Button variant="soft" className="mt-4 w-full" onClick={() => router.push(`/dashboard/leads/${conversation.leadId}`)}>
                  <User className="h-4 w-4" /> View linked lead <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* AI Summary Card */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-500/20 to-transparent blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-500" /> AI summary</CardTitle>
                <CardDescription>Key points from the transcript.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => summaryMutation.mutate()}
                disabled={summaryMutation.isPending || messages.length < 2}
              >
                {summaryMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                ) : (
                  <><FileText className="h-3.5 w-3.5" /> {conversation.summary ? 'Regenerate' : 'Generate'}</>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {conversation.summary ? (
                <p className="rounded-xl border-l-4 border-violet-400 bg-violet-500/[0.06] p-3 text-sm leading-relaxed">{conversation.summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No summary yet. Generate one to get a quick recap of what the visitor wanted.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
