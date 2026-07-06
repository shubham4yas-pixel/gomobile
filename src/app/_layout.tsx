import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isConfigured } from '@/config/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchUserRole } from '@/services/userService';
import { PaymentProvider } from '@/components/PaymentProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastHost } from '@/components/ui/ToastHost';
import { NotificationHost } from '@/components/notifications/NotificationHost';
import {
  addNotificationResponseListener,
  getInitialNotificationData,
} from '@/services/pushService';
import { registerNotifeeBackgroundHandler } from '@/services/richNotificationService';
import { registerFcmBackgroundHandler } from '@/services/fcmService';
import { colors } from '@/theme/theme';
import { APP_VARIANT, otherAppName } from '@/config/appVariant';

// Register the notifee + FCM background handlers once on JS load, outside the
// React tree (required by both libraries). The FCM handler re-renders the live
// ETA notification from data-only messages while the app is backgrounded/quit.
// Both no-op on web / in Expo Go (Phase 15).
registerNotifeeBackgroundHandler();
registerFcmBackgroundHandler();

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
  const { user, role, needsProfile, isInitialized, setUser, setRole, setPhone, setNeedsProfile, setInitialized } = useAuthStore();

  // Premium typography (Phase 17). The loading screen below already gates the
  // first paint, so fonts are ready before any styled screen renders.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    if (!isConfigured || !auth) {
      // Firebase not configured — skip auth listener, mark as ready
      setInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Re-hydrate the phone saved at sign-up for a restored session (Phase 12).
        try {
          const phone = await AsyncStorage.getItem(`phone:${firebaseUser.uid}`);
          setPhone(phone);
        } catch {
          setPhone(null);
        }
        // Restore the role from Firestore so the Map knows rider vs driver (Phase 15).
        const storedRole = await fetchUserRole(firebaseUser.uid);
        setRole(storedRole);
        // If role is null, profile is incomplete — needs onboarding (Phase 15b).
        setNeedsProfile(!storedRole);
      } else {
        setPhone(null);
        setRole(null);
        setNeedsProfile(false);
      }
      setInitialized(true);
    });

    return unsubscribe;
  }, [setUser, setRole, setPhone, setNeedsProfile, setInitialized]);

  const inAuthGroup = segments[0] === '(auth)';
  const inAppGroup = segments[0] === '(app)';
  const inAdminGroup = segments[0] === '(admin)';
  const navigationReady = Boolean(rootNavigationState?.key);
  const isWrongAppAccount = Boolean(APP_VARIANT && role && role !== APP_VARIANT);
  const pendingAuthRedirect =
    isInitialized &&
    navigationReady &&
    !inAdminGroup &&
    !isWrongAppAccount &&
    ((user && role && !needsProfile && !inAppGroup) ||
      (user && needsProfile && !inAuthGroup) ||
      (!user && inAppGroup));

  // Route protection: redirect based on auth state
  useEffect(() => {
    if (!isInitialized || !navigationReady) return;

    // The admin dashboard ("God Mode") is exempt from the auth gate for now —
    // it's reachable by direct URL (/dashboard) regardless of auth state.
    if (inAdminGroup) return;

    if (user && role && !needsProfile && !inAppGroup) {
      // User is authenticated with a known role → land on the Home dashboard
      // (Phase 19 pivot: the map is now the booking/trip surface pushed from
      // Home, not the initial screen). Drivers go online explicitly from Home,
      // so they only broadcast GPS once they choose to.
      setTimeout(() => router.replace('/(app)/(tabs)/home'), 0);
    } else if (user && needsProfile && !inAuthGroup) {
      // User is authenticated but profile is incomplete → onboarding
      setTimeout(() => router.replace('/(auth)/complete-profile'), 0);
    } else if (!user && inAppGroup) {
      // User is not authenticated but trying to access a protected app screen → redirect to landing
      setTimeout(() => router.replace('/'), 0);
    }
  }, [user, role, needsProfile, isInitialized, inAuthGroup, inAppGroup, inAdminGroup, navigationReady, router]);

  // Phase 14: tap-to-open. When a ride-offer push is tapped, route to the map
  // (the ride request screen) — handles both cold starts and warm/background
  // taps. Self-contained; the auth gate above still governs access.
  useEffect(() => {
    if (!rootNavigationState?.key) return; // wait until navigation is ready

    const routeFromData = (data: Record<string, any> | null) => {
      // Phase 20: every notification carries its own deep link (ride screen);
      // the legacy trip:offered check remains for older payloads.
      if (typeof data?.deepLink === 'string' && data.deepLink.length > 0) {
        router.replace(data.deepLink as never);
      } else if (data?.type === 'trip:offered') {
        router.replace('/(app)/map');
      }
    };

    getInitialNotificationData().then(routeFromData); // cold start
    return addNotificationResponseListener(routeFromData); // warm / background taps
  }, [rootNavigationState?.key, router]);

  // Hold the branded splash until auth restoration, font loading, navigation,
  // and any required route replacement have settled. This prevents signed-in
  // riders from seeing the public landing/login surface for a single frame.
  if (!isInitialized || !fontsLoaded || !navigationReady || pendingAuthRedirect) {
    return <StartupSplash />;
  }

  // Phase 17: wrong-app guard. In a dedicated variant build, an account whose
  // Firestore role belongs to the OTHER app gets a hand-off screen instead of
  // a mismatched map UI. Universal (dev) builds never hit this.
  if (isWrongAppAccount) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <View style={styles.loadingContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="navigate" size={34} color={colors.rider} />
          </View>
          <Text style={styles.wrongAppTitle}>
            This is a {role === 'driver' ? 'driver' : 'rider'} account
          </Text>
          <Text style={styles.wrongAppBody}>
            Please use the {otherAppName} app to continue, or sign out to create
            a different account here.
          </Text>
          <Text
            style={styles.wrongAppSignOut}
            onPress={() => useAuthStore.getState().logout()}
          >
            Sign out
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
              {/* Global in-app snackbar host — floats over every screen (Phase 15). */}
              <ToastHost />
              {/* Live ride notifications — banners + the event bridge (Phase 20). */}
              <NotificationHost />
            </View>
          </BottomSheetModalProvider>
        </PaymentProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function StartupSplash() {
  return (
    <View style={styles.loadingContainer}>
      <StatusBar style="dark" />
      <View style={styles.loadingContent}>
        <View style={styles.logoContainer}>
          <Ionicons name="navigate" size={34} color={colors.rider} />
        </View>
        <View style={styles.loadingCopy}>
          <Text style={styles.loadingTitle}>RideShare</Text>
          <Text style={styles.loadingText}>Restoring your secure session</Text>
        </View>
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color={colors.rider} />
          <Text style={styles.loadingMeta}>Preparing your dashboard</Text>
        </View>
      </View>
    </View>
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
    paddingHorizontal: 32,
  },
  loadingContent: {
    alignItems: 'center',
    gap: 18,
    width: '100%',
  },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  loadingCopy: {
    alignItems: 'center',
    gap: 4,
  },
  loadingTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
    color: colors.navy,
  },
  loadingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingMeta: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  wrongAppTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  wrongAppBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  wrongAppSignOut: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rider,
    padding: 12,
  },
});
