import { logger } from '@/lib/logger';
import { Platform } from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  getAdditionalUserInfo,
  UserCredential,
} from 'firebase/auth';
import { auth, isConfigured } from '@/config/firebase';

/**
 * Auth Service (Phase 14 — real Firebase Auth)
 *
 * Thin wrapper over Firebase Auth. All functions return structured results and
 * never throw — errors are caught and returned as friendly messages.
 *
 * Google Sign-In:
 *   • Native Android/iOS — uses `@react-native-google-signin/google-signin`
 *     (native module, requires EAS build; gracefully unavailable in Expo Go).
 *   • Web — uses Firebase `signInWithPopup` (opens a browser popup).
 *
 * The webClientId (client_type 3 from google-services.json) is the OAuth client
 * used by the native Google Sign-In SDK to obtain the Firebase-compatible ID token.
 */

// Web client ID from google-services.json (client_type: 3). Not a secret —
// it's bundled into the native app by the google-services.json Gradle plugin.
// Read from env so EAS builds pick it up; fallback to the known value for local dev.
const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_WEB_CLIENT_ID ??
  '689027507410-06d1iq3fularteqcpj8k7k686n5g4p4i.apps.googleusercontent.com';

// ---------------------------------------------------------------------------
// Native Google Sign-In initialisation (skipped on web to avoid bundling the
// native module, which throws on web because it has no JS implementation).
// ---------------------------------------------------------------------------
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let _googleModule: GoogleSigninModule | null = null;

function getGoogleSignin(): GoogleSigninModule | null {
  if (Platform.OS === 'web') return null;
  if (_googleModule) return _googleModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    m.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    _googleModule = m;
    return m;
  } catch {
    logger.warn('[Auth] Google Sign-In native module unavailable (Expo Go?)');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export type AuthResult =
  | { success: true; user: UserCredential['user']; isNewUser: boolean }
  | { success: false; error: string; cancelled?: boolean };

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------
function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts — please try again later.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/cancelled-popup-request': 'Only one sign-in popup allowed at a time.',
  };
  return map[code] ?? 'An unexpected error occurred. Please try again.';
}

function authGuard(): NonNullable<typeof auth> {
  if (!isConfigured || !auth) throw new Error('NOT_CONFIGURED');
  return auth;
}

// ---------------------------------------------------------------------------
// Email / password
// ---------------------------------------------------------------------------
export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const a = authGuard();
    const cred = await signInWithEmailAndPassword(a, email, password);
    return { success: true, user: cred.user, isNewUser: false };
  } catch (e: any) {
    if (e.message === 'NOT_CONFIGURED')
      return { success: false, error: 'Firebase is not configured — add EXPO_PUBLIC_FIREBASE_* to .env' };
    return { success: false, error: friendlyError(e.code) };
  }
}

export async function registerWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const a = authGuard();
    const cred = await createUserWithEmailAndPassword(a, email, password);
    return { success: true, user: cred.user, isNewUser: true };
  } catch (e: any) {
    if (e.message === 'NOT_CONFIGURED')
      return { success: false, error: 'Firebase is not configured — add EXPO_PUBLIC_FIREBASE_* to .env' };
    return { success: false, error: friendlyError(e.code) };
  }
}

export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const a = authGuard();
    await signOut(a);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: friendlyError(e.code) };
  }
}

// ---------------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------------
export async function loginWithGoogle(): Promise<AuthResult> {
  // ── Web path: Firebase popup ─────────────────────────────────────────────
  if (Platform.OS === 'web') {
    try {
      const a = authGuard();
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(a, provider);
      const info = getAdditionalUserInfo(cred);
      return { success: true, user: cred.user, isNewUser: info?.isNewUser ?? false };
    } catch (e: any) {
      if (e.message === 'NOT_CONFIGURED')
        return { success: false, error: 'Firebase is not configured.' };
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')
        return { success: false, error: 'Sign-in cancelled.', cancelled: true };
      return { success: false, error: friendlyError(e.code) };
    }
  }

  // ── Native path: @react-native-google-signin/google-signin ──────────────
  const g = getGoogleSignin();
  if (!g) {
    return {
      success: false,
      error:
        'Google Sign-In is not available in Expo Go. Use a development build or email/password sign-in.',
    };
  }

  const { GoogleSignin, statusCodes } = g;

  try {
    const a = authGuard();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    // v14 wraps the result; fall back to the flat shape for older builds.
    const idToken: string | null | undefined =
      (signInResult as any).data?.idToken ?? (signInResult as any).idToken;
    if (!idToken) throw new Error('Google Sign-In returned no ID token.');
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(a, credential);
    const info = getAdditionalUserInfo(cred);
    return { success: true, user: cred.user, isNewUser: info?.isNewUser ?? false };
  } catch (e: any) {
    if (e.message === 'NOT_CONFIGURED')
      return { success: false, error: 'Firebase is not configured.' };
    if (e.code === statusCodes.SIGN_IN_CANCELLED)
      return { success: false, error: 'Sign-in cancelled.', cancelled: true };
    if (e.code === statusCodes.IN_PROGRESS)
      return { success: false, error: 'Sign-in already in progress — please wait.' };
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      return {
        success: false,
        error: 'Google Play Services not available. Please update Play Services and try again.',
      };
    return { success: false, error: e.message ?? 'Google Sign-In failed. Please try again.' };
  }
}
