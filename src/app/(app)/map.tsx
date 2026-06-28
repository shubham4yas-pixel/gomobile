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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
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
import { useRideStore, RideStatus, LocatedPlace, BookingFor } from '@/store/useRideStore';
import { colors, radius, withAlpha, shadows } from '@/theme/theme';
import { LIGHT_MAP_STYLE } from '@/config/mapStyle';
import { haptics } from '@/lib/haptics';
import { RiderBottomSheet } from '@/components/sheets/RiderBottomSheet';
import { DriverBottomSheet } from '@/components/sheets/DriverBottomSheet';
import { useAnimatedCoordinate } from '@/hooks/useAnimatedCoordinate';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';
import { isValidPhone, normalizePhone } from '@/components/ui/PhoneInput';
import {
  requestLocationPermission,
  getCurrentPosition,
  watchPosition,
} from '@/services/locationService';
import { reverseGeocode } from '@/services/geocoding';
import { registerForPushNotifications, addForegroundListener } from '@/services/pushService';
import {
  connectSocket,
  disconnectSocket,
  emitLocation,
  emitTripRequest,
  emitTripCancel,
  emitTripAccept,
  emitTripReject,
  emitTripStatusUpdate,
  emitSubmitRating,
  emitRegisterPushToken,
  onTripEvent,
} from '@/services/socketService';

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

