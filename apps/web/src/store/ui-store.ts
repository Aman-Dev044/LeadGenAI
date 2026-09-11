import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  unreadNotificationsCount: number;
  hasNewHandoff: boolean;
  hasNewLead: boolean;
  pendingHandoffsCount: number;
  newLeadsCount: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setUnreadNotificationsCount: (count: number | ((prev: number) => number)) => void;
  setHasNewHandoff: (has: boolean) => void;
  setHasNewLead: (has: boolean) => void;
  setPendingHandoffsCount: (count: number | ((prev: number) => number)) => void;
  setNewLeadsCount: (count: number | ((prev: number) => number)) => void;
  clearHandoffBadge: () => void;
  clearLeadBadge: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  unreadNotificationsCount: 0,
  hasNewHandoff: false,
  hasNewLead: false,
  pendingHandoffsCount: 0,
  newLeadsCount: 0,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try { localStorage.setItem('la_theme', theme); } catch {}
    set({ theme });
  },
  setUnreadNotificationsCount: (count) =>
    set((s) => ({
      unreadNotificationsCount: typeof count === 'function' ? count(s.unreadNotificationsCount) : count,
    })),
  setHasNewHandoff: (has) => set({ hasNewHandoff: has }),
  setHasNewLead: (has) => set({ hasNewLead: has }),
  setPendingHandoffsCount: (count) =>
    set((s) => ({
      pendingHandoffsCount: typeof count === 'function' ? count(s.pendingHandoffsCount) : count,
    })),
  setNewLeadsCount: (count) =>
    set((s) => ({
      newLeadsCount: typeof count === 'function' ? count(s.newLeadsCount) : count,
    })),
  clearHandoffBadge: () => set({ hasNewHandoff: false, pendingHandoffsCount: 0 }),
  clearLeadBadge: () => set({ hasNewLead: false, newLeadsCount: 0 }),
}));
