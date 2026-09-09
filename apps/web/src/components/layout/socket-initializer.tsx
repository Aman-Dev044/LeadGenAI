'use client';
import { useAuthStore } from '@/store/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';

export function SocketInitializer() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  return <SocketConnector />;
}

function SocketConnector() {
  // Initialize socket connection
  useSocket();

  // Listen for real-time notifications
  useRealtimeNotifications();

  return null;
}
