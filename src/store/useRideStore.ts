import { create } from 'zustand';

/**
 * Ride Store (Zustand)
 *
 * Manages the ride lifecycle state for both riders and drivers.
 * Kept separate from useLocationStore to avoid coupling GPS tracking
 * with ride business logic.
 */

export type RideStatus =
  | 'IDLE'
  | 'CONFIRMING' // client-only: rider has picked a dropoff, reviewing route + fare
  | 'SEARCHING'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RideOffer {
  rideId: string;
  pickup: LatLng;
  dropoff: LatLng;
  riderId: string;
  distanceKm: number;
}

/**
 * A located place with a human-readable address (Phase 11).
 * Used for the rider's pickup (current location) and dropoff (Places result).
 * Coordinates use `latitude`/`longitude` (matches react-native-maps); the socket
 * wire format converts to `{lat,lng}` at the emit boundary in map.tsx.
 */
export interface LocatedPlace {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/** Real driving metrics from MapView.Directions onReady (Phase 11). */
export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

/**
 * How the rider is choosing their pickup point (Phase 12).
 * - 'current': snap pickup to the device GPS on an explicit tap.
 * - 'custom':  pickup chosen via Places search or by dragging the map pin.
 */
export type PickupMode = 'current' | 'custom';

/**
 * Third-party booking metadata (Phase 12). When `isThirdParty` is true the ride
 * is being booked on behalf of someone else, and `riderPhoneNumber` is the
 * actual passenger's contact number shared with the driver on accept.
 */
export interface BookingFor {
  isThirdParty: boolean;
  riderPhoneNumber: string | null;
}

/** Post-trip receipt pushed by the server on COMPLETED (Phase 9). */
export interface Receipt {
  tripId: string;
  fare: number;
  distanceKm: number;
  durationMin: number;
  baseFare: number;
  perKmRate: number;
  currency: string;
}

interface RideState {
  // State
  status: RideStatus;
  rideId: string | null;

  /** Rider-side: info about the assigned driver */
  assignedDriver: { id: string; lat: number; lng: number } | null;

  /** Contact number of the counterparty for the active trip (Phase 12).
   *  Rider holds the driver's number; driver holds the rider/passenger number. */
  counterpartyPhone: string | null;

  /** Rider-side: how the pickup is being chosen + the third-party booking. */
  pickupMode: PickupMode;
  bookingFor: BookingFor;

  /** Driver-side: incoming ride offer */
  pendingOffer: RideOffer | null;

  /** Rider-side: pickup (current location) + dropoff (chosen via Places). */
  pickupLocation: LocatedPlace | null;
  dropoffLocation: LocatedPlace | null;

  /** Pickup / dropoff for the active trip — used to draw the route. */
  tripPickup: LatLng | null;
  tripDropoff: LatLng | null;

  /** Real driving distance/duration from Directions (Phase 11). */
  routeInfo: RouteInfo | null;

  /** Post-trip receipt (fare/distance/duration) — drives the completed UI. */
  receipt: Receipt | null;

  /** Whether the user has submitted their post-trip rating. */
  ratingSubmitted: boolean;

  /** Error message from server */
  errorMessage: string | null;

  // Actions
  setStatus: (status: RideStatus) => void;
  setRideId: (id: string | null) => void;
  setAssignedDriver: (driver: { id: string; lat: number; lng: number } | null) => void;
  setPendingOffer: (offer: RideOffer | null) => void;
  setPickupLocation: (place: LocatedPlace | null) => void;
  setDropoffLocation: (place: LocatedPlace | null) => void;
  setCounterpartyPhone: (phone: string | null) => void;
  setPickupMode: (mode: PickupMode) => void;
  setBookingFor: (booking: BookingFor) => void;
  setTripRoute: (pickup: LatLng | null, dropoff: LatLng | null) => void;
  setRouteInfo: (info: RouteInfo | null) => void;
  setReceipt: (receipt: Receipt | null) => void;
  setRatingSubmitted: (submitted: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  reset: () => void;
  /** Full post-trip reset → clears receipt/rating and returns to IDLE. */
  resetRide: () => void;
}

const FRESH = {
  status: 'IDLE' as RideStatus,
  rideId: null,
  assignedDriver: null,
  counterpartyPhone: null,
  pickupMode: 'current' as PickupMode,
  bookingFor: { isThirdParty: false, riderPhoneNumber: null } as BookingFor,
  pendingOffer: null,
  pickupLocation: null,
  dropoffLocation: null,
  tripPickup: null,
  tripDropoff: null,
  routeInfo: null,
  receipt: null,
  ratingSubmitted: false,
  errorMessage: null,
};

export const useRideStore = create<RideState>((set) => ({
  // Initial state
  ...FRESH,

  // Actions
  setStatus: (status) => set({ status }),
  setRideId: (id) => set({ rideId: id }),
  setAssignedDriver: (driver) => set({ assignedDriver: driver }),
  setPendingOffer: (offer) => set({ pendingOffer: offer }),
  setPickupLocation: (place) => set({ pickupLocation: place }),
  setDropoffLocation: (place) => set({ dropoffLocation: place }),
  setCounterpartyPhone: (phone) => set({ counterpartyPhone: phone }),
  setPickupMode: (mode) => set({ pickupMode: mode }),
  setBookingFor: (booking) => set({ bookingFor: booking }),
  setTripRoute: (pickup, dropoff) => set({ tripPickup: pickup, tripDropoff: dropoff }),
  setRouteInfo: (info) => set({ routeInfo: info }),
  setReceipt: (receipt) => set({ receipt }),
  setRatingSubmitted: (submitted) => set({ ratingSubmitted: submitted }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),

  reset: () => set({ ...FRESH }),

  // Canonical post-trip reset (Phase 9). Identical to reset() today, but named
  // for the completed → idle transition so the intent is explicit at call sites.
  resetRide: () => set({ ...FRESH }),
}));
