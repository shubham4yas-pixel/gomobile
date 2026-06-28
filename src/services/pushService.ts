import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

/**
 * Push Notifications service (Phase 12).
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
      console.log('[Push] Skipping — push tokens require a physical device.');
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
      console.log('[Push] Permission not granted — no token.');
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log('[Push] Expo push token acquired.');
    return tokenResponse.data;
  } catch (e) {
    // Most commonly: running inside Expo Go on SDK 53+ (remote push removed).
    console.log('[Push] Could not get push token (expected in Expo Go):', (e as Error).message);
    return null;
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
