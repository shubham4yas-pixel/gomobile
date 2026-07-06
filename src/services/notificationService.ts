import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { logger } from '@/lib/logger';
import { haptics } from '@/lib/haptics';
import { getDriverProfile } from '@/lib/driverProfile';
import { buildStaticRouteUrl } from '@/lib/staticMap';
import { toast } from '@/store/useToastStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useRideStore } from '@/store/useRideStore';
import { colors } from '@/theme/theme';
import {
  displayDriverEnRoute,
  cancelDriverEnRoute,
} from '@/services/richNotificationService';
import type {
  AppNotification,
  DeliveryContext,
  NotificationAction,
  NotificationActionId,
  NotificationProvider,
  RideNotificationEvent,
} from '@/types/notifications';

/**
 * Notification service (Phase 20 — Live Push Notification System).
 *
 * The single funnel between ride events and every notification surface:
 *
 *   ride logic ──emit(event)──▶ NotificationCenter ──▶ NotificationProvider
 *                                    │                       │
 *                              catalog + state          foreground → in-app
 *                              machine (stable          banner store
 *                              ids, dedupe,             background → native
 *                              update-in-place)         tray (expo-notifications
 *                                                       + notifee live channel)
 *
 * PRODUCTION SWAP: replace `LocalNotificationProvider` with an FCM / Expo Push
 * implementation via `notificationService.setProvider()` — the event contract,
 * catalog, and UI are transport-agnostic and stay untouched.
 */

// ─── Channel ids (the notification state machine) ───────────────────────────
// One LIVE channel per trip carries the whole journey (accepted → en-route →
// arriving → arrived → started → approaching → completed) and is UPDATED IN
// PLACE; side moments (OTP, payment, receipt, rating) get their own channels.

const liveId = (tripId: string) => `${tripId}:live`;
const channelId = (tripId: string, channel: string) => `${tripId}:${channel}`;

/** Native Android channel / iOS category used for actionable ride alerts. */
const NATIVE_CATEGORY = 'ride-actions';

// ─── Quick actions ───────────────────────────────────────────────────────────

const ACTIONS: Record<NotificationActionId, NotificationAction> = {
  call: { id: 'call', label: 'Call Driver', icon: 'call-outline' },
  message: { id: 'message', label: 'Message', icon: 'chatbubble-outline' },
  view: { id: 'view', label: 'View Ride', icon: 'navigate-outline' },
  dismiss: { id: 'dismiss', label: 'Dismiss', icon: 'close' },
};

const pick = (...ids: NotificationActionId[]) => ids.map((id) => ACTIONS[id]);

// ─── Local (mock) provider ───────────────────────────────────────────────────

/**
 * Test-mode transport: identical contract to a real push provider, delivered
 * locally. Foreground → in-app banner store. Background → OS tray via
 * expo-notifications (stable identifier = silent in-place update), with the
 * live approach channel delegated to notifee's chronometer notification.
 */
