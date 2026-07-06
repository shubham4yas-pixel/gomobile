import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle as googleSignIn,
  logout as firebaseLogout,
} from '@/services/authService';
import { saveUserProfile, fetchUserRole } from '@/services/userService';

/**
 * Auth Store (Zustand) — Phase 14 real-auth edition
 *
 * Holds the authenticated user, their role, and loading state. The role is
 * persisted to Firestore `users/{uid}` on every login/register so it survives
 * session restores without re-prompting the user. The root layout fetches it
 * from Firestore inside `onAuthStateChanged` and calls `setRole` before
 * `setInitialized(true)`, so the Map always has a role before it renders.
 */

export type UserRole = 'rider' | 'driver';

// Phone is stored in AsyncStorage keyed by uid (Phase 12) for ride contact exchange.
const phoneKey = (uid: string) => `phone:${uid}`;

async function savePhone(uid: string, phone: string) {
  try { await AsyncStorage.setItem(phoneKey(uid), phone); } catch { /* ignore */ }
}
async function loadPhone(uid: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(phoneKey(uid)); } catch { return null; }
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  phone: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  needsProfile: boolean;  // true when user is authed but profile is incomplete
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  completeProfile: (
    displayName: string,
    phone: string,
    role: UserRole,
    upiId?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setRole: (role: UserRole | null) => void;
  setPhone: (phone: string | null) => void;
  setNeedsProfile: (value: boolean) => void;
  setInitialized: (value: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  phone: null,
  isLoading: false,
  isInitialized: false,
  needsProfile: false,
  error: null,

  // ── Email / password sign-in (role-agnostic — Phase 16) ──────────────────
  // Returning users get their role from Firestore; users without a profile
  // are funneled to complete-profile, same as Google Sign-In.
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const result = await loginWithEmail(email, password);
    if (!result.success) {
      set({ isLoading: false, error: result.error });
      return false;
    }
    const { user } = result;
    const stored = await fetchUserRole(user.uid);
    if (stored) {
      const phone = await loadPhone(user.uid);
      set({ user, role: stored, phone, needsProfile: false, isLoading: false });
      return true;
    }
    set({ user, role: null, needsProfile: true, isLoading: false });
    return true;
  },

  // ── Email / password registration (Phase 16) ─────────────────────────────
  // New accounts always go through the complete-profile funnel, which collects
  // name, phone, and role — so registration only needs credentials.
  register: async (email, password) => {
    set({ isLoading: true, error: null });
    const result = await registerWithEmail(email, password);
    if (!result.success) {
      set({ isLoading: false, error: result.error });
      return false;
    }
    set({ user: result.user, role: null, needsProfile: true, isLoading: false });
    return true;
  },

  // ── Google Sign-In ────────────────────────────────────────────────────────
  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    const result = await googleSignIn();
    if (!result.success) {
      // Suppress cancelled — user just dismissed the sheet, not an error.
      if (!result.cancelled) set({ isLoading: false, error: result.error });
      else set({ isLoading: false });
      return false;
    }
    const { user, isNewUser } = result;
    // Returning users: fetch their existing role from Firestore.
    if (!isNewUser) {
      const stored = await fetchUserRole(user.uid);
      if (stored) {
        const phone = await loadPhone(user.uid);
        set({ user, role: stored, phone, needsProfile: false, isLoading: false });
        return true;
      }
    }
    // New users OR returning users without a Firestore profile:
    // Don't set a role — route them to the complete-profile screen.
    set({ user, role: null, needsProfile: true, isLoading: false });
    return true;
  },

  // ── Complete Profile (onboarding funnel) ──────────────────────────────────
  completeProfile: async (displayName, phone, role, upiId) => {
    const { user } = get();
    if (!user) return false;
    set({ isLoading: true, error: null });
    const trimmed = phone.trim();
    await savePhone(user.uid, trimmed);
    // Persist the driver's payout VPA (Phase 15) when provided; riders skip it.
    const cleanUpi = role === 'driver' && upiId?.trim() ? upiId.trim() : null;
    await saveUserProfile(user.uid, {
      role,
      email: user.email,
      displayName,
      phone: trimmed,
      ...(cleanUpi ? { upiId: cleanUpi } : {}),
    });
    set({ role, phone: trimmed, needsProfile: false, isLoading: false });
    return true;
  },

  // ── Sign-out ──────────────────────────────────────────────────────────────
  logout: async () => {
    set({ isLoading: true });
    await firebaseLogout();
    set({ user: null, role: null, phone: null, isLoading: false, error: null });
  },

  // Setters called by the root layout's onAuthStateChanged listener.
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setPhone: (phone) => set({ phone }),
  setNeedsProfile: (value) => set({ needsProfile: value }),
  setInitialized: (value) => set({ isInitialized: value }),
  clearError: () => set({ error: null }),
}));
