import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { auth, isConfigured } from '@/config/firebase';

/**
 * Auth Service
 *
 * Thin wrapper over Firebase Auth. All functions return structured results
 * and never throw — errors are caught and returned as friendly messages.
 * Gracefully handles the case where Firebase is not configured.
 */

type AuthResult = {
  success: true;
  user: UserCredential['user'];
} | {
  success: false;
  error: string;
};

type LogoutResult = {
  success: boolean;
  error?: string;
};

/**
 * Map Firebase error codes to user-friendly messages
 */
function getErrorMessage(code: string): string {
  const errorMap: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password should be at least 6 characters',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/user-disabled': 'This account has been disabled',
  };

  return errorMap[code] ?? 'An unexpected error occurred. Please try again';
}

/**
 * Guard: check Firebase is configured before calling auth methods
 */
function getAuthInstance(): NonNullable<typeof auth> {
  if (!isConfigured || !auth) {
    throw new Error('NOT_CONFIGURED');
  }
  return auth;
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const authInstance = getAuthInstance();
    const credential = await signInWithEmailAndPassword(authInstance, email, password);
    return { success: true, user: credential.user };
  } catch (error: any) {
    if (error.message === 'NOT_CONFIGURED') {
      return { success: false, error: 'Firebase is not configured. Add your API keys to .env' };
    }
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Create a new account with email and password
 */
export async function registerWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const authInstance = getAuthInstance();
    const credential = await createUserWithEmailAndPassword(authInstance, email, password);
    return { success: true, user: credential.user };
  } catch (error: any) {
    if (error.message === 'NOT_CONFIGURED') {
      return { success: false, error: 'Firebase is not configured. Add your API keys to .env' };
    }
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Sign out the current user
 */
export async function logout(): Promise<LogoutResult> {
  try {
    const authInstance = getAuthInstance();
    await signOut(authInstance);
    return { success: true };
  } catch (error: any) {
    if (error.message === 'NOT_CONFIGURED') {
      return { success: false, error: 'Firebase is not configured' };
    }
    return { success: false, error: getErrorMessage(error.code) };
  }
}
