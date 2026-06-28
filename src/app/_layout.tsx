import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isConfigured } from '@/config/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { PaymentProvider } from '@/components/PaymentProvider';
import { colors } from '@/theme/theme';

/**
 * Root Layout
 *
 * Auth gatekeeper for the entire app. Subscribes to Firebase's
 * onAuthStateChanged and uses Expo Router segments to enforce:
 *   - Authenticated users → /(app)/map
 *   - Unauthenticated users → / (landing gate)
 *
 * Shows a loading spinner until Firebase resolves the cached session.
 * When Firebase is not configured (no env vars), skips auth listener
 * and marks as initialized immediately so the app still loads.
 */
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { user, isInitialized, setUser, setPhone, setInitialized } = useAuthStore();

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    if (!isConfigured || !auth) {
      // Firebase not configured — skip auth listener, mark as ready
      setInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      // Re-hydrate the phone saved at sign-up for a restored session (Phase 12).
      if (firebaseUser) {
        try {
          const phone = await AsyncStorage.getItem(`phone:${firebaseUser.uid}`);
          setPhone(phone);
        } catch {
          setPhone(null);
        }
      } else {
        setPhone(null);
      }
      setInitialized(true);
    });

    return unsubscribe;
  }, [setUser, setPhone, setInitialized]);

  // Route protection: redirect based on auth state
  useEffect(() => {
    if (!isInitialized || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const inAdminGroup = segments[0] === '(admin)';

    // The admin dashboard ("God Mode") is exempt from the auth gate for now —
    // it's reachable by direct URL (/dashboard) regardless of auth state.
    if (inAdminGroup) return;

    if (user && !inAppGroup) {
      // User is authenticated but not in the app group → redirect to map
      setTimeout(() => router.replace('/(app)/map'), 0);
    } else if (!user && inAppGroup) {
      // User is not authenticated but in the app group → redirect to landing
      setTimeout(() => router.replace('/'), 0);
    }
  }, [user, isInitialized, segments, router, rootNavigationState]);

  // Show loading screen until Firebase resolves session
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <View style={styles.loadingContent}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>◈</Text>
          </View>
          <ActivityIndicator size="large" color={colors.rider} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <PaymentProvider>
        <BottomSheetModalProvider>
          <View style={styles.container}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            />
          </View>
        </BottomSheetModalProvider>
      </PaymentProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 36,
    color: colors.rider,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
