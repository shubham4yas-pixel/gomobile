import { logger } from '@/lib/logger';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Reanimated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import MapView, {
  Marker,
  Polyline,
  MapDirections,
  PROVIDER_GOOGLE,
} from '@/components/MapView';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import {
  useRideStore,
  RideStatus,
  LocatedPlace,
  BookingFor,
  TripSummary,
} from '@/store/useRideStore';
import { colors, radius, withAlpha, fonts, elevationShadows } from '@/theme/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { LIGHT_MAP_STYLE } from '@/config/mapStyle';
import { haptics } from '@/lib/haptics';
import { RiderBottomSheet } from '@/components/sheets/RiderBottomSheet';
import { DriverBottomSheet } from '@/components/sheets/DriverBottomSheet';
import { SocketDiagnostics } from '@/components/trip/SocketDiagnostics';
import { LocationMarker, DriverMarker } from '@/components/trip/MemoizedMarkers';
import { useAnimatedCoordinate } from '@/hooks/useAnimatedCoordinate';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';
import { isValidPhone, normalizePhone } from '@/components/ui/PhoneInput';
import {
  requestLocationPermission,
  getCurrentPosition,
  watchPosition,
} from '@/services/locationService';
import { reverseGeocode } from '@/services/geocoding';
import { registerForPushNotifications, addForegroundListener, savePushTokenToFirestore } from '@/services/pushService';
import { notificationService } from '@/services/notificationService';
import {
  connectSocket,
  emitLocation,
  emitTripRequest,
  emitTripCancel,
  emitTripAccept,
  emitTripReject,
  emitTripStatusUpdate,
  emitSubmitRating,
  emitRegisterPushToken,
  emitRegisterFcmToken,
  onTripEvent,
  getSocketUrl,
} from '@/services/socketService';
import { getFcmToken, addFcmForegroundListener } from '@/services/fcmService';

/** Default region fallback (San Francisco) when GPS is unavailable */
const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// Fare estimate constants — mirror the backend (BASE_FARE / PER_KM_RATE) so the
// authorized hold matches the rider's previewed estimate (Phase 13).
const BASE_FARE = 3.0;
const PER_KM_RATE = 1.5;

// TEMPORARY diagnostics overlay (device-to-device visibility debugging). Shows
// live GPS, socket-connection status, the backend URL, and the driver count.
// Flip to false (or delete the <DebugOverlay/>) once the issue is resolved.
const SHOW_DEBUG = false;

type Coord = { latitude: number; longitude: number };

export type VerificationState = 'WAITING_FOR_PASSENGER' | 'PASSENGER_APPROACHING' | 'PASSENGER_READY' | 'OTP_PENDING' | 'OTP_VERIFIED' | 'READY_TO_START';

