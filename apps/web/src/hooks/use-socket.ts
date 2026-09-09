'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth-store';

const SOCKET_URL = (
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000'
).replace(/\/api\/v1\/?$/, '');

// The API exposes user notifications on the "/notifications" namespace
const NOTIFICATIONS_NAMESPACE = `${SOCKET_URL}/notifications`;

let globalSocket: Socket | null = null;
let globalToken: string | null = null;
let listenerCount = 0;

function getSocket(token: string | null): Socket | null {
  if (!token) return null;

  if (globalSocket && globalToken === token) {
    return globalSocket;
  }

  globalSocket?.disconnect();
  globalToken = token;

  globalSocket = io(NOTIFICATIONS_NAMESPACE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  return globalSocket;
}

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = getSocket(accessToken);
    if (!socket) return;

    socketRef.current = socket;
    listenerCount++;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onError = (err: Error) => {
      console.error('[Socket] Connection error:', err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    if (socket.connected) {
      setIsConnected(true);
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      listenerCount--;

      // Only disconnect if no more listeners
      if (listenerCount <= 0) {
        listenerCount = 0;
        socket.disconnect();
        globalSocket = null;
        globalToken = null;
      }
    };
  }, [accessToken, isAuthenticated]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated && globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
      globalToken = null;
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [isAuthenticated]);

  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) {
      socketRef.current?.off(event, handler);
    } else {
      socketRef.current?.off(event);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
  };
}
