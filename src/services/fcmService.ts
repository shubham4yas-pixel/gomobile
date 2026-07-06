import { logger } from '@/lib/logger';
import { Platform } from 'react-native';
import { buildStaticRouteUrl } from '@/lib/staticMap';
import { displayDriverEnRoute, cancelDriverEnRoute } from '@/services/richNotificationService';

/**
 * FCM data-message service (Phase 15 — true background ETA updates).
 *
 * The socket-driven path only updates the rich notification while the app is
 * foregrounded (the socket disconnects in the background). To keep the live ETA
 * chronometer + route image refreshing while the rider's app is **backgrounded
 * or quit**, the backend also sends **data-only FCM messages**; this service
 * receives them via @react-native-firebase/messaging and re-renders the notifee
 * notification from a headless JS context.
 *
 * The data message is self-contained (carries pickup/dropoff/driver coords +
 * eta) because the headless handler has NO access to the app's in-memory store.
 *
 * GRACEFUL DEGRADATION: @react-native-firebase/messaging is a native module —
 * lazy-required, no-ops on web / in Expo Go. Needs a dev/EAS build to function.
 */

type MessagingModule = typeof import('@react-native-firebase/messaging');
let _messaging: MessagingModule | null = null;

function getMessaging(): MessagingModule | null {
  if (Platform.OS === 'web') return null;
  if (_messaging) return _messaging;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _messaging = require('@react-native-firebase/messaging');
    return _messaging;
  } catch {
    logger.debug('[FCM] messaging unavailable (Expo Go?) — background updates disabled.');
    return null;
  }
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Turn a `trip:eta-update` data payload into a notifee notification update.
 * Shared by the foreground (`onMessage`) and background handlers so both render
 * identically. Idempotent — reuses the tripId as the notification id.
 */
export async function handleEtaDataMessage(
  data: Record<string, string> | undefined
): Promise<void> {
  if (!data) return;

  // Allow the server to clear the notification too (arrival / completion).
  if (data.type === 'eta-cancel' && data.tripId) {
    await cancelDriverEnRoute(data.tripId);
    return;
  }
  if (data.type !== 'eta-update' || !data.tripId) return;

  const pickupLat = num(data.pickupLat);
  const pickupLng = num(data.pickupLng);
  const dropoffLat = num(data.dropoffLat);
  const dropoffLng = num(data.dropoffLng);
  const driverLat = num(data.driverLat);
  const driverLng = num(data.driverLng);

  const routeImageUrl =
    pickupLat !== undefined &&
    pickupLng !== undefined &&
    dropoffLat !== undefined &&
    dropoffLng !== undefined
      ? buildStaticRouteUrl({
          pickup: { lat: pickupLat, lng: pickupLng },
          dropoff: { lat: dropoffLat, lng: dropoffLng },
          driver:
            driverLat !== undefined && driverLng !== undefined
              ? { lat: driverLat, lng: driverLng }
              : undefined,
        })
      : null;

  await displayDriverEnRoute({
    tripId: data.tripId,
    etaMin: num(data.etaMin) ?? 1,
    routeImageUrl,
  });
}

/**
 * Request notification permission and return the device's FCM registration
 * token (distinct from the Expo push token), or null if unavailable.
 */
export async function getFcmToken(): Promise<string | null> {
  const m = getMessaging();
  if (!m) return null;
  try {
    const messaging = m.default;
    // iOS needs an explicit permission grant + remote-message registration;
    // Android (pre-13) auto-grants, and POST_NOTIFICATIONS is handled alongside
    // the existing expo-notifications permission request.
    if (Platform.OS === 'ios') {
      await messaging().requestPermission();
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    logger.debug('[FCM] registration token acquired.');
    return token ?? null;
  } catch (e) {
    logger.debug('[FCM] could not get token:', (e as Error).message);
    return null;
  }
}

/**
 * Register the background/quit data-message handler. Must run once at JS load,
 * OUTSIDE the React tree — called from the app entry (`_layout.tsx` module scope).
 */
export function registerFcmBackgroundHandler(): void {
  const m = getMessaging();
  if (!m) return;
  try {
    m.default().setBackgroundMessageHandler(async (remoteMessage) => {
      await handleEtaDataMessage(remoteMessage?.data as Record<string, string> | undefined);
    });
  } catch (e) {
    logger.debug('[FCM] background handler registration skipped:', (e as Error).message);
  }
}

/**
 * Subscribe to foreground data messages (parallels the socket path; idempotent
 * because both reuse the tripId notification id). Returns an unsubscribe fn.
 */
export function addFcmForegroundListener(): () => void {
  const m = getMessaging();
  if (!m) return () => {};
  try {
    return m.default().onMessage(async (remoteMessage) => {
      await handleEtaDataMessage(remoteMessage?.data as Record<string, string> | undefined);
    });
  } catch {
    return () => {};
  }
}