/**
 * Map Screen
 *
 * Full-screen interactive map with a premium @gorhom/bottom-sheet that reacts
 * to the ride lifecycle. Handles the full trip flow for both riders and drivers,
 * including live route drawing once a ride is accepted.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { role, logout } = useAuthStore();
  const {
    userLocation,
    permissionStatus,
    nearbyDrivers,
    setLocation,
    setPermissionStatus,
    setError,
    setTracking,
    setNearbyDrivers,
  } = useLocationStore();

  const {
    status: tripStatus,
    rideId: tripId,
    assignedDriver,
    pendingOffer,
    pickupLocation,
    dropoffLocation,
    routeInfo,
    pickupMode,
    bookingFor,
    counterpartyPhone,
    tripPickup,
    tripDropoff,
    receipt,
    errorMessage,
    setStatus: setTripStatus,
    setRideId: setTripId,
    setAssignedDriver,
    setPendingOffer,
    setPickupLocation,
    setDropoffLocation,
    setTripRoute,
    setRouteInfo,
    setPickupMode,
    setBookingFor,
    setCounterpartyPhone,
    setReceipt,
    setErrorMessage,
    reset: resetTrip,
    resetRide,
  } = useRideStore();

  // Driver-side: whether the active trip is a third-party booking (Phase 12).
  const [counterpartyIsThirdParty, setCounterpartyIsThirdParty] = useState(false);

  // Arrival & Verification Workflow States
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('WAITING_FOR_PASSENGER');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Active Trip Progress States
  const [tripProgress, setTripProgress] = useState<number>(0);
  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number | null>(null);
  const [remainingDurationMin, setRemainingDurationMin] = useState<number | null>(null);
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);

  // Phase 13: native payment sheet + in-flight authorization flag.
  const { pay } = usePaymentSheet();
  const [authorizingPayment, setAuthorizingPayment] = useState(false);

  // Debug: live socket-connection status for the diagnostics overlay.
  const [socketConnected, setSocketConnected] = useState(false);
  const router = useRouter();

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sheetRef = useRef<BottomSheet>(null);
  const errorTimeoutRef = useRef<any>(null);

  const setSafeErrorMessage = useCallback((msg: string | null, autoClearMs?: number) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (msg && autoClearMs) {
      errorTimeoutRef.current = setTimeout(() => setErrorMessage(null), autoClearMs);
    }
  }, [setErrorMessage]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Sheet position (Y of the sheet top, in px from screen top) drives the
  // map blur/dim overlay (Phase 15): the higher the sheet rises, the more the
  // map recedes. A continuous mapping that works with `enableDynamicSizing`.
  const { height: windowHeight } = useWindowDimensions();
  const sheetPosition = useSharedValue(windowHeight);
  const dimStyle = useAnimatedStyle(() => ({
    // Fully clear when the sheet sits low (a small peek); ramps to a soft
    // dim as the sheet covers the upper half of the screen.
    opacity: interpolate(
      sheetPosition.value,
      [windowHeight * 0.4, windowHeight * 0.72],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));
  const userIdRef = useRef<string>(''); // the userId used for the live socket (for rating submit)
  // Driver: first pickup→dropoff driving metrics captured at ride start (Phase 11).
  const drivenRouteRef = useRef<{ distanceKm: number; durationMin: number } | null>(null);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const accentColor = role === 'rider' ? colors.rider : colors.driver;
  const roleIcon = role === 'rider' ? 'navigate-outline' : 'car-sport-outline';
  const roleLabel = role ?? 'User';
  const sheetSnapPoints = useMemo(() => ['32%', '64%', '92%'], []);

  // ─── Location Init ──────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    const initLocation = async () => {
      setTracking(true);

      const permission = await requestLocationPermission();
      if (!isMounted) return;

      setPermissionStatus(permission.status);

      if (permission.granted) {
        const position = await getCurrentPosition();
        if (!isMounted) return;

        if (position) {
          setLocation(position.latitude, position.longitude);
          mapRef.current?.animateToRegion(
            {
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
          subscription = await watchPosition((coords) => {
            setLocation(coords.latitude, coords.longitude);
          });
        } else {
          setError('Could not determine your location');
        }
      } else {
        setError('Location permission denied');
      }

      setTracking(false);
    };

    initLocation();

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.remove === 'function') {
        try {
          subscription.remove();
        } catch (e) {
          logger.warn('Could not remove location subscription:', e);
        }
      }
    };
  }, [setLocation, setPermissionStatus, setError, setTracking]);

  // ─── Pulse Animation (user marker) ──────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // ─── Socket Connection Lifecycle ─────────────────────────────────────────
  useEffect(() => {
    const userId = useAuthStore.getState().user?.uid || `dev-${role}-${Date.now()}`;
    const phone = useAuthStore.getState().phone;
    userIdRef.current = userId;

    // Connects or reuses the existing socket for this user
    const socket = connectSocket(role || 'rider', userId, phone);

    // Diagnostic state updates
    setSocketConnected(socket.connected);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // We do NOT disconnect the socket here on cleanup.
    // The socket lives as long as the app/auth state remains the same.
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [role]); // Only re-run if role changes

  // ─── Trip Event Listeners ───────────────────────────────────────────────
  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;

    // Since connectSocket returns the existing socket if already connected,
    // this is safe to call and guarantees we have the instance to attach listeners to.
    const phone = useAuthStore.getState().phone;
    const socket = connectSocket(role || 'rider', userId, phone);

    if (role === 'rider') {
      socket.on('drivers:nearby', (drivers) => setNearbyDrivers(drivers));
    }

    // Register for remote push (Phase 12). Fire-and-forget; no-ops in Expo Go.
    // Waits for the socket to connect so the token reaches the server.
    let pushUnsub: (() => void) | null = null;
    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        if (socket.connected) emitRegisterPushToken(token);
        else socket.once('connect', () => emitRegisterPushToken(token));
        // Belt-and-suspenders: persist to Firestore via client SDK (Phase 15).
        savePushTokenToFirestore(userId, token);
      }

      // Register the native FCM token too (Phase 15) — it carries the data-only
      // ETA messages that drive the live notification while backgrounded/quit.
      const fcmToken = await getFcmToken();
      if (fcmToken) {
        if (socket.connected) emitRegisterFcmToken(fcmToken);
        else socket.once('connect', () => emitRegisterFcmToken(fcmToken));
      }
    })();
    // Surface foreground pushes (the OS shows them, but log for debugging).
    pushUnsub = addForegroundListener((n) =>
      logger.debug('[Push] Foreground notification:', n.request.content.title)
    );
    // Foreground FCM data messages → update the live ETA notification in place
    // (idempotent with the socket path; both reuse the tripId notification id).
    const fcmForegroundUnsub = role === 'rider' ? addFcmForegroundListener() : null;

    const unsubs: (() => void)[] = [];

    // ── Reconnect resync (Phase 16) ───────────────────────────────────────
    // After a drop, the server re-attaches this socket to any in-flight trip
    // (matched by verified userId) and replays its state — restore the UI.
    unsubs.push(
      onTripEvent('trip:resync', (data) => {
        setTripId(data.tripId);
        setTripRoute(data.pickup, data.dropoff);
        setTripStatus(data.status as RideStatus);
        setPendingOffer(null);
        if (data.driver) setAssignedDriver(data.driver);
        setCounterpartyPhone(data.counterpartyPhone ?? null);
        setCounterpartyIsThirdParty(!!data.isThirdParty);
        logger.debug(`[Socket] Resynced to trip ${data.tripId} (${data.status})`);
      })
    );

    // Rider-side heads-up while the driver's connection drops mid-trip; the
    // server auto-cancels if they don't return within the grace window.
    unsubs.push(
      onTripEvent('trip:driver-connection', (data) => {
        if (data.state === 'lost') {
          setErrorMessage('Driver connection lost — hang tight, reconnecting…');
        } else {
          setErrorMessage(null);
        }
      })
    );

    // ── Rider events ──────────────────────────────────────────────────────
    unsubs.push(
      onTripEvent('trip:searching', (data) => {
        setTripId(data.tripId);
        setTripStatus('SEARCHING');
      })
    );

    unsubs.push(
      onTripEvent('trip:accepted', (data) => {
        haptics.success();
        setTripStatus('ACCEPTED');
        setAssignedDriver(data.driver);
        // Mutual contact exchange (Phase 12): rider receives the driver's phone.
        setCounterpartyPhone(data.driverPhone ?? null);
      })
    );

    // Server emits `trip:status-changed` to the rider as the driver advances.
    unsubs.push(
      onTripEvent('trip:status-changed', (data) => {
        if (data.status === 'COMPLETED') {
          haptics.success();
          setTripStatus(data.status as RideStatus);
          // No auto-dismiss — rider stays on the receipt until they submit a rating.
        } else {
          haptics.light();
          setTripStatus(data.status as RideStatus);
        }
        // Live/tray notifications for these transitions are handled by the
        // notification layer (Phase 20) — it observes this same store change.
      })
    );

    // Receipt arrives on completion (both rider and driver).
    unsubs.push(
      onTripEvent('trip:receipt', (data) => {
        setReceipt(data);
      })
    );

    unsubs.push(
      onTripEvent('trip:no-drivers', () => {
        resetTrip();
        setSafeErrorMessage('No drivers available nearby. Please try again.', 4000);
      })
    );

    unsubs.push(
      onTripEvent('trip:cancelled', () => {
        // Notification cleanup happens in the notification layer (Phase 20),
        // which watches the ACTIVE → IDLE transition this reset triggers.
        resetTrip();
      })
    );

    // ── Driver events ─────────────────────────────────────────────────────
    unsubs.push(
      onTripEvent('trip:offered', (data) => {
        haptics.heavy(); // alert the driver to a fresh ride offer
        setPendingOffer({ ...data, rideId: data.tripId });
        setTripRoute(data.pickup, data.dropoff);
        setTripStatus('OFFERED');
      })
    );

    unsubs.push(
      onTripEvent('trip:confirmed', (data) => {
        setTripId(data.tripId);
        setTripRoute(data.pickup, data.dropoff);
        setTripStatus('ACCEPTED');
        setPendingOffer(null);
        // Mutual contact exchange (Phase 12): driver receives the rider/passenger
        // phone — the third-party number when the ride was booked for someone else.
        setCounterpartyPhone(data.riderPhone ?? null);
        setCounterpartyIsThirdParty(!!data.isThirdParty);
      })
    );

    unsubs.push(
      onTripEvent('trip:offer-expired', () => {
        setPendingOffer(null);
        setTripRoute(null, null);
        setTripStatus('IDLE');
      })
    );

    unsubs.push(
      onTripEvent('trip:error', (data) => {
        setSafeErrorMessage(data.message, 4000);
      })
    );

    return () => {
      unsubs.forEach((fn) => fn());
      if (pushUnsub) pushUnsub();
      if (fcmForegroundUnsub) fcmForegroundUnsub();
      // DO NOT call disconnectSocket() here to prevent socket churn on state updates.
    };
  }, [
    role,
    setNearbyDrivers,
    setTripStatus,
    setTripId,
    setAssignedDriver,
    setPendingOffer,
    setTripRoute,
    setReceipt,
    setErrorMessage,
    setCounterpartyPhone,
    resetTrip,
    setSafeErrorMessage,
  ]);

  // ─── Driver GPS Emit ────────────────────────────────────────────────────
  useEffect(() => {
    if (role !== 'driver') return;

    // Emit initial location immediately if available
    const initialLoc = useLocationStore.getState().userLocation;
    if (initialLoc) {
      emitLocation(initialLoc.latitude, initialLoc.longitude);
    }

    const interval = setInterval(() => {
      const currentLoc = useLocationStore.getState().userLocation;
      if (currentLoc) emitLocation(currentLoc.latitude, currentLoc.longitude);
    }, 10000);

    return () => clearInterval(interval);
  }, [role]);

  // ─── Rider: Follow-mode (re-center on GPS while idle, no dropoff) ─────────
  useEffect(() => {
    if (role !== 'rider' || tripStatus !== 'IDLE' || dropoffLocation) return;
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  }, [userLocation, role, tripStatus, dropoffLocation]);

  // ─── Rider: populate the "current location" pickup while idle (Phase 12) ───
  // Only fills an empty pickup so it doesn't clobber a custom search/pin choice
  // or re-fire on every GPS tick.
  useEffect(() => {
    if (role !== 'rider' || tripStatus !== 'IDLE' || pickupMode !== 'current') return;
    if (pickupLocation || !userLocation) return;
    let cancelled = false;
    (async () => {
      const address = await reverseGeocode(userLocation.latitude, userLocation.longitude);
      if (!cancelled) {
        setPickupLocation({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          formattedAddress: address,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, tripStatus, pickupMode, pickupLocation, userLocation, setPickupLocation]);

  // ─── Rider: capture pickup (reverse-geocoded current GPS) when confirming ──
  useEffect(() => {
    if (tripStatus !== 'CONFIRMING' || pickupLocation || !userLocation) return;
    let cancelled = false;
    (async () => {
      const address = await reverseGeocode(userLocation.latitude, userLocation.longitude);
      if (!cancelled) {
        setPickupLocation({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          formattedAddress: address,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripStatus, pickupLocation, userLocation, setPickupLocation]);

  // ─── Rider: frame pickup → dropoff while confirming ───────────────────────
  useEffect(() => {
    if (role !== 'rider' || tripStatus !== 'CONFIRMING' || !dropoffLocation || !userLocation) return;
    mapRef.current?.fitToCoordinates(
      [
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude },
      ],
      { edgePadding: { top: 120, right: 80, bottom: 380, left: 80 }, animated: true }
    );
    // Only refit when the dropoff itself changes, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tripStatus, dropoffLocation?.latitude, dropoffLocation?.longitude]);

  // Reset the directions-failed flag + captured trip distance when leaving a trip.
  useEffect(() => {
    if (tripStatus === 'IDLE' || tripStatus === 'SEARCHING') {
      setDirectionsFailed(false);
      drivenRouteRef.current = null;
      setCounterpartyIsThirdParty(false);
      setArrivedAt(null);
      setVerificationState('WAITING_FOR_PASSENGER');
      setVerificationCode(null);
      setOtpError(null);
      setTripProgress(0);
      setRemainingDistanceKm(null);
      setRemainingDurationMin(null);
      setTripSummary(null);
    }

    // Initialize tracking metrics when trip starts
    if (tripStatus === 'IN_PROGRESS' && routeInfo) {
      setTripProgress(10); // Example initial progress
      setRemainingDistanceKm(routeInfo.distanceKm);
      setRemainingDurationMin(routeInfo.durationMin);

      const estFare = routeInfo.distanceKm * 2.5 + 5; // Basic mockup
      setTripSummary({
        distanceKm: routeInfo.distanceKm,
        durationMin: routeInfo.durationMin,
        estimatedFare: estFare,
        estimatedEarnings: estFare * 0.75,
        currency: '$',
      });
    }
  }, [tripStatus, routeInfo]);

  // ─── Trip Actions ───────────────────────────────────────────────────────
  const handleOpenMap = useCallback(() => {
    router.push('/destination');
  }, [router]);

  const handleOpenHistory = useCallback(() => {
    haptics.selection();
    // Riders see their trip history; drivers get their earnings dashboard (Phase 14).
    router.push(role === 'driver' ? '/earnings' : '/history');
  }, [router, role]);

  // Rider picked a Places result → review route + fare before requesting.
  const handleSelectDestination = useCallback(
    (place: LocatedPlace) => {
      haptics.selection();
      setDropoffLocation(place);
      setRouteInfo(null);
      setTripStatus('CONFIRMING');
    },
    [setDropoffLocation, setRouteInfo, setTripStatus]
  );

  // ── Pickup selection (Phase 12) ──────────────────────────────────────────
  // Explicitly snap the pickup to the device GPS (reverse-geocoded for display).
  const handleUseCurrentPickup = useCallback(() => {
    haptics.selection();
    setPickupMode('current');
    if (!userLocation) return;
    (async () => {
      const address = await reverseGeocode(userLocation.latitude, userLocation.longitude);
      setPickupLocation({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        formattedAddress: address,
      });
    })();
  }, [userLocation, setPickupMode, setPickupLocation]);

  // Switch to custom pickup → search an address or drag the pin.
  const handleChoosePickupCustom = useCallback(() => {
    haptics.selection();
    setPickupMode('custom');
  }, [setPickupMode]);

  // Rider picked a pickup address from Places.
  const handleSelectPickup = useCallback(
    (place: LocatedPlace) => {
      haptics.selection();
      setPickupMode('custom');
      setPickupLocation(place);
    },
    [setPickupMode, setPickupLocation]
  );

  // Rider dragged the pickup pin → reverse-geocode the dropped coordinate.
  const handlePickupDragEnd = useCallback(
    (coord: { latitude: number; longitude: number }) => {
      haptics.light();
      setPickupMode('custom');
      (async () => {
        const address = await reverseGeocode(coord.latitude, coord.longitude);
        setPickupLocation({ ...coord, formattedAddress: address });
      })();
    },
    [setPickupMode, setPickupLocation]
  );

  const handleChangeBookingFor = useCallback(
    (booking: BookingFor) => setBookingFor(booking),
    [setBookingFor]
  );

  // Place a phone call to the trip counterparty (Phase 12 contact exchange).
  const handleCallCounterparty = useCallback(() => {
    if (!counterpartyPhone) return;
    haptics.medium();
    const sanitized = counterpartyPhone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${sanitized}`).catch(() =>
      setErrorMessage('Could not open the phone dialer')
    );
  }, [counterpartyPhone, setErrorMessage]);

  // Lift the sheet above the keyboard so the autocomplete results stay visible.
  const handleFocusSearch = useCallback(() => {
    sheetRef.current?.snapToIndex(2);
  }, []);

  // Back out of confirming → clear only the dropoff and return to idle search.
  // The chosen pickup + booking-for selection are preserved (Phase 12).
  const handleChangeDestination = useCallback(() => {
    setDropoffLocation(null);
    setRouteInfo(null);
    setTripStatus('IDLE');
  }, [setDropoffLocation, setRouteInfo, setTripStatus]);

  // Confirm → authorize payment (Phase 13 escrow), then emit the trip request
  // with the real distance (Phase 11), third-party booking (Phase 12), and the
  // authorized payment reference. Payment failure never locks the state machine.
  const handleConfirmRide = useCallback(async () => {
    if (!userLocation || !dropoffLocation || authorizingPayment) return;

    // A third-party booking must carry a valid passenger phone number.
    if (bookingFor.isThirdParty && !isValidPhone(bookingFor.riderPhoneNumber ?? '')) {
      setSafeErrorMessage("Enter the rider's phone number, or turn off third-party booking.", 4000);
      return;
    }

    // Convert the LocatedPlace display objects to the {lat,lng} socket wire format.
    // Carry the formatted addresses too (Phase 14) so the persisted trip can show
    // a readable "from → to" in the rider's ride history.
    const pickup = pickupLocation
      ? {
          lat: pickupLocation.latitude,
          lng: pickupLocation.longitude,
          address: pickupLocation.formattedAddress ?? null,
        }
      : { lat: userLocation.latitude, lng: userLocation.longitude, address: null };
    const dropoff = {
      lat: dropoffLocation.latitude,
      lng: dropoffLocation.longitude,
      address: dropoffLocation.formattedAddress ?? null,
    };
    const normalizedBooking: BookingFor = bookingFor.isThirdParty
      ? { isThirdParty: true, riderPhoneNumber: normalizePhone(bookingFor.riderPhoneNumber ?? '') }
      : { isThirdParty: false, riderPhoneNumber: null };

    // Authorize the estimated fare (escrow hold) before broadcasting the ride.
    const fareEstimate = routeInfo
      ? Math.round((BASE_FARE + routeInfo.distanceKm * PER_KM_RATE) * 100) / 100
      : BASE_FARE;

    // ── DEV BYPASS REMOVED: Restore actual pay() invocation ──────────────
    setAuthorizingPayment(true);
    const result = await pay({
      amount: fareEstimate,
      currency: 'USD',
      userId: userIdRef.current,
      description: 'RideShare fare authorization',
      contact: useAuthStore.getState().phone,
    });
    setAuthorizingPayment(false);

    if (!result.ok) {
      haptics.heavy();
      setSafeErrorMessage(
        'Payment authorization failed. Please update your payment method to request a ride.',
        6000
      );
      return;
    }
    // ── END DEV BYPASS REMOVAL ───────────────────────────────────────────

    haptics.medium();
    setTripRoute(pickup, dropoff);
    emitTripRequest(
      pickup,
      dropoff,
      routeInfo ? { distanceKm: routeInfo.distanceKm, durationMin: routeInfo.durationMin } : undefined,
      normalizedBooking,
      { orderId: result.payment?.orderId ?? null, paymentId: result.payment?.paymentId ?? 'bypass' }
    );
    setTripStatus('SEARCHING');
  }, [
    userLocation,
    dropoffLocation,
    pickupLocation,
    routeInfo,
    bookingFor,
    authorizingPayment,
    pay,
    setTripRoute,
    setTripStatus,
    setSafeErrorMessage,
  ]);

  const handleCancelSearch = useCallback(() => {
    if (tripId) emitTripCancel(tripId);
    resetTrip();
  }, [tripId, resetTrip]);

  // Cancel after a driver is assigned. The dispatch server only supports
  // cancellation during SEARCHING/OFFERED, so this resets the rider locally;
  // full post-accept cancellation is a backend follow-up.
  const handleCancelTrip = useCallback(() => {
    resetTrip();
  }, [resetTrip]);

  const handleAcceptOffer = useCallback(() => {
    if (!pendingOffer) return;
    const id = pendingOffer.rideId;
    emitTripAccept(id);
    setTripId(id);
    setTripStatus('ACCEPTED');
  }, [pendingOffer, setTripId, setTripStatus]);

  const handleDeclineOffer = useCallback(() => {
    if (!pendingOffer) return;
    emitTripReject(pendingOffer.rideId);
    setPendingOffer(null);
    setTripRoute(null, null);
    setTripStatus('IDLE');
    setTripId(null);
  }, [pendingOffer, setPendingOffer, setTripRoute, setTripStatus, setTripId]);

  const handleDriverStatusUpdate = useCallback(() => {
    if (!tripId) return;
    const nextStatus: Record<string, string> = {
      ACCEPTED: 'ARRIVED',
      ARRIVED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    };
    const next = nextStatus[tripStatus];
    if (next) {
      if (next === 'ARRIVED') {
        setArrivedAt(Date.now());
      }
      if (next === 'COMPLETED') {
        haptics.success();
        // Send the real driving distance/duration captured from Directions so the
        // server computes the fare from real-world miles (falls back to haversine).
        const real = drivenRouteRef.current;
        emitTripStatusUpdate(tripId, next, real ?? undefined);
      } else {
        haptics.medium();
        emitTripStatusUpdate(tripId, next);
      }
      setTripStatus(next as RideStatus);
      // No auto-dismiss on COMPLETED — driver stays on the earnings/rating card
      // until they tap "Go Online".
    }
  }, [tripId, tripStatus, setTripStatus]);

  // Handle Rider clicking "I'm coming"
  const handleAcknowledgeArrival = useCallback(() => {
    haptics.medium();
    setVerificationState('PASSENGER_APPROACHING');
  }, []);

  // Handle Rider clicking "I'm at the vehicle"
  const handlePassengerAtVehicle = useCallback(() => {
    haptics.medium();
    setVerificationState('PASSENGER_READY');
    // Simulate backend generating an OTP when passenger arrives
    setTimeout(() => {
      setVerificationCode('4829');
      // Ride event → notification layer (Phase 20): surface the fresh PIN.
      const { rideId } = useRideStore.getState();
      if (rideId) {
        notificationService.emit({ type: 'OTP_READY', tripId: rideId, role: 'rider', otp: '4829' });
      }
    }, 1500);
  }, []);

  // Handle Driver tapping "Verify Passenger"
  const handleDriverEnterOTP = useCallback(() => {
    haptics.light();
    setVerificationState('OTP_PENDING');
  }, []);

  // Handle Driver verifying the PIN
  const handleVerifyOTP = useCallback((code: string) => {
    if (code === '4829') {
      haptics.success();
      setOtpError(null);
      setVerificationState('OTP_VERIFIED');
      setTimeout(() => {
        setVerificationState('READY_TO_START');
      }, 1500);
    } else {
      haptics.error();
      setOtpError('Invalid code');
    }
  }, []);

  // Submit the post-trip rating, then fully reset back to idle (Phase 9).
  const handleSubmitRating = useCallback(
    (rating: number) => {
      if (tripId) emitSubmitRating(tripId, userIdRef.current, rating, role || 'rider');
      haptics.success();
      resetRide();
    },
    [tripId, role, resetRide]
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  }, []);

  // ─── Route geometry ───────────────────────────────────────────────────────
  const liveDriver = useMemo(() => {
    if (role !== 'rider' || !assignedDriver) return null;
    return nearbyDrivers.find((d) => d.id === assignedDriver.id) ?? null;
  }, [role, assignedDriver, nearbyDrivers]);

  // Rider is reviewing a chosen dropoff before requesting → draw pickup→dropoff.
  const riderConfirming = role === 'rider' && tripStatus === 'CONFIRMING' && !!dropoffLocation;

  const inRouteState =
    role === 'driver'
      ? ['OFFERED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(tripStatus)
      : ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(tripStatus);

  // Live driver telemetry → smooth marker motion (Phase 12, Task 4).
  // Target the freshest known position of the assigned driver; the hook eases
  // the rendered coordinate between socket ticks so the car never teleports.
  const assignedDriverTarget = useMemo<Coord | null>(() => {
    if (role !== 'rider' || !inRouteState) return null;
    if (liveDriver) return { latitude: liveDriver.lat, longitude: liveDriver.lng };
    if (assignedDriver) return { latitude: assignedDriver.lat, longitude: assignedDriver.lng };
    return null;
  }, [role, inRouteState, liveDriver, assignedDriver]);
  const animatedDriverCoord = useAnimatedCoordinate(assignedDriverTarget);

  let routeOrigin: Coord | null = null;
  let routeDestination: Coord | null = null;
  if (riderConfirming) {
    routeOrigin = userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : null;
    routeDestination = dropoffLocation
      ? { latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }
      : null;
  } else if (inRouteState) {
    const dest = tripStatus === 'IN_PROGRESS' ? tripDropoff : tripPickup;
    routeDestination = dest ? { latitude: dest.lat, longitude: dest.lng } : null;
    if (role === 'rider') {
      // Prefer the smoothed coordinate so the drawn route follows the gliding car.
      routeOrigin = animatedDriverCoord
        ? animatedDriverCoord
        : liveDriver
        ? { latitude: liveDriver.lat, longitude: liveDriver.lng }
        : assignedDriver
        ? { latitude: assignedDriver.lat, longitude: assignedDriver.lng }
        : null;
    } else {
      routeOrigin = userLocation
        ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
        : null;
    }
  }

  const showRoute = (riderConfirming || inRouteState) && !!routeOrigin && !!routeDestination;
  const showPickupMarker =
    role === 'driver' &&
    tripPickup &&
    ['OFFERED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(tripStatus);
  const showDropoffMarker =
    tripDropoff && ['OFFERED', 'ARRIVED', 'ACCEPTED', 'IN_PROGRESS'].includes(tripStatus);
  const showConfirmDropoff = riderConfirming;

  const fitToRoute = useCallback((coords: Coord[]) => {
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 140, right: 70, bottom: 360, left: 70 },
      animated: true,
    });
  }, []);

  const mapRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : DEFAULT_REGION;

  const isTracking = useLocationStore((s) => s.isTracking);

  const handleDirectionsReady = useCallback((result: any) => {
    if (result?.coordinates) fitToRoute(result.coordinates);
    const distanceKm = Math.round((result?.distance ?? 0) * 100) / 100;
    const durationMin = Math.max(1, Math.round(result?.duration ?? 0));

    if ((riderConfirming || inRouteState) && distanceKm > 0) {
      setRouteInfo({ distanceKm, durationMin });
    }

    if (
      role === 'driver' &&
      tripStatus === 'IN_PROGRESS' &&
      !drivenRouteRef.current &&
      distanceKm > 0
    ) {
      drivenRouteRef.current = { distanceKm, durationMin };
    }
  }, [fitToRoute, riderConfirming, inRouteState, role, tripStatus, setRouteInfo]);

  const handleDirectionsError = useCallback(() => {
    setDirectionsFailed(true);
    if (routeOrigin && routeDestination) {
      fitToRoute([routeOrigin, routeDestination]);
    }
  }, [routeOrigin, routeDestination, fitToRoute]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <SocketDiagnostics />
      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
        customMapStyle={LIGHT_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        userInterfaceStyle="light"
      >
        {/* User Marker */}
        {userLocation && (
          <Marker
            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.markerContainer}>
              <Animated.View
                style={[
                  styles.markerPulse,
                  {
                    backgroundColor: withAlpha(accentColor, 0x25),
                    borderColor: withAlpha(accentColor, 0x40),
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.8, 0] }),
                  },
                ]}
              />
              <View style={[styles.markerDot, { backgroundColor: accentColor, shadowColor: accentColor }]} />
              <View style={styles.markerInner} />
            </View>
          </Marker>
        )}

        {/* Rider Pickup Pin (Phase 12) — distinct blue 👤 pin, draggable while idle */}
        {role === 'rider' &&
          pickupLocation &&
          (tripStatus === 'IDLE' || tripStatus === 'CONFIRMING') && (
            <LocationMarker
              coordinate={{
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              }}
              address={pickupLocation.formattedAddress}
              type="pickup"
              draggable={tripStatus === 'IDLE'}
              onDragEnd={(e: any) => handlePickupDragEnd(e.nativeEvent.coordinate)}
            />
          )}

        {/* Nearby Drivers (Rider Only) */}
        {role === 'rider' &&
          nearbyDrivers.map((driver) => {
            const isAssigned = assignedDriver?.id === driver.id;
            const coordinate =
              isAssigned && animatedDriverCoord
                ? animatedDriverCoord
                : { latitude: driver.lat, longitude: driver.lng };
            return (
              <DriverMarker
                key={driver.id}
                id={driver.id}
                coordinate={coordinate}
                isAssigned={isAssigned}
              />
            );
          })}

        {/* Pickup Marker (driver) */}
        {showPickupMarker && tripPickup && (
          <LocationMarker
            coordinate={{ latitude: tripPickup.lat, longitude: tripPickup.lng }}
            address={tripPickup.address}
            type="pickup"
          />
        )}

        {/* Dropoff Marker */}
        {showDropoffMarker && tripDropoff && (
          <LocationMarker
            coordinate={{ latitude: tripDropoff.lat, longitude: tripDropoff.lng }}
            address={tripDropoff.address}
            type="dropoff"
          />
        )}

        {/* Chosen dropoff preview (rider, confirming) */}
        {showConfirmDropoff && dropoffLocation && (
          <LocationMarker
            coordinate={{ latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }}
            address={dropoffLocation.formattedAddress}
            type="dropoff"
          />
        )}

        {/* Route */}
        {showRoute && routeOrigin && routeDestination && (
          directionsFailed ? (
            <Polyline
              coordinates={[routeOrigin, routeDestination]}
              strokeWidth={5}
              strokeColor={colors.navy}
              lineDashPattern={[2, 6]}
            />
          ) : (
            <MapDirections
              origin={routeOrigin}
              destination={routeDestination}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={5}
              strokeColor={colors.navy}
              onReady={handleDirectionsReady}
              onError={handleDirectionsError}
            />
          )
        )}
      </MapView>

      {/* ═══ Top HUD: frosted-glass role badge + error toast (Phase 18) ═══ */}
      <SafeAreaView style={styles.hudTop} pointerEvents="box-none" edges={['top']}>
        <GlassCard rounded={radius.pill} padding={0}>
          <View style={styles.roleBadge}>
            <Ionicons name={roleIcon} size={19} color={accentColor} />
            <Text style={[styles.badgeText, { color: accentColor }]}>{roleLabel}</Text>
          </View>
        </GlassCard>

        {errorMessage && (
          <View style={styles.errorToast}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
            <Text style={styles.errorToastText}>{errorMessage}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ═══ TEMP Debug overlay — GPS + socket diagnostics ═══ */}
      {SHOW_DEBUG && (
        <View style={[styles.debugBox, { top: insets.top + 60 }]} pointerEvents="box-none">
          <Text style={styles.debugTitle}>🐞 DEBUG · {String(role).toUpperCase()}</Text>
          <Text style={styles.debugLine}>
            Lat: {userLocation ? userLocation.latitude.toFixed(6) : '—'}
          </Text>
          <Text style={styles.debugLine}>
            Lng: {userLocation ? userLocation.longitude.toFixed(6) : '—'}
          </Text>
          <Text style={[styles.debugLine, { color: socketConnected ? '#34D399' : '#F87171' }]}>
            socket: {socketConnected ? '● CONNECTED' : '○ DISCONNECTED'}
          </Text>
          <Text style={styles.debugLine} numberOfLines={1}>
            backend: {getSocketUrl().replace(/^https?:\/\//, '')}
          </Text>
          <Text style={styles.debugLine}>
            drivers seen: {nearbyDrivers.length}
          </Text>
          {tripStatus === 'IN_PROGRESS' && tripProgress < 100 && (
            <PressableScale
              onPress={() => {
                setTripProgress(100);
                setRemainingDistanceKm(0);
                setRemainingDurationMin(0);
              }}
              style={{ marginTop: 8, padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, alignItems: 'center' }}
            >
              <Text style={styles.debugLine}>Fast Forward ⏩</Text>
            </PressableScale>
          )}
        </View>
      )}

      {/* ═══ Idle History button (top-right, frosted glass — Phase 18) ═══ */}
      {tripStatus === 'IDLE' && permissionStatus !== 'denied' && (
        <PressableScale
          onPress={handleOpenHistory}
          style={[styles.historyBtn, { top: insets.top + 8 }]}
          hitSlop={10}
          pressedScale={0.9}
          accessibilityLabel={role === 'driver' ? 'View earnings dashboard' : 'View ride history'}
        >
          <GlassCard rounded={22} padding={0}>
            <View style={styles.historyBtnInner}>
              <Ionicons
                name={role === 'driver' ? 'wallet-outline' : 'time-outline'}
                size={22}
                color={accentColor}
              />
            </View>
          </GlassCard>
        </PressableScale>
      )}

      {/* ═══ Permission Denied Overlay ═══ */}
      {permissionStatus === 'denied' && (
        <View style={styles.permissionOverlay} pointerEvents="box-none">
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="location-outline" size={28} color={accentColor} />
            </View>
            <Text style={styles.permissionTitle}>Location Access Required</Text>
            <Text style={styles.permissionMessage}>
              RideShare needs your location to show your position and match you with nearby rides.
            </Text>
            <Pressable style={styles.settingsButton} onPress={openSettings}>
              <Text style={[styles.settingsText, { color: accentColor }]}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ═══ Map dim/blur overlay — recedes the map as the sheet expands ═══ */}
      {permissionStatus !== 'denied' && (
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.mapDim, dimStyle]}
        >
          {/* Optimization: only render BlurView when the sheet is expanded enough to cast a blur */}
          {sheetPosition.value < windowHeight * 0.72 ? (
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
          ) : null}
        </Reanimated.View>
      )}

      {/* ═══ Bottom Sheet ═══ */}
      {permissionStatus !== 'denied' && (
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={sheetSnapPoints}
          animatedPosition={sheetPosition}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose={false}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          topInset={insets.top + 8}
          bottomInset={insets.bottom}
          handleIndicatorStyle={styles.sheetIndicator}
          backgroundStyle={styles.sheetBackground}
        >
          <BottomSheetView style={{ paddingBottom: insets.bottom + 12 }}>
            <Reanimated.View key={`${role}-${tripStatus}`} entering={FadeInDown.duration(260)}>
            {role === 'rider' ? (
              <RiderBottomSheet
                status={tripStatus}
                assignedDriver={assignedDriver}
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                routeInfo={routeInfo}
                pickupMode={pickupMode}
                bookingFor={bookingFor}
                counterpartyPhone={counterpartyPhone}
                authorizing={authorizingPayment}
                nearbyCount={nearbyDrivers.length}
                eta={routeInfo?.durationMin ?? (tripStatus === 'ACCEPTED' ? 5 : null)}
                receipt={receipt}
                arrivedAt={arrivedAt}
                verificationState={verificationState}
                otp={verificationCode}
                otpError={otpError}
                tripProgress={tripProgress}
                remainingDistanceKm={remainingDistanceKm}
                remainingDurationMin={remainingDurationMin}
                tripSummary={tripSummary}
                onSelectDestination={handleSelectDestination}
                onSelectPickup={handleSelectPickup}
                onUseCurrentPickup={handleUseCurrentPickup}
                onChoosePickupCustom={handleChoosePickupCustom}
                onChangeBookingFor={handleChangeBookingFor}
                onConfirmRide={handleConfirmRide}
                onChangeDestination={handleChangeDestination}
                onFocusSearch={handleFocusSearch}
                onOpenMap={handleOpenMap}
                onCallCounterparty={handleCallCounterparty}
                onCancelSearch={handleCancelSearch}
                onCancelTrip={handleCancelTrip}
                onAcknowledgeArrival={handleAcknowledgeArrival}
                onPassengerAtVehicle={handlePassengerAtVehicle}
                onSubmitRating={handleSubmitRating}
                onSignOut={handleLogout}
              />
            ) : (
              <DriverBottomSheet
                status={tripStatus}
                pendingOffer={pendingOffer}
                receipt={receipt}
                counterpartyPhone={counterpartyPhone}
                isThirdParty={counterpartyIsThirdParty}
                eta={routeInfo?.durationMin ?? null}
                arrivedAt={arrivedAt}
                verificationState={verificationState}
                otpError={otpError}
                tripProgress={tripProgress}
                remainingDistanceKm={remainingDistanceKm}
                remainingDurationMin={remainingDurationMin}
                tripSummary={tripSummary}
                onAccept={handleAcceptOffer}
                onDecline={handleDeclineOffer}
                onAdvanceStatus={handleDriverStatusUpdate}
                onCallRider={handleCallCounterparty}
                onEnterOTP={handleDriverEnterOTP}
                onVerifyOTP={handleVerifyOTP}
                onSubmitRating={handleSubmitRating}
                onSignOut={handleLogout}
              />
            )}
            </Reanimated.View>
          </BottomSheetView>
        </BottomSheet>
      )}

      {/* Loading overlay while fetching location */}
      {isTracking && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={styles.loadingText}>Finding your location...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top HUD
  hudTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
    gap: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  badgeText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // TEMP debug overlay
  debugBox: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
    maxWidth: 240,
    zIndex: 999,
  },
  debugTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  debugLine: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Idle History button (top-right, frosted glass)
  historyBtn: {
    position: 'absolute',
    right: 16,
  },
  historyBtnInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error Toast
  errorToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: withAlpha(colors.danger, 0x33),
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0x66),
  },
  errorToastText: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },

  // Bottom Sheet chrome
  sheetBackground: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetIndicator: {
    backgroundColor: colors.hairlineStrong,
    width: 44,
  },
  // Frosted scrim that fades the map as the sheet expands (premium focus).
  mapDim: {
    backgroundColor: withAlpha(colors.background, 0x59),
  },

  // User Marker
  markerContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1 },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  markerInner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },

  // Driver Marker — navy car chip; the assigned car earns the gold ring (Phase 18)
  driverMarkerContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  driverMarkerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverMarkerAssigned: {
    borderColor: colors.gold,
    borderWidth: 3,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
  },

  // Floating location tag — white card above the pin with the address (Phase 19)
  markerLabel: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 5,
    maxWidth: 170,
    boxShadow: elevationShadows.raised,
  },
  markerLabelText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.navy,
  },

  // Pickup (navy person) / Dropoff (gold flag) pins
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinStem: { width: 3, height: 10, marginTop: -1, borderRadius: 2 },

  // Permission Denied
  permissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: withAlpha(colors.surface, 0xf0),
    borderRadius: radius.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
    maxWidth: 360,
  },
  permissionIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: withAlpha(colors.rider, 0x12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary },
  permissionMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  settingsButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.hairline,
  },
  settingsText: { fontSize: 15, fontFamily: fonts.semibold },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.background, 0xaa),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 16, color: colors.textSecondary },
});
