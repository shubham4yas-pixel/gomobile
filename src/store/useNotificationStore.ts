import { create } from 'zustand';
import type { AppNotification } from '@/types/notifications';

/**
 * In-app notification store (Phase 20).
 *
 * Backs the foreground banner UI (`<NotificationHost />`). The notification
 * service UPSERTS by stable id — a re-delivery with the same id replaces the
 * banner content in place (this is how the live driver-approach banner ticks
 * its ETA/progress without re-animating in). Mirrors the toast store pattern
 * but with identity-keyed updates instead of an append-only queue.
 */

interface NotificationState {
  banners: AppNotification[];
  /** Insert a new banner or update an existing one (matched by id) in place. */
  upsert: (n: AppNotification) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const MAX_VISIBLE = 3;

export const useNotificationStore = create<NotificationState>((set) => ({
  banners: [],

  upsert: (n) =>
    set((s) => {
      const idx = s.banners.findIndex((b) => b.id === n.id);
      if (idx >= 0) {
        const next = [...s.banners];
        next[idx] = n;
        return { banners: next };
      }
      // Newest on top; cap the stack so banners never flood the screen.
      return { banners: [n, ...s.banners].slice(0, MAX_VISIBLE) };
    }),

  dismiss: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),

  dismissAll: () => set({ banners: [] }),
}));
