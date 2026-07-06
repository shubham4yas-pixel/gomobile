import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { notificationService } from '@/services/notificationService';
import { getSocket, onTripEvent } from '@/services/socketService';
import { useLocationStore } from '@/store/useLocationStore';
import { useRideStore, RideStatus } from '@/store/useRideStore';
import type { NotificationRole } from '@/types/notifications';

/**
 * useNotifications (Phase 20) — the ride-event → notification bridge.
 *
 * Mounted ONCE (inside <NotificationHost /> in the root layout). Observes ride
 * state transitions and live socket events and emits domain events into
 * `notificationService`. Ride logic (map.tsx, sheets) stays 100% unaware of
 * notifications; this hook is the only listener-side coupling point.
 *
 * Sources observed:
 *  • useRideStore status transitions  → accepted / arrived / started / completed
 *  • socket trip:eta-update           → live driver-approach channel (repeats)
 *  • socket trip:receipt              → payment success / receipt / earnings
 *  • socket trip:cancelled            → rider-cancelled (driver)
 *  • socket trip:rating-received      → rating received (driver)
 *  • useLocationStore during a trip   → approaching-destination (geo-fenced)
 *
 * TEST MODE: the passenger-verification flow is device-local (no socket
 * events), so the driver's "passenger approaching" and "OTP ready" moments are
 * simulated on a short delay after arrival — same events a backend would send.
 */

const APPROACH_RADIUS_KM = 0.75;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ACTIVE_STATUSES: RideStatus[] = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];

export function useNotifications(role: NotificationRole | null): void {
  // Test-mode simulation timers (driver verification moments) — cleared on
  // unmount and whenever the trip ends.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!role) return;

    void notificationService.initialize();

    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    const later = (ms: number, fn: () => void) => {
      timersRef.current.push(setTimeout(fn, ms));
    };

    // ── 1. Ride status transitions ────────────────────────────────────────
    const unsubStore = useRideStore.subscribe((state, prev) => {
      const tripId = state.rideId ?? prev.rideId ?? '';

      if (state.status !== prev.status) {
        const s = state.status;

        // Trip ended (cancel / reset / post-rating) → clear its notifications.
        if (s === 'IDLE' && ACTIVE_STATUSES.includes(prev.status)) {
          clearTimers();
          if (tripId) notificationService.clearTrip(tripId);
        }

        if (role === 'rider' && tripId) {
          if (s === 'ACCEPTED' && prev.status !== 'ARRIVED') {
            notificationService.emit({
              type: 'RIDE_ACCEPTED',
              tripId,
              role,
              driver: state.assignedDriver,
            });
          }
          if (s === 'ARRIVED') {
            notificationService.emit({
              type: 'DRIVER_ARRIVED',
              tripId,
              role,
              driver: state.assignedDriver,
            });
          }
          if (s === 'IN_PROGRESS') {
            notificationService.emit({ type: 'TRIP_STARTED', tripId, role });
          }
          if (s === 'COMPLETED') {
            notificationService.emit({ type: 'TRIP_COMPLETED', tripId, role });
          }
        }

        if (role === 'driver') {
          if (s === 'OFFERED' && state.pendingOffer) {
            notificationService.emit({
              type: 'RIDE_REQUEST',
              tripId: state.pendingOffer.rideId,
              role,
              distanceKm: state.pendingOffer.distanceKm,
            });
          }
          if (s === 'ARRIVED' && tripId) {
            // TEST MODE: simulate the passenger-side verification moments the
            // backend will eventually push (see module docblock).
            later(4000, () =>
              notificationService.emit({ type: 'PASSENGER_APPROACHING', tripId, role })
            );
            later(8000, () =>
              notificationService.emit({ type: 'OTP_READY', tripId, role })
            );
          }
          if (s === 'IN_PROGRESS' && tripId) {
            notificationService.emit({ type: 'TRIP_STARTED', tripId, role });
          }
          if (s === 'COMPLETED' && tripId) {
            notificationService.emit({ type: 'TRIP_COMPLETED', tripId, role });
          }
        }
      }

      // Receipt landed → payment + receipt notifications.
      if (!prev.receipt && state.receipt && tripId) {
        const { fare, currency } = state.receipt;
        if (role === 'rider') {
          notificationService.emit({
            type: 'PAYMENT_SUCCESS',
            tripId,
            role,
            amount: fare,
            currency,
          });
          later(1800, () =>
            notificationService.emit({ type: 'RECEIPT_READY', tripId, role })
          );
        } else {
          notificationService.emit({
            type: 'PAYMENT_RECEIVED',
            tripId,
            role,
            amount: fare,
            currency,
          });
        }
      }
    });

    // ── 2. Socket events (live channel + server-only moments) ────────────
    // The socket is created lazily by the map screen; poll until it exists,
    // then attach. Re-attaches if the socket instance is ever replaced.
    let socketUnsubs: (() => void)[] = [];
    let attachedSocket: unknown = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket || socket === attachedSocket) return;
      socketUnsubs.forEach((fn) => fn());
      socketUnsubs = [];
      attachedSocket = socket;

      if (role === 'rider') {
        socketUnsubs.push(
          onTripEvent('trip:eta-update', (data) => {
            const { tripPickup, status } = useRideStore.getState();
            if (status !== 'ACCEPTED') return;
            const distanceKm =
              data.driver && tripPickup
                ? haversineKm(data.driver.lat, data.driver.lng, tripPickup.lat, tripPickup.lng)
                : undefined;
            notificationService.emit({
              type: 'DRIVER_ETA',
              tripId: data.tripId,
              role,
              etaMin: data.etaMin,
              distanceKm,
              driver: data.driver
                ? { id: useRideStore.getState().assignedDriver?.id ?? '', ...data.driver }
                : null,
            });
          })
        );
      }

      if (role === 'driver') {
        socketUnsubs.push(
          onTripEvent('trip:cancelled', (data) => {
            const tripId = data?.tripId ?? useRideStore.getState().rideId;
            if (tripId) notificationService.emit({ type: 'RIDER_CANCELLED', tripId, role });
          })
        );
        socketUnsubs.push(
          onTripEvent('trip:rating-received', (data) => {
            if (!data?.tripId) return;
            notificationService.emit({
              type: 'RATING_RECEIVED',
              tripId: data.tripId,
              role,
              rating: typeof data.rating === 'number' ? data.rating : undefined,
            });
          })
        );
      }
      logger.debug('[Notif] socket listeners attached');
    };

    attach();
    const poll = setInterval(attach, 1000);

    // ── 3. Approaching destination (rider, geo-fenced on own GPS) ────────
    const unsubLocation =
      role === 'rider'
        ? useLocationStore.subscribe((loc) => {
            const { status, tripDropoff, rideId } = useRideStore.getState();
            if (status !== 'IN_PROGRESS' || !tripDropoff || !rideId || !loc.userLocation) return;
            const km = haversineKm(
              loc.userLocation.latitude,
              loc.userLocation.longitude,
              tripDropoff.lat,
              tripDropoff.lng
            );
            if (km <= APPROACH_RADIUS_KM) {
              notificationService.emit({ type: 'APPROACHING_DESTINATION', tripId: rideId, role });
            }
          })
        : null;

    return () => {
      clearTimers();
      unsubStore();
      unsubLocation?.();
      socketUnsubs.forEach((fn) => fn());
      clearInterval(poll);
    };
  }, [role]);
}
