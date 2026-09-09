'use client';
import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Send, Bot, User, ArrowLeftRight, Wifi, WifiOff, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/shared/loading';
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

  if (isLoading) return <Loading />;
  if (!conversation) return <div>Conversation not found</div>;

  const isLiveChat = (conversation.mode === 'human' || conversation.mode === 'hybrid') && conversation.status !== 'ended';
  const canSend = isLiveChat && conversation.status !== 'ended';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="success" className="gap-1"><Wifi className="h-3 w-3" /> Live</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Polling</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Chat Panel */}
        <div className="md:col-span-2">
          <Card className="h-[650px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {isLiveChat ? 'Live Chat' : 'Chat'}
                </CardTitle>
                <Badge>{conversation.status}</Badge>
                <Badge variant="outline">{conversation.mode}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {conversation.status === 'active' && conversation.mode === 'bot' && (
                  <Button variant="outline" size="sm" onClick={() => handoffMutation.mutate()}>
                    <ArrowLeftRight className="mr-2 h-3 w-3" /> Take Over
                  </Button>
                )}
                {conversation.status !== 'ended' && (
                  <Button variant="outline" size="sm" onClick={() => endMutation.mutate()}>
                    End Chat
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg: any) => (
                  <div
                    key={msg._id}
                    className={cn(
                      'flex gap-3',
                      msg.sender === 'visitor' ? '' : 'flex-row-reverse',
                      msg._optimistic && 'opacity-60',
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      msg.sender === 'visitor' ? 'bg-secondary' : msg.sender === 'bot' ? 'bg-primary/10' : 'bg-green-100',
                    )}>
                      {msg.sender === 'bot' ? (
                        <Bot className="h-4 w-4" />
                      ) : msg.sender === 'agent' ? (
                        <User className="h-4 w-4 text-green-700" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className={cn(
                      'max-w-[70%] rounded-lg px-4 py-2',
                      msg.sender === 'visitor' ? 'bg-secondary' :
                      msg.sender === 'agent' ? 'bg-green-50 border border-green-200' :
                      'bg-primary/10',
                      msg.type === 'tool_result' && 'bg-amber-50 border border-amber-200 text-xs font-mono',
                    )}>
                      {msg.type === 'tool_result' ? (
                        <p className="text-xs text-amber-700">{msg.content}</p>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                        {msg.sender === 'agent' && (
                          <span className="text-xs text-green-600 font-medium">Agent</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isVisitorTyping && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="bg-secondary rounded-lg px-4 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input - Visible for live chat */}
            {canSend && (
              <>
                <Separator />
                <div className="p-4 flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Type a message..."
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
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!message.trim() || sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Show notice for bot mode */}
            {conversation.mode === 'bot' && conversation.status === 'active' && (
              <>
                <Separator />
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                  Bot is handling this conversation. Click &quot;Take Over&quot; to start live chat.
                </div>
              </>
            )}

            {conversation.status === 'ended' && (
              <>
                <Separator />
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                  This conversation has ended.
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Visitor</span><span className="font-mono">{conversation.visitorId?.slice(0, 12)}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Messages</span><span>{conversation.messageCount}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><Badge variant="outline">{conversation.mode}</Badge></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Sentiment</span><span>{conversation.sentiment || 'N/A'}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{formatDate(conversation.createdAt)}</span></div>
              {conversation.endedAt && (
                <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Ended</span><span>{formatDate(conversation.endedAt)}</span></div></>
              )}
            </CardContent>
          </Card>

          {/* AI Summary Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">AI Summary</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => summaryMutation.mutate()}
                disabled={summaryMutation.isPending || messages.length < 2}
              >
                {summaryMutation.isPending ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="mr-1 h-3 w-3" /> {conversation.summary ? 'Regenerate' : 'Generate'}</>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {conversation.summary ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{conversation.summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No summary yet. Click &quot;Generate&quot; to create an AI summary of this conversation.
                </p>
              )}
            </CardContent>
          </Card>

          {conversation.leadId && (
            <Button variant="outline" className="w-full" onClick={() => router.push(`/dashboard/leads/${conversation.leadId}`)}>
              View Lead
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
