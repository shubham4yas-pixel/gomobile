import type { Ionicons } from '@expo/vector-icons';

/**
 * Notification domain types (Phase 20 — Live Push Notification System).
 *
 * The notification layer is EVENT-DRIVEN: ride logic emits `RideNotificationEvent`s
 * through `notificationService.emit()`, the service maps them to renderable
 * `AppNotification`s, and a swappable `NotificationProvider` delivers them
 * (in-app banner while foregrounded, native tray while backgrounded). The UI
 * never talks to ride logic and ride logic never talks to the UI — only events
 * cross the boundary, so swapping the provider (local mock → Expo Push → FCM)
 * touches zero UI code.
 */

export type IoniconName = keyof typeof Ionicons.glyphMap;

// ─── Domain events (in) ──────────────────────────────────────────────────────

/** Every ride-lifecycle moment that can produce a notification. */
export type RideNotificationEventType =
  // Rider
  | 'RIDE_ACCEPTED'
  | 'DRIVER_ETA' // live en-route tick — repeats, updates in place
  | 'DRIVER_ARRIVED'
  | 'OTP_READY'
  | 'TRIP_STARTED'
  | 'APPROACHING_DESTINATION'
  | 'TRIP_COMPLETED'
  | 'PAYMENT_SUCCESS'
  | 'RECEIPT_READY'
  // Driver
  | 'RIDE_REQUEST'
  | 'RIDER_CANCELLED'
  | 'PASSENGER_APPROACHING'
  | 'PAYMENT_RECEIVED'
  | 'RATING_RECEIVED';

export type NotificationRole = 'rider' | 'driver';

/** A ride event emitted INTO the notification service. */
export interface RideNotificationEvent {
  type: RideNotificationEventType;
  tripId: string;
  role: NotificationRole;
  /** Live-approach data (DRIVER_ETA). */
  etaMin?: number;
  distanceKm?: number;
  driver?: { id: string; lat: number; lng: number } | null;
  /** Payment / rating metadata. */
  amount?: number;
  currency?: string;
  rating?: number;
  /** OTP code to surface (test mode generates it client-side). */
  otp?: string;
}

// ─── Renderable notifications (out) ─────────────────────────────────────────

/** Quick actions a notification can carry. Handled by the service dispatcher. */
export type NotificationActionId = 'call' | 'message' | 'view' | 'dismiss';

export interface NotificationAction {
  id: NotificationActionId;
  label: string;
  icon: IoniconName;
}

/** Live driver-approach payload — drives the animated progress banner. */
export interface LiveApproachData {
  driverName: string;
  vehicle: string;
  plate: string;
  etaMin: number;
  distanceKm: number;
  /** 0 → just accepted, 1 → at the pickup. Animates the progress bar. */
  progress: number;
  phase: 'en-route' | 'arriving' | 'arrived';
}

/**
 * A fully-resolved, renderable notification. `id` is a STABLE channel key
 * (`{tripId}:live`, `{tripId}:payment`, …) — re-delivering the same id updates
 * the existing notification in place instead of stacking a new one.
 */
export interface AppNotification {
  id: string;
  tripId: string;
  type: RideNotificationEventType;
  role: NotificationRole;
  title: string;
  body: string;
  icon: IoniconName;
  accent: string;
  actions: NotificationAction[];
  /** Sticky notifications persist until replaced/dismissed (live channel). */
  sticky: boolean;
  /** ms before auto-dismiss for non-sticky notifications. */
  duration: number;
  timestamp: number;
  live?: LiveApproachData;
  /** Deep link target when the (native) notification is tapped. */
  deepLink: string;
}

// ─── Provider abstraction ────────────────────────────────────────────────────

/** Where the app is when a notification is delivered. */
export type DeliveryContext = 'foreground' | 'background';

/**
 * Transport abstraction. Today a local mock (in-app banners + local OS
 * notifications); later an Expo Push or FCM implementation — same interface,
 * zero UI changes.
 */
export interface NotificationProvider {
  readonly name: string;
  /** Register channels/categories/permissions. Called once, idempotent. */
  initialize(): Promise<void> | void;
  /** Create OR update-in-place (same `notification.id`) a notification. */
  deliver(notification: AppNotification, context: DeliveryContext): Promise<void>;
  /** Remove one notification everywhere it may be showing. */
  dismiss(id: string, tripId?: string): Promise<void>;
  /** Remove everything (trip ended / logout). */
  dismissAll(): Promise<void>;
}
