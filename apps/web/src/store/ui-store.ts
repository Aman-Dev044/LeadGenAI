import { create } from 'zustand';

/** Badge watermarks survive a reload; the rest of this store is session state. */
const SEEN_COUNTS_KEY = 'la_seen_counts';

const readSeenCounts = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SEEN_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  unreadNotificationsCount: number;
  hasNewHandoff: boolean;
  hasNewLead: boolean;
  pendingHandoffsCount: number;
  newLeadsCount: number;
  /**
   * How many items the user had already seen, per badge key. Badges driven by a
   * live server count (AI Automation, Leads Scrap AI) show only the amount above
   * this watermark - otherwise visiting the page would clear the badge for 60
   * seconds and the next refetch would bring it straight back.
   */
  seenCounts: Record<string, number>;
  markSeen: (key: string, count: number) => void;
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
  seenCounts: readSeenCounts(),
  markSeen: (key, count) =>
    set((state) => {
      // Bail out when nothing changed: this runs from an effect that also
      // depends on seenCounts, and a fresh object every time would loop.
      if (state.seenCounts[key] === count) return state;
      const seenCounts = { ...state.seenCounts, [key]: count };
      try {
        localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(seenCounts));
      } catch {}
      return { seenCounts };
    }),
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
