import { logger } from '@/lib/logger';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

/**
 * Push Notifications service (Phase 12, hardened Phase 15).
 *
 * Requests OS permission and fetches the device's Expo push token, which the
 * caller registers with the dispatch server (`push:register-token`). The server
 * then delivers remote pushes through the Expo Push API on trip lifecycle
 * events (driver accepted / arrived).
 *
 * GRACEFUL DEGRADATION: remote push tokens are NOT available in Expo Go on
 * SDK 53+, and not on simulators. Every failure path returns null and logs a
 * single line — the app keeps working; you simply won't receive remote pushes
 * until running a development build on a physical device.
 */

// Show alerts even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Resolve the EAS project id required by getExpoPushTokenAsync (SDK 49+). */
function getProjectId(): string | undefined {
  const c = Constants as any;
  return c.expoConfig?.extra?.eas?.projectId ?? c.easConfig?.projectId ?? undefined;
}

/**
 * Request notification permission and return the Expo push token, or null if
 * unavailable (denied, simulator, Expo Go on SDK 53+, or any error).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      logger.debug('[Push] Skipping — push tokens require a physical device.');
      return null;
    }

    // Android needs a notification channel for heads-up alerts.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      logger.debug('[Push] Permission not granted — no token.');
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    logger.debug('[Push] Expo push token acquired.');
    return tokenResponse.data;
  } catch (e) {
    // Most commonly: running inside Expo Go on SDK 53+ (remote push removed).
    logger.debug('[Push] Could not get push token (expected in Expo Go):', (e as Error).message);
    return null;
  }
}

/**
 * Persist the push token directly to Firestore `push_tokens/{userId}` via the
 * client SDK. This is a belt-and-suspenders backup — the primary path is the
 * socket `push:register-token` event, but if the socket drops during
 * registration the token still reaches Firestore through this write. (Phase 15)
 */
export async function savePushTokenToFirestore(
  userId: string,
  token: string
): Promise<void> {
  if (!firestore || !userId || !token) return;
  try {
    await setDoc(
      doc(firestore, 'push_tokens', userId),
      { userId, token, updatedAt: serverTimestamp() },
      { merge: true }
    );
    logger.debug('[Push] Token persisted to Firestore for', userId);
  } catch (e) {
    logger.warn('[Push] Firestore token write failed:', (e as Error).message);
  }
}

/**
 * Subscribe to notifications received while the app is foregrounded.
 * Returns an unsubscribe function.
 */
export function addForegroundListener(
  handler: (notification: Notifications.Notification) => void
): () => void {
  const sub = Notifications.addNotificationReceivedListener(handler);
  return () => sub.remove();
}

/**
 * Subscribe to notification TAPS (Phase 14, tap-to-open). Fires when the user
 * taps a notification while the app is foregrounded or backgrounded. The handler
 * receives the notification's `data` payload (e.g. `{ type, tripId }`).
 * Returns an unsubscribe function.
 */
export function addNotificationResponseListener(
  handler: (data: Record<string, any>) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data ?? {});
  });
  return () => sub.remove();
}

/**
 * Read the notification that cold-started the app (Phase 14). Returns its `data`
 * payload when the app was launched by tapping a notification, else null. Call
 * once after navigation is ready to route the initial screen.
 */
export async function getInitialNotificationData(): Promise<Record<string, any> | null> {
  // Not supported on web — there is no notification-launched cold start there.
  if (Platform.OS === 'web') return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response?.notification.request.content.data ?? null;
  } catch (e) {
    logger.debug('[Push] getLastNotificationResponse unavailable:', (e as Error).message);
    return null;
  }
}
