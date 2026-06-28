import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Firebase Configuration
 *
 * Uses EXPO_PUBLIC_* environment variables so real keys can be injected
 * without changing code. Expo inlines these at build time.
 *
 * To configure, create a .env file in the project root:
 *   EXPO_PUBLIC_FIREBASE_API_KEY=your_key
 *   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project
 *   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
 *   EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/**
 * Check if Firebase config has real values (not just empty strings).
 * When env vars are missing, we skip initialization to prevent crashes
 * during static rendering and development without keys.
 */
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isConfigured) {
  // Initialize Firebase (prevent re-init on hot reload)
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  // Initialize Auth with platform-appropriate persistence
  if (Platform.OS === 'web') {
    // Web uses default browser persistence
    auth = getAuth(app);
  } else {
    // Native uses AsyncStorage for session persistence across app restarts
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} else {
  console.warn(
    '⚠️ Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_* env vars in .env to enable authentication.'
  );
}

export { app, auth, isConfigured };
