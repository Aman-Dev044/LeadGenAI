'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth-store';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/v1$/, '');

export function useChatSocket(conversationId: string | null) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !conversationId) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_conversation', { conversationId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('typing', (data: { conversationId: string; sender: string; isTyping: boolean }) => {
      if (data.conversationId === conversationId && data.sender === 'visitor') {
        setIsVisitorTyping(data.isTyping);
        // Auto-clear typing after 5 seconds
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => setIsVisitorTyping(false), 5000);
        }
      }
    });

    return () => {
      socket.emit('leave_conversation', { conversationId });
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [accessToken, isAuthenticated, conversationId]);

  const onNewMessage = useCallback(
    (handler: (message: any) => void) => {
      socketRef.current?.on('new_message', handler);
      return () => { socketRef.current?.off('new_message', handler); };
    },
    [],
  );

  const onConversationUpdate = useCallback(
    (handler: (update: any) => void) => {
      socketRef.current?.on('conversation_updated', handler);
      return () => { socketRef.current?.off('conversation_updated', handler); };
    },
    [],
  );

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (conversationId) {
        socketRef.current?.emit('typing', { conversationId, isTyping });
      }
    },
    [conversationId],
  );

  return {
    isConnected,
    isVisitorTyping,
    onNewMessage,
    onConversationUpdate,
    emitTyping,
  };
}
