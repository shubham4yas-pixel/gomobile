import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import {
  loginWithEmail,
  registerWithEmail,
  logout as firebaseLogout,
} from '@/services/authService';

/**
 * Phone numbers are collected at sign-up (Phase 12) and persisted per-uid in
 * AsyncStorage, so they survive across sessions and are available on a later
 * sign-in (where the form doesn't re-ask for them).
 */
const phoneKey = (uid: string) => `phone:${uid}`;

async function savePhoneForUid(uid: string, phone: string): Promise<void> {
  try {
    await AsyncStorage.setItem(phoneKey(uid), phone);
  } catch (e) {
    console.warn('[Auth] Failed to persist phone:', e);
  }
}

async function loadPhoneForUid(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(phoneKey(uid));
  } catch {
    return null;
  }
}

/**
 * Auth Store (Zustand)
 *
 * Holds the authenticated user, their role (rider/driver), and loading states.
 * The root layout subscribes to onAuthStateChanged and calls setUser/setInitialized.
 * Login screens call login/register actions which delegate to authService.
 */

export type UserRole = 'rider' | 'driver';

interface AuthState {
  // State
  user: User | null;
  role: UserRole | null;
  /** Account phone number (Phase 12) — collected at sign-up, used for ride contact. */
  phone: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    role: UserRole,
    phone: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  devBypassLogin: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  setRole: (role: UserRole | null) => void;
  setPhone: (phone: string | null) => void;
  setInitialized: (value: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  user: null,
  role: null,
  phone: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Login action
  login: async (email, password, role) => {
    set({ isLoading: true, error: null });

    const result = await loginWithEmail(email, password);

    if (result.success) {
      // Hydrate the phone saved at sign-up (Phase 12).
      const phone = await loadPhoneForUid(result.user.uid);
      set({ user: result.user, role, phone, isLoading: false });
      return true;
    } else {
      set({ isLoading: false, error: result.error });
      return false;
    }
  },

  // Register action
  register: async (email, password, role, phone) => {
    set({ isLoading: true, error: null });

    const result = await registerWithEmail(email, password);

    if (result.success) {
      const trimmed = phone.trim();
      // Persist the phone per-uid so future sign-ins can re-hydrate it.
      await savePhoneForUid(result.user.uid, trimmed);
      set({ user: result.user, role, phone: trimmed, isLoading: false });
      return true;
    } else {
      set({ isLoading: false, error: result.error });
      return false;
    }
  },

  // Logout action
  logout: async () => {
    set({ isLoading: true });
    await firebaseLogout();
    set({ user: null, role: null, phone: null, isLoading: false });
  },

  /**
   * Dev Bypass Login
   *
   * Instantly sets a mock user session without touching Firebase.
   * Use during development to skip the auth flow entirely.
   * The mock user has just enough shape to satisfy type checks.
   */
  devBypassLogin: (role) => {
    const mockUser = {
      uid: `dev-${role}-${Date.now()}`,
      email: `dev-${role}@rideshare.local`,
      displayName: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      providerId: 'dev-bypass',
      refreshToken: '',
      tenantId: null,
      phoneNumber: null,
      photoURL: null,
      delete: async () => {},
      getIdToken: async () => 'dev-token',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
    } as unknown as User;

    set({
      user: mockUser,
      role,
      // Mock contact number so the Phase 12 contact-exchange flow demos end-to-end.
      phone: role === 'driver' ? '+15555550101' : '+15555550199',
      isInitialized: true,
      isLoading: false,
      error: null,
    });
  },

  // Setters (called by root layout's onAuthStateChanged listener)
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setPhone: (phone) => set({ phone }),
  setInitialized: (value) => set({ isInitialized: value }),
  clearError: () => set({ error: null }),
}));
