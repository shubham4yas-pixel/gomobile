import { logger } from '@/lib/logger';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

/**
 * User profile service (Phase 14)
 *
 * Persists and retrieves the user's role (rider/driver) in Firestore
 * `users/{uid}`. This makes the role durable across app restarts and
 * sign-in methods — the root layout fetches it whenever Firebase restores
 * a cached session (onAuthStateChanged), so the correct Map UI loads even
 * after a cold restart without going through the login screen again.
 */

const USERS = 'users';

export type UserRole = 'rider' | 'driver';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  /** Driver's UPI VPA for direct payment collection (Phase 15). Optional —
   *  CollectPaymentCard falls back to EXPO_PUBLIC_DEFAULT_UPI_ID when unset. */
  upiId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Write (or merge-update) a user profile. Fire-and-forget safe — failures
 * are logged and never thrown, so auth success is never blocked by a slow write.
 */
export async function saveUserProfile(
  uid: string,
  fields: Partial<Omit<UserProfile, 'uid' | 'createdAt'>> & { role: UserRole }
): Promise<void> {
  if (!firestore || !uid) return;
  try {
    const now = new Date().toISOString();
    await setDoc(
      doc(firestore, USERS, uid),
      { uid, ...fields, updatedAt: now },
      { merge: true }   // preserves createdAt and any future fields
    );
  } catch (e) {
    logger.warn('[UserService] Failed to save profile:', (e as Error).message);
  }
}

/**
 * Fetch the full user profile, or null if it doesn't exist / on error.
 */
export async function fetchUserProfile(uid: string): Promise<Partial<UserProfile> | null> {
  if (!firestore || !uid) return null;
  try {
    const snap = await getDoc(doc(firestore, USERS, uid));
    return snap.exists() ? (snap.data() as Partial<UserProfile>) : null;
  } catch (e) {
    logger.warn('[UserService] Failed to fetch profile:', (e as Error).message);
    return null;
  }
}

/**
 * Fetch the user's stored role. Returns null when the document doesn't
 * exist yet (brand-new sign-up before profile is written) or on any error.
 */
export async function fetchUserRole(uid: string): Promise<UserRole | null> {
  const profile = await fetchUserProfile(uid);
  const role = profile?.role;
  return role === 'rider' || role === 'driver' ? role : null;
}

/**
 * Fetch a driver's UPI VPA for direct payment collection (Phase 15).
 * Returns null when unset — callers fall back to EXPO_PUBLIC_DEFAULT_UPI_ID.
 */
export async function fetchDriverUpiId(uid: string): Promise<string | null> {
  const profile = await fetchUserProfile(uid);
  const upi = profile?.upiId;
  return typeof upi === 'string' && upi.trim() ? upi.trim() : null;
}