class LocalNotificationProvider implements NotificationProvider {
  readonly name = 'local-mock';
  private initialized = false;
  private responseUnsub: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized || Platform.OS === 'web') {
      this.initialized = true;
      return;
    }
    try {
      // Quick actions on the native (lock-screen) notification.
      await Notifications.setNotificationCategoryAsync(NATIVE_CATEGORY, [
        { identifier: 'call', buttonTitle: 'Call Driver' },
        { identifier: 'view', buttonTitle: 'View Ride' },
      ]);
      // Route native action taps back through the shared dispatcher.
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const action = response.actionIdentifier;
        if (action === 'call' || action === 'view') {
          performNotificationAction(action, {
            id: String(response.notification.request.identifier ?? ''),
            deepLink: String(response.notification.request.content.data?.deepLink ?? ''),
          });
        }
      });
      this.responseUnsub = () => sub.remove();
      this.initialized = true;
    } catch (e) {
      logger.debug('[Notif] category setup skipped:', (e as Error).message);
      this.initialized = true;
    }
  }

  async deliver(n: AppNotification, context: DeliveryContext): Promise<void> {
    // The live journey channel outlived its chronometer (driver arrived /
    // trip moved on) — retire the notifee countdown regardless of app state.
    if (Platform.OS !== 'web' && n.id === `${n.tripId}:live`) {
      if (!n.live || n.live.phase === 'arrived') await cancelDriverEnRoute(n.tripId);
    }

    if (context === 'foreground' || Platform.OS === 'web') {
      const isNew = !useNotificationStore.getState().banners.some((b) => b.id === n.id);
      useNotificationStore.getState().upsert(n);
      // Only pulse on a NEW banner — silent in-place updates for live ticks.
      if (isNew) haptics.light();
      return;
    }

    // Backgrounded: the live approach channel gets the rich notifee treatment
    // (chronometer countdown + route snapshot); everything else goes through
    // expo-notifications with a stable identifier so updates replace in place.
    if (n.live && n.live.phase !== 'arrived') {
      const { tripPickup, tripDropoff } = useRideStore.getState();
      const routeImageUrl =
        tripPickup && tripDropoff
          ? buildStaticRouteUrl({
              pickup: { lat: tripPickup.lat, lng: tripPickup.lng },
              dropoff: { lat: tripDropoff.lat, lng: tripDropoff.lng },
            })
          : null;
      await displayDriverEnRoute({ tripId: n.tripId, etaMin: n.live.etaMin, routeImageUrl });
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: {
          title: n.title,
          body: n.body,
          categoryIdentifier: NATIVE_CATEGORY,
          data: { type: n.type, tripId: n.tripId, deepLink: n.deepLink },
          sound: n.sticky ? undefined : 'default',
        },
        trigger: null, // present immediately
      });
    } catch (e) {
      logger.debug('[Notif] native delivery failed:', (e as Error).message);
    }
  }

  async dismiss(id: string, tripId?: string): Promise<void> {
    useNotificationStore.getState().dismiss(id);
    if (Platform.OS === 'web') return;
    try {
      await Notifications.dismissNotificationAsync(id);
    } catch {
      /* not in tray — fine */
    }
    if (tripId && id === liveId(tripId)) await cancelDriverEnRoute(tripId);
  }

  async dismissAll(): Promise<void> {
    useNotificationStore.getState().dismissAll();
    if (Platform.OS === 'web') return;
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch {
      /* ignore */
    }
  }

  teardown(): void {
    this.responseUnsub?.();
    this.responseUnsub = null;
  }
}

// ─── Notification center ─────────────────────────────────────────────────────

/** Per-trip live state: baseline ETA for progress + one-shot dedupe. */
interface TripNotifState {
  firstEtaMin: number | null;
  lastEtaMin: number | null;
  delivered: Set<string>;
}

class NotificationCenter {
  private provider: NotificationProvider = new LocalNotificationProvider();
  private trips = new Map<string, TripNotifState>();

  /** Swap the transport (Expo Push / FCM later). UI and catalog untouched. */
  setProvider(provider: NotificationProvider): void {
    this.provider = provider;
    void provider.initialize();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
  }

  /** THE entry point: ride logic emits domain events; we do the rest. */
  emit(event: RideNotificationEvent): void {
    const n = this.build(event);
    if (!n) return;
    const context: DeliveryContext =
      AppState.currentState === 'active' ? 'foreground' : 'background';
    void this.provider.deliver(n, context);
  }

  dismiss(id: string, tripId?: string): void {
    void this.provider.dismiss(id, tripId);
  }

  /** Clear every notification for a trip (cancelled / reset). */
  clearTrip(tripId: string): void {
    this.trips.delete(tripId);
    for (const channel of ['live', 'offer', 'otp', 'payment', 'receipt', 'rating', 'cancelled']) {
      void this.provider.dismiss(channelId(tripId, channel), tripId);
    }
  }

  clearAll(): void {
    this.trips.clear();
    void this.provider.dismissAll();
  }

  // ── Catalog: domain event → renderable notification ──────────────────────

  private state(tripId: string): TripNotifState {
    let s = this.trips.get(tripId);
    if (!s) {
      s = { firstEtaMin: null, lastEtaMin: null, delivered: new Set() };
      this.trips.set(tripId, s);
    }
    return s;
  }

  /** One-shot guard — everything except the repeating live ETA tick. */
  private once(tripId: string, key: string): boolean {
    const s = this.state(tripId);
    if (s.delivered.has(key)) return false;
    s.delivered.add(key);
    return true;
  }

  private driverIdentity(driverId?: string | null) {
    const id = driverId ?? useRideStore.getState().assignedDriver?.id;
    const p = getDriverProfile(id);
    return { name: p.name, vehicle: `${p.color} ${p.car}`, plate: p.plate };
  }

