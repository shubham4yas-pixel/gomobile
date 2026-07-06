import { create } from 'zustand';

/**
 * Toast store (Phase 15 — premium in-app feedback).
 *
 * A tiny queue of transient messages rendered by <ToastHost /> (mounted once in
 * the root layout). Replaces blocking `Alert.alert` popups with a clean, on-brand
 * snackbar that auto-dismisses. Import the `toast` helper anywhere:
 *
 *   import { toast } from '@/store/useToastStore';
 *   toast.error('Could not save your profile.');
 *   toast.success('Payment received');
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  /** ms before auto-dismiss. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'info', duration = 3200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, duration }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper — call from anywhere (services, stores, handlers). */
export const toast = {
  show: (m: string, v?: ToastVariant, d?: number) => useToastStore.getState().show(m, v, d),
  success: (m: string, d?: number) => useToastStore.getState().show(m, 'success', d),
  error: (m: string, d?: number) => useToastStore.getState().show(m, 'error', d),
  info: (m: string, d?: number) => useToastStore.getState().show(m, 'info', d),
};
