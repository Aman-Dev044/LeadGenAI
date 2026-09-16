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
      } else if (notification.type === 'appointment') {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      } else if (notification.type === 'deletion_request') {
        queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
        queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests-count'] });
        queryClient.invalidateQueries({ queryKey: ['staff-deletion-requests'] });
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

    // Real-time deletion events
    const handleAccountDeleted = (data: any) => {
      toast.error('Account Deleted', {
        description: data?.message || 'Your account has been deleted by administration. Signing you out...',
        duration: 5000,
      });
      setTimeout(() => {
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('la_platform_tenant');
        } catch {}
        if (typeof document !== 'undefined') {
          document.cookie = 'la_auth=; Path=/; Max-Age=0; SameSite=Lax';
        }
        window.location.href = '/auth/login';
      }, 1000);
    };

    const handleTenantDeleted = (data: any) => {
      toast.error('Organization Deleted', {
        description: data?.message || 'Your organization workspace has been deleted by platform administration. Signing you out...',
        duration: 5000,
      });
      setTimeout(() => {
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('la_platform_tenant');
        } catch {}
        if (typeof document !== 'undefined') {
          document.cookie = 'la_auth=; Path=/; Max-Age=0; SameSite=Lax';
        }
        window.location.href = '/auth/login';
      }, 1000);
    };

    const handleStaffDeletionRequest = (data: any) => {
      toast.warning('Staff Deletion Request', {
        description: `${data.userName} (${data.userRole}) has requested account deletion.`,
      });
      queryClient.invalidateQueries({ queryKey: ['staff-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    };

    const handleStaffDeletionProcessed = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
    };

    const handleSuperAdminDeletionProcessed = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenants-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    };

    const handleSuperAdminDeletionRequest = (data: any) => {
      toast.error('New Organization Deletion Request', {
        description: `${data.userName} requested deletion for organization "${data.tenantName}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleDeletionRejected = (data: any) => {
      toast.info('Deletion Request Update', {
        description: data?.reason ? `Request was not approved: ${data.reason}` : 'Your deletion request was reviewed.',
      });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
    };

    socket.on('user:account-deleted', handleAccountDeleted);
    socket.on('tenant:deleted', handleTenantDeleted);
    socket.on('admin:staff-deletion-request', handleStaffDeletionRequest);
    socket.on('staff:deletion-processed', handleStaffDeletionProcessed);
    socket.on('superadmin:deletion-request', handleSuperAdminDeletionRequest);
    socket.on('superadmin:deletion-processed', handleSuperAdminDeletionProcessed);
    socket.on('deletion-request:rejected', handleDeletionRejected);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:unread-count', handleUnreadCount);
      socket.off('user:account-deleted', handleAccountDeleted);
      socket.off('tenant:deleted', handleTenantDeleted);
      socket.off('admin:staff-deletion-request', handleStaffDeletionRequest);
      socket.off('staff:deletion-processed', handleStaffDeletionProcessed);
      socket.off('superadmin:deletion-request', handleSuperAdminDeletionRequest);
      socket.off('superadmin:deletion-processed', handleSuperAdminDeletionProcessed);
      socket.off('deletion-request:rejected', handleDeletionRejected);
    };
  }, [socket, isConnected, handleNewNotification, handleUnreadCount, queryClient]);

  return {
    unreadCount: unreadNotificationsCount,
  };
}
