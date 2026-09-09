'use client';
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/use-socket';
import { useUIStore } from '@/store/ui-store';
import { api } from '@/lib/api-client';
import type { Notification } from '@/types';

export function useRealtimeNotifications() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const {
    unreadNotificationsCount,
    setUnreadNotificationsCount,
    setHasNewHandoff,
    setHasNewLead,
    setPendingHandoffsCount,
    setNewLeadsCount,
  } = useUIStore();

  const handleNewNotification = useCallback(
    (notification: Notification) => {
      toast(notification.title, {
        description: notification.body,
      });

      setUnreadNotificationsCount((prev) => prev + 1);

      // Handle specific notification types for badges
      if (notification.type === 'handoff_request') {
        setHasNewHandoff(true);
        setPendingHandoffsCount((prev) => prev + 1);
        queryClient.invalidateQueries({ queryKey: ['handoffs'] });
      } else if (notification.type === 'new_lead') {
        setHasNewLead(true);
        setNewLeadsCount((prev) => prev + 1);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }

      // Invalidate notifications query so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [queryClient, setUnreadNotificationsCount, setHasNewHandoff, setHasNewLead, setPendingHandoffsCount, setNewLeadsCount],
  );

  const handleUnreadCount = useCallback((count: number) => {
    setUnreadNotificationsCount(count);
  }, [setUnreadNotificationsCount]);

  // Initial fetch for pending counts
  useEffect(() => {
    api.get<any>('/notifications/unread-count')
      .then((res: any) => {
        const count = res?.data?.count ?? res?.count ?? 0;
        setUnreadNotificationsCount(count);
      })
      .catch(() => {});

    api.get<any>('/handoffs/pending-count')
      .then((res: any) => {
        const count = res?.data?.count ?? res?.count ?? 0;
        if (count > 0) {
          setHasNewHandoff(true);
          setPendingHandoffsCount(count);
        }
      })
      .catch(() => {});
  }, [setUnreadNotificationsCount, setHasNewHandoff, setPendingHandoffsCount]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:unread-count', handleUnreadCount);

    // Request initial unread count
    socket.emit('notification:get-unread-count');

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:unread-count', handleUnreadCount);
    };
  }, [socket, isConnected, handleNewNotification, handleUnreadCount]);

  return {
    unreadCount: unreadNotificationsCount,
  };
}