type Coord = { latitude: number; longitude: number };

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

  // Phase 13: native payment sheet + in-flight authorization flag.
  const { pay } = usePaymentSheet();
  const [authorizingPayment, setAuthorizingPayment] = useState(false);

  const router = useRouter();

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sheetRef = useRef<BottomSheet>(null);
  const userIdRef = useRef<string>(''); // the userId used for the live socket (for rating submit)
  // Driver: first pickup→dropoff driving metrics captured at ride start (Phase 11).
  const drivenRouteRef = useRef<{ distanceKm: number; durationMin: number } | null>(null);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const accentColor = role === 'rider' ? colors.rider : colors.driver;
  const roleEmoji = role === 'rider' ? '🚘' : '🛣️';
  const roleLabel = role ?? 'User';

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
          console.warn('Could not remove location subscription:', e);
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

  // ─── Socket Connection + Trip Event Listeners ───────────────────────────
  useEffect(() => {
    const userId = useAuthStore.getState().user?.uid || `dev-${role}-${Date.now()}`;
    const phone = useAuthStore.getState().phone;
    userIdRef.current = userId;
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
      }
    })();
    // Surface foreground pushes (the OS shows them, but log for debugging).
    pushUnsub = addForegroundListener((n) =>
      console.log('[Push] Foreground notification:', n.request.content.title)
    );

    const unsubs: (() => void)[] = [];

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
        setErrorMessage('No drivers available nearby. Please try again.');
        setTimeout(() => setErrorMessage(null), 4000);
      })
    );

    unsubs.push(
      onTripEvent('trip:cancelled', () => {
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
        setErrorMessage(data.message);
        setTimeout(() => setErrorMessage(null), 4000);
      })
    );

    return () => {
      unsubs.forEach((fn) => fn());
      if (pushUnsub) pushUnsub();
      disconnectSocket();
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
  ]);

  // ─── Driver GPS Emit ────────────────────────────────────────────────────
  useEffect(() => {
    if (role !== 'driver') return;

    if (userLocation) {
      emitLocation(userLocation.latitude, userLocation.longitude);
    }

    const interval = setInterval(() => {
      const currentLoc = useLocationStore.getState().userLocation;
      if (currentLoc) emitLocation(currentLoc.latitude, currentLoc.longitude);
    }, 10000);

    return () => clearInterval(interval);
  }, [userLocation, role]);

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
    }
  }, [tripStatus]);

  // ─── Trip Actions ───────────────────────────────────────────────────────
  const handleOpenMap = useCallback(() => {
    router.push('/destination');
  }, [router]);

  const handleOpenHistory = useCallback(() => {
    haptics.selection();
    router.push('/history');
  }, [router]);

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
    sheetRef.current?.expand();
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
      setErrorMessage("Enter the rider's phone number, or turn off third-party booking.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    // Convert the LocatedPlace display objects to the {lat,lng} socket wire format.
    const pickup = pickupLocation
      ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
      : { lat: userLocation.latitude, lng: userLocation.longitude };
    const dropoff = { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude };
    const normalizedBooking: BookingFor = bookingFor.isThirdParty
      ? { isThirdParty: true, riderPhoneNumber: normalizePhone(bookingFor.riderPhoneNumber ?? '') }
      : { isThirdParty: false, riderPhoneNumber: null };

    // Authorize the estimated fare (escrow hold) before broadcasting the ride.
    const fareEstimate = routeInfo
      ? Math.round((BASE_FARE + routeInfo.distanceKm * PER_KM_RATE) * 100) / 100
      : BASE_FARE;

    // ── DEV BYPASS: skip Razorpay payment for testing ──────────────────
    // TODO: Remove this bypass and restore the real pay() call before production.
    // setAuthorizingPayment(true);
    // const result = await pay({
    //   amount: fareEstimate,
    //   currency: 'USD',
    //   userId: userIdRef.current,
    //   description: 'RideShare fare authorization',
    //   contact: useAuthStore.getState().phone,
    // });
    // setAuthorizingPayment(false);
    //
    // if (!result.ok) {
    //   haptics.heavy();
    //   setErrorMessage(
    //     'Payment authorization failed. Please update your payment method to request a ride.'
    //   );
    //   setTimeout(() => setErrorMessage(null), 6000);
    //   return;
    // }
    const result = { ok: true, payment: { id: 'dev_bypass', amount: fareEstimate, currency: 'USD' } };
    // ── END DEV BYPASS ───────────────────────────────────────────────────

    haptics.medium();
    setTripRoute(pickup, dropoff);
    emitTripRequest(
      pickup,
      dropoff,
      routeInfo ? { distanceKm: routeInfo.distanceKm, durationMin: routeInfo.durationMin } : undefined,
      normalizedBooking,
      result.payment ?? undefined
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
    setErrorMessage,
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

  const openSettings = () => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  };

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

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
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
            <Marker
              coordinate={{
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              draggable={tripStatus === 'IDLE'}
              onDragEnd={(e: any) => handlePickupDragEnd(e.nativeEvent.coordinate)}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pin, { backgroundColor: colors.rider }]}>
                  <Text style={styles.pinGlyph}>👤</Text>
                </View>
                <View style={[styles.pinStem, { backgroundColor: colors.rider }]} />
              </View>
            </Marker>
          )}

        {/* Nearby Drivers (Rider Only) */}
        {role === 'rider' &&
          nearbyDrivers.map((driver) => {
            const isAssigned = assignedDriver?.id === driver.id;
            // The assigned driver glides via the interpolation hook (Phase 12);
            // unmatched drivers plot at their raw broadcast position.
            const coordinate =
              isAssigned && animatedDriverCoord
                ? animatedDriverCoord
                : { latitude: driver.lat, longitude: driver.lng };
            return (
              <Marker
                key={driver.id}
                coordinate={coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.driverMarkerContainer}>
                  <View style={[styles.driverMarkerDot, isAssigned && styles.driverMarkerAssigned]}>
                    <Text style={styles.driverMarkerEmoji}>🚗</Text>
                  </View>
                </View>
              </Marker>
            );
          })}

        {/* Pickup Marker (driver) */}
        {showPickupMarker && tripPickup && (
          <Marker coordinate={{ latitude: tripPickup.lat, longitude: tripPickup.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pinWrap}>
              <View style={[styles.pin, { backgroundColor: colors.rider }]}>
                <Text style={styles.pinGlyph}>👤</Text>
              </View>
              <View style={[styles.pinStem, { backgroundColor: colors.rider }]} />
            </View>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {showDropoffMarker && tripDropoff && (
          <Marker coordinate={{ latitude: tripDropoff.lat, longitude: tripDropoff.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pinWrap}>
              <View style={[styles.pin, { backgroundColor: colors.success }]}>
                <Text style={styles.pinGlyph}>🏁</Text>
              </View>
              <View style={[styles.pinStem, { backgroundColor: colors.success }]} />
            </View>
          </Marker>
        )}

        {/* Chosen dropoff preview (rider, confirming) */}
        {showConfirmDropoff && dropoffLocation && (
          <Marker
            coordinate={{ latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinWrap}>
              <View style={[styles.pin, { backgroundColor: colors.rider }]}>
                <Text style={styles.pinGlyph}>🏁</Text>
              </View>
              <View style={[styles.pinStem, { backgroundColor: colors.rider }]} />
            </View>
          </Marker>
        )}

        {/* Route */}
        {showRoute && routeOrigin && routeDestination && (
          directionsFailed ? (
            <Polyline
              coordinates={[routeOrigin, routeDestination]}
              strokeWidth={5}
              strokeColor={accentColor}
              lineDashPattern={[2, 6]}
            />
          ) : (
            <MapDirections
              origin={routeOrigin}
              destination={routeDestination}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={6}
              strokeColor={accentColor}
              onReady={(result: any) => {
                // Guard against a malformed Directions payload (graceful degradation).
                if (result?.coordinates) fitToRoute(result.coordinates);
                const distanceKm = Math.round((result?.distance ?? 0) * 100) / 100;
                const durationMin = Math.max(1, Math.round(result?.duration ?? 0));
                // Rider reviewing → drive the fare estimate from the real route.
                if (riderConfirming && distanceKm > 0) {
                  setRouteInfo({ distanceKm, durationMin });
                }
                // Driver at ride start → capture the canonical trip distance once
                // (driver ≈ pickup), passed to the server at completion for the fare.
                if (
                  role === 'driver' &&
                  tripStatus === 'IN_PROGRESS' &&
                  !drivenRouteRef.current &&
                  distanceKm > 0
                ) {
                  drivenRouteRef.current = { distanceKm, durationMin };
                }
              }}
              onError={() => {
                setDirectionsFailed(true);
                if (routeOrigin && routeDestination) {
                  fitToRoute([routeOrigin, routeDestination]);
                }
              }}
            />
          )
        )}
      </MapView>

      {/* ═══ Top HUD: role badge + error toast ═══ */}
      <SafeAreaView style={styles.hudTop} pointerEvents="box-none" edges={['top']}>
        <View style={[styles.roleBadge, { backgroundColor: withAlpha(colors.background, 0xcc) }]}>
          <Text style={styles.badgeEmoji}>{roleEmoji}</Text>
          <Text style={[styles.badgeText, { color: accentColor }]}>{roleLabel}</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorToast}>
            <Text style={styles.errorToastText}>⚠️ {errorMessage}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ═══ Idle History button (top-right, premium) ═══ */}
      {tripStatus === 'IDLE' && permissionStatus !== 'denied' && (
        <Pressable
          onPress={handleOpenHistory}
          style={[styles.historyBtn, { top: insets.top + 8 }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="View ride history"
        >
          <Ionicons name="time-outline" size={22} color={accentColor} />
        </Pressable>
      )}

      {/* ═══ Permission Denied Overlay ═══ */}
      {permissionStatus === 'denied' && (
        <View style={styles.permissionOverlay} pointerEvents="box-none">
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>📍</Text>
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

      {/* ═══ Bottom Sheet ═══ */}
      {permissionStatus !== 'denied' && (
        <BottomSheet
          ref={sheetRef}
          index={0}
          enableDynamicSizing
          enablePanDownToClose={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
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
                eta={tripStatus === 'ACCEPTED' ? 'On the way' : null}
                receipt={receipt}
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
                onAccept={handleAcceptOffer}
                onDecline={handleDeclineOffer}
                onAdvanceStatus={handleDriverStatusUpdate}
                onCallRider={handleCallCounterparty}
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
    borderRadius: radius.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  badgeEmoji: { fontSize: 20 },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Idle History button (top-right)
  historyBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.surface, 0xf0),
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },

  // Error Toast
  errorToast: {
    marginHorizontal: 20,
    backgroundColor: withAlpha(colors.danger, 0x33),
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0x66),
  },
  errorToastText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
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

  // Driver Marker
  driverMarkerContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  driverMarkerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.driver,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.driver,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  driverMarkerAssigned: { borderColor: colors.success, borderWidth: 3, shadowColor: colors.success },
  driverMarkerEmoji: { fontSize: 16 },

  // Pickup / Dropoff pins
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  pinGlyph: { fontSize: 16 },
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
  permissionIcon: { fontSize: 32 },
  permissionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  permissionMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  settingsButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.hairline,
  },
  settingsText: { fontSize: 15, fontWeight: '600' },

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