  private build(e: RideNotificationEvent): AppNotification | null {
    const base = {
      tripId: e.tripId,
      type: e.type,
      role: e.role,
      timestamp: Date.now(),
      deepLink: '/(app)/map',
      sticky: false,
      duration: 5000,
      accent: e.role === 'driver' ? colors.driver : colors.rider,
    };

    switch (e.type) {
      // ── Rider: the live journey channel (updated in place) ───────────────
      case 'RIDE_ACCEPTED': {
        if (!this.once(e.tripId, e.type)) return null;
        const d = this.driverIdentity(e.driver?.id);
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Ride request accepted',
          body: `${d.name} is heading to your pickup`,
          icon: 'checkmark-circle-outline',
          accent: colors.success,
          actions: pick('call', 'message', 'view'),
          sticky: true,
          live: {
            driverName: d.name,
            vehicle: d.vehicle,
            plate: d.plate,
            etaMin: e.etaMin ?? 0,
            distanceKm: e.distanceKm ?? 0,
            progress: 0.04,
            phase: 'en-route',
          },
        };
      }

      case 'DRIVER_ETA': {
        const s = this.state(e.tripId);
        const eta = Math.max(1, Math.round(e.etaMin ?? 1));
        if (s.firstEtaMin === null) s.firstEtaMin = eta;
        s.firstEtaMin = Math.max(s.firstEtaMin, eta); // baseline only grows
        s.lastEtaMin = eta;
        const arriving = eta <= 2;
        const progress = Math.min(
          0.97,
          Math.max(0.04, 1 - eta / Math.max(s.firstEtaMin, 1))
        );
        const d = this.driverIdentity(e.driver?.id);
        return {
          ...base,
          id: liveId(e.tripId),
          title: arriving ? 'Driver arriving' : 'Driver is on the way',
          body: arriving
            ? `${d.name} is almost at your pickup`
            : `${d.name} is heading to your pickup`,
          icon: arriving ? 'location-outline' : 'car-outline',
          actions: pick('call', 'message', 'view'),
          sticky: true,
          live: {
            driverName: d.name,
            vehicle: d.vehicle,
            plate: d.plate,
            etaMin: eta,
            distanceKm: e.distanceKm ?? 0,
            progress,
            phase: arriving ? 'arriving' : 'en-route',
          },
        };
      }

      case 'DRIVER_ARRIVED': {
        if (!this.once(e.tripId, e.type)) return null;
        const d = this.driverIdentity(e.driver?.id);
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Your driver has arrived',
          body: `Meet ${d.name} at the pickup point — ${d.vehicle} · ${d.plate}`,
          icon: 'flag-outline',
          accent: colors.success,
          actions: pick('call', 'view'),
          sticky: true,
          live: {
            driverName: d.name,
            vehicle: d.vehicle,
            plate: d.plate,
            etaMin: 0,
            distanceKm: 0,
            progress: 1,
            phase: 'arrived',
          },
        };
      }

      case 'TRIP_STARTED': {
        if (!this.once(e.tripId, `${e.type}:${e.role}`)) return null;
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Trip started',
          body:
            e.role === 'rider'
              ? 'You are on your way. Sit back and enjoy the ride.'
              : 'Passenger verified. Drive safely to the destination.',
          icon: 'navigate-outline',
          actions: pick('view'),
          duration: 6000,
        };
      }

      case 'APPROACHING_DESTINATION': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Approaching destination',
          body: 'You are almost there — get ready to hop off.',
          icon: 'flag-outline',
          actions: pick('view'),
          duration: 6000,
        };
      }

      case 'TRIP_COMPLETED': {
        if (!this.once(e.tripId, `${e.type}:${e.role}`)) return null;
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Trip completed',
          body:
            e.role === 'rider'
              ? 'Thanks for riding with us. Your receipt is on its way.'
              : 'Trip complete. Your earnings have been recorded.',
          icon: 'checkmark-done-outline',
          accent: colors.success,
          actions: pick('view'),
          duration: 6000,
        };
      }

      // ── Side channels ─────────────────────────────────────────────────────
      case 'OTP_READY': {
        if (!this.once(e.tripId, `${e.type}:${e.role}`)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'otp'),
          title: 'OTP ready',
          body:
            e.role === 'rider'
              ? e.otp
                ? `Share PIN ${e.otp} with your driver to start the trip.`
                : 'Open the app to view your trip PIN.'
              : 'Ask the passenger for their PIN to verify and start the trip.',
          icon: 'keypad-outline',
          actions: pick('view', 'dismiss'),
          duration: 8000,
        };
      }

      case 'PAYMENT_SUCCESS': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'payment'),
          title: 'Payment successful',
          body: `Your payment of ${formatAmount(e.amount, e.currency)} was processed.`,
          icon: 'card-outline',
          accent: colors.success,
          actions: pick('view', 'dismiss'),
        };
      }

      case 'RECEIPT_READY': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'receipt'),
          title: 'Receipt generated',
          body: 'Your trip receipt is ready to view.',
          icon: 'document-text-outline',
          actions: pick('view', 'dismiss'),
        };
      }

      // ── Driver ────────────────────────────────────────────────────────────
      case 'RIDE_REQUEST': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'offer'),
          title: 'New ride request',
          body:
            e.distanceKm != null
              ? `Pickup ${e.distanceKm.toFixed(1)} km away. Review and accept in the app.`
              : 'A rider nearby needs a ride. Review and accept in the app.',
          icon: 'radio-outline',
          actions: pick('view', 'dismiss'),
          duration: 12000,
        };
      }

      case 'RIDER_CANCELLED': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'cancelled'),
          title: 'Rider cancelled',
          body: 'The rider cancelled this trip. You are back online for new requests.',
          icon: 'close-circle-outline',
          accent: colors.danger,
          actions: pick('dismiss'),
          duration: 6000,
        };
      }

      case 'PASSENGER_APPROACHING': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: liveId(e.tripId),
          title: 'Passenger is approaching',
          body: 'Your passenger is walking to the vehicle.',
          icon: 'walk-outline',
          actions: pick('call', 'view'),
          duration: 6000,
        };
      }

      case 'PAYMENT_RECEIVED': {
        if (!this.once(e.tripId, e.type)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'payment'),
          title: 'Payment received',
          body: `${formatAmount(e.amount, e.currency)} has been credited to your earnings.`,
          icon: 'wallet-outline',
          accent: colors.success,
          actions: pick('view', 'dismiss'),
        };
      }

      case 'RATING_RECEIVED': {
        if (!this.once(e.tripId, `${e.type}:${e.rating ?? ''}`)) return null;
        return {
          ...base,
          id: channelId(e.tripId, 'rating'),
          title: 'Rating received',
          body: `A rider rated your trip ${e.rating?.toFixed(1) ?? '5.0'} stars.`,
          icon: 'star-outline',
          accent: colors.gold,
          actions: pick('dismiss'),
        };
      }

      default:
        return null;
    }
  }
}

function formatAmount(amount?: number, currency?: string): string {
  const value = (amount ?? 0).toFixed(2);
  if (currency === 'INR') return `₹${value}`;
  if (currency === 'EUR') return `€${value}`;
  return `$${value}`;
}

/** App-wide singleton. */
export const notificationService = new NotificationCenter();

// TEST MODE: expose the service in dev builds so notification flows can be
// exercised without a live trip (e.g. from the web console or dev menu):
//   __notifications.emit({ type: 'DRIVER_ETA', tripId: 't1', role: 'rider', etaMin: 4 })
if (__DEV__) {
  (globalThis as Record<string, unknown>).__notifications = notificationService;
}

// ─── Action dispatcher ───────────────────────────────────────────────────────

/**
 * Handles quick actions from BOTH surfaces (in-app banner buttons and native
 * notification actions). "Call Driver" reuses the existing tel: phone flow.
 */
export function performNotificationAction(
  action: NotificationActionId,
  notification: { id: string; deepLink: string; tripId?: string }
): void {
  switch (action) {
    case 'call': {
      const phone = useRideStore.getState().counterpartyPhone;
      if (!phone) {
        toast.info('Phone number not available yet.');
        return;
      }
      haptics.light();
      const sanitized = phone.replace(/[^\d+]/g, '');
      Linking.openURL(`tel:${sanitized}`).catch(() =>
        toast.error('Could not open the dialer on this device.')
      );
      break;
    }
    case 'message':
      toast.info('In-app messaging is coming soon.');
      break;
    case 'view':
      haptics.light();
      try {
        router.push((notification.deepLink || '/(app)/map') as never);
      } catch {
        /* navigation not ready — ignore */
      }
      break;
    case 'dismiss':
      notificationService.dismiss(notification.id, notification.tripId);
      break;
  }
}
