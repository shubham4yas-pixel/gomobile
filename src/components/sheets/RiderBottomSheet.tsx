import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { RideStatus, LocatedPlace, RouteInfo, Receipt, PickupMode, BookingFor } from '@/store/useRideStore';
import { getDriverProfile } from '@/lib/driverProfile';
import { colors, radius, withAlpha, fonts, type, spacing, elevationShadows } from '@/theme/theme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DestinationSearch } from '@/components/ui/DestinationSearch';
import { PickupSelector } from '@/components/ui/PickupSelector';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SearchingRadar } from '@/components/trip/SearchingRadar';
import { DriverProfileCard } from '@/components/trip/DriverProfileCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { RiderPaymentSheet } from '@/components/trip/RiderPaymentSheet';
import { RiderReceiptCard, buildRiderReceipt } from '@/components/trip/RiderReceiptCard';
import { RiderRatingCard } from '@/components/trip/RiderRatingCard';
import { TripProgressIndicator } from '@/components/trip/TripProgressIndicator';
import { RatingService } from '@/services/ratingService';
import { useAuthStore } from '@/store/useAuthStore';
import { type TripSummary } from '@/store/useRideStore';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BASE_FARE } from '@/utils/constants';
import { calculateFareEstimate, getGreeting, getContextualSubtitle } from '@/utils/helpers';

interface RiderBottomSheetProps {
  status: RideStatus;
  assignedDriver: { id: string; lat: number; lng: number } | null;
  pickupLocation: LocatedPlace | null;
  dropoffLocation: LocatedPlace | null;
  routeInfo: RouteInfo | null;
  pickupMode: PickupMode;
  bookingFor: BookingFor;
  counterpartyPhone: string | null;
  /** Phase 13: payment authorization is in flight (disables Confirm). */
  authorizing?: boolean;
  nearbyCount: number;
  eta?: number | null;
  arrivedAt?: number | null;
  verificationState?: 'WAITING_FOR_PASSENGER' | 'PASSENGER_APPROACHING' | 'PASSENGER_READY' | 'OTP_PENDING' | 'OTP_VERIFIED' | 'READY_TO_START';
  otp?: string | null;
  otpError?: string | null;
  tripProgress?: number;
  remainingDistanceKm?: number | null;
  remainingDurationMin?: number | null;
  tripSummary?: TripSummary | null;
  receipt: Receipt | null;
  onSelectDestination: (place: LocatedPlace) => void;
  onSelectPickup: (place: LocatedPlace) => void;
  onUseCurrentPickup: () => void;
  onChoosePickupCustom: () => void;
  onChangeBookingFor: (booking: BookingFor) => void;
  onConfirmRide: () => void;
  onChangeDestination: () => void;
  onFocusSearch?: () => void;
  onOpenMap?: () => void;
  onCallCounterparty: () => void;
  onCancelSearch: () => void;
  onCancelTrip: () => void;
  onAcknowledgeArrival?: () => void;
  onPassengerAtVehicle?: () => void;
  onSubmitRating: (rating: number) => void;
  onSignOut: () => void;
}

const ACCENT = colors.rider;

const RIDE_TIERS = [
  { id: 'standard', name: 'Standard', multiplier: 1.0, capacity: '4', tag: 'Best Value', icon: 'car-outline' as const },
  { id: 'premium', name: 'Premium', multiplier: 1.4, capacity: '4', tag: 'Fastest', icon: 'car-sport-outline' as const },
  { id: 'xl', name: 'XL', multiplier: 1.8, capacity: '6', tag: 'More Space', icon: 'bus-outline' as const },
];

/**
 * Animated wrapper (Phase 18): `key={status}` remounts the content on every
 * ride-state transition, so each state slides in with a soft spring — the
 * whole flow feels alive without animating any individual screen by hand.
 */
export function RiderBottomSheet(props: RiderBottomSheetProps) {
  // Group SEARCHING and ACCEPTED so they animate smoothly instead of unmounting
  const layoutKey = (props.status === 'SEARCHING' || props.status === 'ACCEPTED')
    ? 'MATCH_GROUP'
    : props.status;

  return (
    <Animated.View
      key={layoutKey}
      entering={FadeInDown.springify().damping(19).stiffness(220).mass(0.9)}
      layout={LinearTransition.springify().damping(20).stiffness(200)}
    >
      <RiderSheetContent {...props} />
    </Animated.View>
  );
}

function RiderSheetContent({
  status,
  assignedDriver,
  pickupLocation,
  dropoffLocation,
  routeInfo,
  pickupMode,
  bookingFor,
  counterpartyPhone,
  authorizing,
  nearbyCount,
  eta,
  arrivedAt,
  verificationState,
  otp,
  otpError,
  tripProgress = 0,
  remainingDistanceKm = null,
  remainingDurationMin = null,
  tripSummary = null,
  receipt,
  onSelectDestination,
  onSelectPickup,
  onUseCurrentPickup,
  onChoosePickupCustom,
  onChangeBookingFor,
  onConfirmRide,
  onChangeDestination,
  onFocusSearch,
  onOpenMap,
  onCallCounterparty,
  onCancelSearch,
  onCancelTrip,
  onAcknowledgeArrival,
  onPassengerAtVehicle,
  onSubmitRating,
  onSignOut,
}: RiderBottomSheetProps) {
  // Post-trip state machine: RECEIPT -> RATING -> SUCCESS -> DONE
  type PostTripState = 'RECEIPT' | 'RATING' | 'SUCCESS' | 'DONE';
  const [postTripState, setPostTripState] = useState<PostTripState>('RECEIPT');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Fallback to idle when unmounted or status changes back
  useEffect(() => {
    if (status !== 'COMPLETED') {
      setIsPaymentCompleted(false);
      setPostTripState('RECEIPT');
    }
  }, [status]);

  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const userName = useAuthStore((s) => s.user?.displayName);
  const [selectedTier, setSelectedTier] = useState<string>('standard');

  // ── IDLE ────────────────────────────────────────────────────────────────
  if (status === 'IDLE') {
    const thirdParty = bookingFor.isThirdParty;
    const firstName = userName?.split(' ')[0] ?? null;

    return (
      <BottomSheetScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: Dynamic greeting + context ── */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <View style={styles.idleHeader}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>{getGreeting(firstName)}</Text>
              <Text style={styles.subtitle}>{getContextualSubtitle()}</Text>
            </View>
            <View style={[styles.nearbyChip, nearbyCount === 0 && styles.nearbyChipMuted]}>
              <View
                style={[
                  styles.nearbyDot,
                  { backgroundColor: nearbyCount > 0 ? colors.success : colors.textMuted },
                ]}
              />
              <Text style={styles.nearbyText}>
                {nearbyCount > 0
                  ? `${nearbyCount} driver${nearbyCount > 1 ? 's' : ''} · ~2 min`
                  : 'Connecting…'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Quick Destinations ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(60)}>
          <View style={styles.quickRow}>
            <PressableScale onPress={onFocusSearch} style={styles.quickPill} haptic="light" pressedScale={0.95}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="home-outline" size={20} color={ACCENT} />
              </View>
              <Text style={styles.quickLabel}>Home</Text>
              <Text style={styles.quickSub}>Set</Text>
            </PressableScale>
            <PressableScale onPress={onFocusSearch} style={styles.quickPill} haptic="light" pressedScale={0.95}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="business-outline" size={20} color={ACCENT} />
              </View>
              <Text style={styles.quickLabel}>Work</Text>
              <Text style={styles.quickSub}>Set</Text>
            </PressableScale>
            <PressableScale onPress={onFocusSearch} style={styles.quickPill} haptic="light" pressedScale={0.95}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="time-outline" size={20} color={ACCENT} />
              </View>
              <Text style={styles.quickLabel}>Recent</Text>
              <Text style={styles.quickSub}>Search</Text>
            </PressableScale>
          </View>
        </Animated.View>

        {/* ── Where to? ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(120)} style={styles.section}>
          <Text style={styles.sectionLabel}>Where to?</Text>
          <DestinationSearch onSelected={onSelectDestination} onFocus={onFocusSearch} />
        </Animated.View>

        {/* ── Pickup ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(180)} style={styles.section}>
          <PickupSelector
            mode={pickupMode}
            pickupLocation={pickupLocation}
            onUseCurrent={onUseCurrentPickup}
            onChooseCustom={onChoosePickupCustom}
            onSelectPickup={onSelectPickup}
            onFocusSearch={onFocusSearch}
          />
          {onOpenMap ? (
            <PressableScale onPress={onOpenMap} style={styles.mapLink} hitSlop={8} haptic="light">
              <View style={styles.mapLinkRow}>
                <Ionicons name="map-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.mapLinkText}>Set location on the map</Text>
              </View>
            </PressableScale>
          ) : null}
        </Animated.View>

        {/* ── Options ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(240)} style={styles.section}>
          <Text style={styles.sectionLabel}>Options</Text>
          <View style={styles.bookingForCard}>
            <View style={styles.bookingForRow}>
              <Text style={styles.bookingForLabel}>Booking for someone else?</Text>
              <Switch
                value={thirdParty}
                onValueChange={(on) =>
                  onChangeBookingFor({
                    isThirdParty: on,
                    riderPhoneNumber: on ? bookingFor.riderPhoneNumber ?? '' : null,
                  })
                }
                trackColor={{ false: colors.hairlineStrong, true: withAlpha(ACCENT, 0x99) }}
                thumbColor={thirdParty ? ACCENT : colors.surface}
              />
            </View>
            {thirdParty ? (
              <PhoneInput
                inSheet
                accent={ACCENT}
                label="Rider's phone number"
                value={bookingFor.riderPhoneNumber ?? ''}
                onChangeText={(text) =>
                  onChangeBookingFor({ isThirdParty: true, riderPhoneNumber: text })
                }
              />
            ) : null}
          </View>
        </Animated.View>

        {/* ── Sign out (minimal, bottom) ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(300)}>
          <PressableScale onPress={onSignOut} style={styles.signOutBtn} haptic="light">
            <Text style={styles.signOutText}>Sign Out</Text>
          </PressableScale>
        </Animated.View>
      </BottomSheetScrollView>
    );
  }

  // ── CONFIRMING — review route + fare, then request a ride ──────────────────
  if (status === 'CONFIRMING') {
    const baseEstimate = routeInfo ? calculateFareEstimate(routeInfo.distanceKm) : BASE_FARE;
    const selectedOption = RIDE_TIERS.find(t => t.id === selectedTier) ?? RIDE_TIERS[0];

    return (
      <BottomSheetScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.confirmTitle}>Choose a ride</Text>

        {bookingFor.isThirdParty && bookingFor.riderPhoneNumber ? (
          <View style={styles.thirdPartyChip}>
            <Ionicons name="people-outline" size={14} color={ACCENT} />
            <Text style={styles.thirdPartyChipText}>
              Booking for {bookingFor.riderPhoneNumber}
            </Text>
          </View>
        ) : null}

        <View style={styles.routePreview}>
          <View style={styles.routeRail}>
            <View style={styles.railDotOrigin} />
            <View style={styles.railLine} />
            <View style={styles.railDotDest} />
          </View>
          <View style={styles.routeLabels}>
            <Text style={styles.routeFrom} numberOfLines={1}>
              {pickupLocation?.formattedAddress ?? 'Current location'}
            </Text>
            <View style={styles.routeSep} />
            <Text style={styles.routeTo} numberOfLines={1}>
              {dropoffLocation?.formattedAddress ?? 'Destination'}
            </Text>
          </View>
        </View>

        <View style={styles.tiersContainer}>
          {baseEstimate == null ? (
            <View style={styles.estimateCalc}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.estimateCalcText}>Calculating route &amp; fare…</Text>
            </View>
          ) : (
            RIDE_TIERS.map((tier, index) => {
              const isSelected = selectedTier === tier.id;
              const fare = (baseEstimate * tier.multiplier).toFixed(2);
              const etaMinutes = routeInfo ? routeInfo.durationMin : 0;
              // Mock faster ETA for premium
              const etaOffset = tier.id === 'premium' ? -2 : 0;
              const finalEta = Math.max(1, etaMinutes + etaOffset);

              return (
                <Animated.View key={tier.id} entering={FadeInDown.delay(index * 60).duration(350)}>
                  <PressableScale
                    onPress={() => setSelectedTier(tier.id)}
                    style={[
                      styles.tierCard,
                      isSelected && styles.tierCardSelected
                    ]}
                    haptic="light"
                    pressedScale={0.97}
                  >
                    <View style={styles.tierIconWrap}>
                      <Ionicons name={tier.icon} size={30} color={isSelected ? ACCENT : colors.textSecondary} />
                    </View>
                    <View style={styles.tierInfo}>
                      <View style={styles.tierHeader}>
                        <Text style={styles.tierName}>{tier.name}</Text>
                        <View style={styles.tierCapacityPill}>
                          <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.tierCapacity}>{tier.capacity}</Text>
                        </View>
                      </View>
                      <Text style={styles.tierEta}>{finalEta} min away</Text>
                    </View>
                    <View style={styles.tierPriceCol}>
                      <Text style={styles.tierPrice}>₹{fare}</Text>
                      {tier.tag ? (
                        <View style={[styles.tierTag, isSelected && styles.tierTagSelected]}>
                          <Text style={[styles.tierTagText, isSelected && styles.tierTagTextSelected]}>{tier.tag}</Text>
                        </View>
                      ) : null}
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })
          )}
        </View>

        <PrimaryButton
          label={`Confirm ${selectedOption.name}`}
          icon="→"
          variant="accent"
          accent={ACCENT}
          loading={authorizing}
          onPress={onConfirmRide}
          style={{ marginTop: spacing.md }}
        />
        <PressableScale onPress={onChangeDestination} style={styles.textBtn} disabled={authorizing} haptic="light">
          <Text style={styles.changeDestText}>Change destination</Text>
        </PressableScale>
      </BottomSheetScrollView>
    );
  }

  // ── SEARCHING ───────────────────────────────────────────────────────────
  if (status === 'SEARCHING') {
    return <SearchingStateContent onCancel={onCancelSearch} />;
  }

  // ── COMPLETED — Receipt & Rating ──────────────────────────────────────────
  if (status === 'COMPLETED') {
    if (!isPaymentCompleted && tripSummary) {
      return (
        <RiderPaymentSheet
          tripSummary={tripSummary}
          onPaymentComplete={() => setIsPaymentCompleted(true)}
        />
      );
    }
    // Post-payment → the dedicated, data-driven digital receipt
    const receiptData = buildRiderReceipt({
      summary: tripSummary,
      receipt,
      driver: assignedDriver ? getDriverProfile(assignedDriver.id) : null,
      pickupAddress: pickupLocation?.formattedAddress,
      dropoffAddress: dropoffLocation?.formattedAddress,
    });
    if (!receiptData) {
      return (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.searchSub}>Generating your receipt…</Text>
        </View>
      );
    }

    if (postTripState === 'RECEIPT') {
      return <RiderReceiptCard summary={receiptData} onDone={() => setPostTripState('RATING')} />;
    }

    if (postTripState === 'RATING') {
      return (
        <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {isSubmittingRating ? (
            <View style={[styles.container, styles.centered]}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.searchSub}>Submitting feedback…</Text>
            </View>
          ) : (
            <RiderRatingCard
              tripId={tripSummary?.tripId ?? receipt?.tripId ?? 'pending-trip'}
              driver={assignedDriver ? getDriverProfile(assignedDriver.id) : null}
              onSubmit={async (payload) => {
                setIsSubmittingRating(true);
                await RatingService.submitRating(payload);
                setIsSubmittingRating(false);
                setPostTripState('SUCCESS');
              }}
            />
          )}
        </BottomSheetScrollView>
      );
    }

    if (postTripState === 'SUCCESS') {
      return (
        <BottomSheetScrollView contentContainerStyle={[styles.container, styles.centered, { padding: 32 }]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(600)} style={{ marginBottom: 24 }}>
            <View style={styles.doneIconWrap}>
              <Ionicons name="checkmark" size={44} color={colors.white} />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(200)} style={[styles.greeting, { textAlign: 'center', marginBottom: 12 }]}>
            Thank you!
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(300)} style={[styles.searchSub, { textAlign: 'center', marginBottom: 32 }]}>
            Your feedback helps improve the community.
          </Animated.Text>
          <Animated.View entering={FadeIn.delay(400)} style={{ width: '100%' }}>
            <PrimaryButton label="Done" onPress={() => onSubmitRating(5)} />
          </Animated.View>
        </BottomSheetScrollView>
      );
    }
  }

  // ── ACTIVE TRIP (ACCEPTED / ARRIVED / IN_PROGRESS) ────────────────────────

  // 1. Derive presentation state (handles ARRIVING before backend geofence).
  //    'ARRIVING' is a presentation-only pseudo-status, not a real RideStatus.
  let presentationState: RideStatus | 'ARRIVING' = status;
  if (status === 'ACCEPTED' && eta != null && eta <= 1) {
    presentationState = 'ARRIVING';
  }

  if (presentationState === 'ACCEPTED') {
    return (
      <RiderActiveTripCard
        profile={getDriverProfile(assignedDriver?.id)}
        counterpartyPhone={counterpartyPhone}
        title={eta != null && eta > 1 ? `Driver is ${eta} mins away` : 'Driver is on the way'}
        tripProgress={tripProgress}
        remainingDistanceKm={remainingDistanceKm}
        remainingDurationMin={eta ?? remainingDurationMin}
        onCallDriver={onCallCounterparty}
      />
    );
  } else if (presentationState === 'ARRIVING') {
    return (
      <RiderActiveTripCard
        profile={getDriverProfile(assignedDriver?.id)}
        counterpartyPhone={counterpartyPhone}
        title="Driver is almost there"
        tripProgress={Math.max(tripProgress, 5)}
        remainingDistanceKm={remainingDistanceKm}
        remainingDurationMin={eta ?? remainingDurationMin}
        onCallDriver={onCallCounterparty}
      />
    );
  } else if (presentationState === 'ARRIVED') {
    // Intercept ARRIVED to show the new waiting card
    return (
      <RiderArrivedCard
        profile={getDriverProfile(assignedDriver?.id)}
        arrivedAt={arrivedAt}
        verificationState={verificationState}
        otp={otp}
        counterpartyPhone={counterpartyPhone}
        onAcknowledgeArrival={onAcknowledgeArrival}
        onPassengerAtVehicle={onPassengerAtVehicle}
        onCallDriver={onCallCounterparty}
      />
    );
  } else if (presentationState === 'IN_PROGRESS') {
    if (tripProgress >= 100 && tripSummary) {
      return (
        <RiderDestinationReachedCard
          tripSummary={tripSummary}
        />
      );
    }

    return (
      <RiderActiveTripCard
        profile={getDriverProfile(assignedDriver?.id)}
        counterpartyPhone={counterpartyPhone}
        title={tripProgress > 90 ? 'Approaching destination' : 'Heading to destination'}
        tripProgress={tripProgress}
        remainingDistanceKm={remainingDistanceKm}
        remainingDurationMin={remainingDurationMin}
        onCallDriver={onCallCounterparty}
      />
    );
  }
}

// ── Rider Arrived Card (ARRIVED) ───────────────────────────────────────────
const RiderArrivedCard = React.memo(function RiderArrivedCard({
  profile,
  arrivedAt,
  verificationState,
  otp,
  counterpartyPhone,
  onAcknowledgeArrival,
  onPassengerAtVehicle,
  onCallDriver,
}: {
  profile: any;
  arrivedAt?: number | null;
  verificationState?: string;
  otp?: string | null;
  counterpartyPhone?: string | null;
  onAcknowledgeArrival?: () => void;
  onPassengerAtVehicle?: () => void;
  onCallDriver: () => void;
}) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (!arrivedAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - arrivedAt) / 60000);
      setElapsedMinutes(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const isVerified = verificationState === 'OTP_VERIFIED' || verificationState === 'READY_TO_START';
  const isPassengerApproaching = verificationState === 'PASSENGER_APPROACHING';
  const isPassengerReady = verificationState === 'PASSENGER_READY' || verificationState === 'OTP_PENDING';

  if (isVerified) {
    return (
      <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.successMorphBlock}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Passenger verified</Text>
          <Text style={styles.successSub}>Preparing your trip...</Text>
        </View>
      </BottomSheetScrollView>
    );
  }

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        <Text style={styles.statusLabel}>Driver has arrived</Text>
      </View>

      <DriverProfileCard profile={profile} accent={colors.success} />

      <View style={styles.arrivedContextBlock}>
        <Text style={styles.arrivedContextText}>
          Meet driver at the designated pickup point.
        </Text>
        <Text style={styles.arrivedWaitTime}>
          Waiting for {elapsedMinutes > 0 ? `${elapsedMinutes} min` : '< 1 min'}
        </Text>
      </View>

      {/* OTP Block */}
      {isPassengerReady && (
        <View style={styles.otpBlock}>
          {otp ? (
            <>
              <Text style={styles.otpLabel}>Show this code to your driver</Text>
              <Text style={styles.otpText}>{otp}</Text>
            </>
          ) : (
            <View style={styles.otpLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.otpLoadingText}>Generating secure PIN...</Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.arrivedActions}>
        {!isPassengerApproaching && !isPassengerReady && (
          <PrimaryButton
            label="I'm coming"
            variant="accent"
            onPress={() => onAcknowledgeArrival?.()}
          />
        )}

        {isPassengerApproaching && !isPassengerReady && (
          <PrimaryButton
            label="I'm at the vehicle"
            variant="gradient"
            onPress={() => onPassengerAtVehicle?.()}
          />
        )}

        {isPassengerReady && (
          <View style={styles.approachingBadge}>
            <Text style={styles.approachingBadgeText}>Please enter the vehicle</Text>
          </View>
        )}

        {counterpartyPhone && (
          <PressableScale onPress={onCallDriver} haptic="medium" style={styles.secondaryCallBtn}>
            <View style={styles.secondaryCallRow}>
              <Ionicons name="call-outline" size={17} color={colors.primary} />
              <Text style={styles.secondaryCallText}>Call Driver</Text>
            </View>
          </PressableScale>
        )}
      </View>
    </BottomSheetScrollView>
  );
});

// ── Rider Active Trip Card (IN_PROGRESS) ──────────────────────────────────
const RiderActiveTripCard = React.memo(function RiderActiveTripCard({
  profile,
  counterpartyPhone,
  title,
  tripProgress,
  remainingDistanceKm,
  remainingDurationMin,
  onCallDriver,
}: {
  profile: any;
  counterpartyPhone: string | null;
  title: string;
  tripProgress: number;
  remainingDistanceKm: number | null;
  remainingDurationMin: number | null;
  onCallDriver: () => void;
}) {
  const isApproaching = tripProgress > 90;

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, { backgroundColor: isApproaching ? colors.warning : colors.primary }]} />
        <Text style={styles.statusLabel}>{title}</Text>
      </View>

      <View style={styles.progressBlock}>
        <TripProgressIndicator
          progressPercentage={tripProgress}
          etaMin={remainingDurationMin}
          accent={colors.primary}
        />
        {remainingDistanceKm !== null && (
          <Text style={styles.distanceSubtext}>
            {remainingDistanceKm.toFixed(1)} km remaining
          </Text>
        )}
      </View>

      <DriverProfileCard profile={profile} accent={colors.primary} />

      {/* Safety & Action Row */}
      <View style={styles.safetyRow}>
        <PressableScale style={styles.safetyBtn} haptic="light">
          <View style={styles.safetyBtnIconWrapper}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.safetyBtnText}>Share Trip</Text>
        </PressableScale>

        <PressableScale style={[styles.safetyBtn, styles.sosBtn]} haptic="medium">
          <View style={[styles.safetyBtnIconWrapper, styles.sosIconWrapper]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.danger} />
          </View>
          <Text style={[styles.safetyBtnText, styles.sosText]}>SOS</Text>
        </PressableScale>

        {counterpartyPhone && (
          <PressableScale style={styles.safetyBtn} haptic="light" onPress={onCallDriver}>
            <View style={styles.safetyBtnIconWrapper}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.safetyBtnText}>Contact</Text>
          </PressableScale>
        )}
      </View>
    </BottomSheetScrollView>
  );
});

// ── Rider Destination Reached (IN_PROGRESS -> tripProgress >= 100) ────────
const RiderDestinationReachedCard = React.memo(function RiderDestinationReachedCard({
  tripSummary,
}: {
  tripSummary: TripSummary;
}) {
  return (
    <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.celebrationWrap}>
        <View style={styles.destinationIconWrap}>
          <Ionicons name="flag-outline" size={34} color={colors.primary} />
        </View>
      </View>
      <Text style={styles.receiptKicker}>DESTINATION REACHED</Text>

      <View style={styles.fareBlock}>
        <Text style={styles.fareAmount}>{tripSummary.currency}{tripSummary.estimatedFare.toFixed(2)}</Text>
        <Text style={styles.fareSub}>
          {tripSummary.distanceKm.toFixed(1)} km · {tripSummary.durationMin} min
        </Text>
      </View>

      {/* Waiting state for Driver's action */}
      <View style={[styles.activeMetricsRow, { marginTop: 16 }]}>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />
        <Text style={styles.breakdownLabel}>Waiting for your driver to complete the trip...</Text>
      </View>

      {/* Extension slot for tolls/waiting fees later */}
      {(tripSummary.tolls || tripSummary.waitingFees) && (
        <View style={styles.breakdown}>
          {tripSummary.tolls ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tolls</Text>
              <Text style={styles.breakdownValue}>{tripSummary.currency}{tripSummary.tolls.toFixed(2)}</Text>
            </View>
          ) : null}
          {tripSummary.waitingFees ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Waiting Fees</Text>
              <Text style={styles.breakdownValue}>{tripSummary.currency}{tripSummary.waitingFees.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheetScrollView>
  );
});

// ── Searching State Content (SEARCHING / OFFERED) ─────────────────────────
const SearchingStateContent = React.memo(function SearchingStateContent({ onCancel }: { onCancel: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase 1 -> 2 at 3s
    const t1 = setTimeout(() => setPhase(1), 3000);
    // Phase 2 -> 3 at 7s
    const t2 = setTimeout(() => setPhase(2), 7000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const titles = [
    'Searching nearby drivers',
    'Matching with best driver',
    'Finalizing connection'
  ];
  const subs = [
    'Searching within 3 km',
    'Driver selected, waiting for response',
    'Just a moment...'
  ];

  return (
    <View style={[styles.container, styles.centered]}>
      <View style={styles.progressRow}>
        <Text style={[styles.progressStep, phase >= 0 && styles.progressStepActive]}>Searching</Text>
        <View style={styles.progressLineWrap}>
           <Animated.View layout={LinearTransition} style={[styles.progressLineFill, { width: phase >= 1 ? '100%' : '0%' }]} />
        </View>
        <Text style={[styles.progressStep, phase >= 1 && styles.progressStepActive]}>Matching</Text>
        <View style={styles.progressLineWrap}>
           <Animated.View layout={LinearTransition} style={[styles.progressLineFill, { width: phase >= 2 ? '100%' : '0%' }]} />
        </View>
        <Text style={[styles.progressStep, phase >= 2 && styles.progressStepActive]}>Confirmed</Text>
      </View>

      <SearchingRadar size={168} />

      <Animated.View key={`title-${phase}`} entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)} style={styles.searchTextWrap}>
        <Text style={styles.searchTitle}>{titles[phase]}</Text>
        <Text style={styles.searchSub}>{subs[phase]}</Text>
      </Animated.View>

      <PrimaryButton
        label="Cancel"
        variant="outline"
        accent={colors.danger}
        onPress={onCancel}
        style={styles.cancelWide}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  centered: {
    alignItems: 'center',
  },
  greeting: {
    ...type.title,
    color: colors.navy,
  },
  idleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.success, 0x1a),
    borderWidth: 1,
    borderColor: withAlpha(colors.success, 0x44),
  },
  nearbyChipMuted: {
    backgroundColor: colors.background,
    borderColor: colors.hairline,
  },
  nearbyDot: { width: 7, height: 7, borderRadius: 4 },
  nearbyText: { ...type.caption, color: colors.textSecondary },

  // Greeting hero
  greetingBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Quick Destinations
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickPill: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: withAlpha(ACCENT, 0x14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickLabel: { ...type.label, color: colors.textPrimary },
  quickSub: { ...type.caption, color: colors.textMuted },

  // Section structure
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  signOutBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },

  fieldLabel: {
    ...type.label,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Booking-for-someone-else (Phase 12)
  bookingForCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
    gap: spacing.md,
  },
  bookingForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingForLabel: {
    ...type.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  thirdPartyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(ACCENT, 0x14),
    borderWidth: 1,
    borderColor: withAlpha(ACCENT, 0x44),
  },
  thirdPartyChipText: { ...type.caption, color: ACCENT },

  // Call button (Phase 12 contact exchange)
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.success, 0x18),
    borderWidth: 1,
    borderColor: withAlpha(colors.success, 0x55),
  },
  callGlyph: { fontSize: 16 },
  callText: { ...type.label, color: colors.success },

  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  routeRail: { alignItems: 'center', width: 12 },
  railDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  railLine: { width: 2, height: 18, backgroundColor: colors.hairlineStrong, marginVertical: 2 },
  railDotDest: { width: 10, height: 10, borderRadius: 2, backgroundColor: ACCENT },
  routeLabels: { flex: 1 },
  routeFrom: { ...type.caption, color: colors.textMuted },
  routeSep: { height: spacing.sm },
  routeTo: { ...type.body, fontFamily: fonts.bold, color: colors.textPrimary },
  changeText: { ...type.caption, fontFamily: fonts.bold, color: ACCENT },

  // Confirming
  confirmTitle: {
    ...type.title,
    color: colors.navy,
  },
  tiersContainer: {
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.7,
  },
  tierCardSelected: {
    borderColor: ACCENT,
    boxShadow: elevationShadows.soft,
    opacity: 1,
  },
  tierIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tierInfo: {
    flex: 1,
    gap: 2,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tierName: { ...type.label, color: colors.textPrimary },
  tierCapacityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tierCapacity: { ...type.caption, color: colors.textSecondary },
  tierEta: { ...type.caption, color: colors.textSecondary },
  tierPriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tierPrice: { ...type.heading, color: colors.textPrimary },
  tierTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
  },
  tierTagSelected: {
    backgroundColor: withAlpha(ACCENT, 0x14),
  },
  tierTagText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  tierTagTextSelected: {
    color: ACCENT,
  },
  estimateCalc: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: spacing.lg, justifyContent: 'center' },
  estimateCalcText: { ...type.body, color: colors.textSecondary },
  changeDestText: { ...type.label, color: ACCENT },
  mapLink: { alignSelf: 'center', paddingVertical: 4 },
  mapLinkRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapLinkText: { ...type.caption, color: colors.textSecondary },
  textBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  signOutText: {
    ...type.caption,
    color: colors.textMuted,
  },

  // Searching
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressStep: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  progressStepActive: {
    color: ACCENT,
  },
  progressLineWrap: {
    flex: 1,
    height: 2,
    backgroundColor: colors.hairline,
    marginHorizontal: spacing.sm,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  searchTextWrap: {
    alignItems: 'center',
    height: 60,
    marginTop: 12,
    marginBottom: spacing.lg,
  },
  searchTitle: {
    ...type.heading,
    color: colors.textPrimary,
  },
  searchSub: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  cancelWide: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },

  // Completed — Receipt & Rating
  // One-shot celebration Lottie — negative margins trim the canvas whitespace.
  celebrationWrap: {
    alignSelf: 'center',
    marginTop: -12,
    marginBottom: -22,
  },
  doneIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: elevationShadows.soft,
  },
  destinationIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: withAlpha(colors.primary, 0x12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0x33),
  },
  receiptKicker: {
    ...type.caption,
    fontFamily: fonts.heavy,
    letterSpacing: 1.5,
    color: colors.success,
    textAlign: 'center',
  },
  fareBlock: {
    alignItems: 'center',
    gap: 2,
  },
  fareAmount: {
    ...type.display,
    fontSize: 46,
    color: colors.textPrimary,
  },
  fareSub: {
    ...type.body,
    color: colors.textSecondary,
  },
  breakdown: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...type.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  breakdownValue: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 2,
  },
  breakdownTotalLabel: {
    ...type.label,
    fontFamily: fonts.heavy,
    color: colors.textPrimary,
  },
  breakdownTotalValue: {
    ...type.label,
    fontFamily: fonts.heavy,
    color: colors.textPrimary,
  },
  ratePrompt: {
    ...type.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Active trip
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    ...type.heading,
    color: colors.textPrimary,
  },
  cancelTripText: {
    ...type.label,
    color: colors.danger,
  },
  spacer: {
    height: 4,
  },
  secondaryCallBtn: {
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryCallText: {
    ...type.body,
    color: colors.primary,
    fontFamily: fonts.medium,
  },
  arrivedContextBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: withAlpha(colors.success, 0.05),
    borderRadius: radius.md,
    marginBottom: 8,
  },
  arrivedContextText: {
    ...type.body,
    color: colors.textPrimary,
  },
  arrivedWaitTime: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  otpBlock: {
    backgroundColor: withAlpha(colors.primary, 0.05),
    padding: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.1),
  },
  otpLabel: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  otpText: {
    ...type.display,
    fontSize: 48,
    color: colors.primary,
    letterSpacing: 8,
  },
  otpLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpLoadingText: {
    ...type.body,
    color: colors.textSecondary,
  },
  arrivedActions: {
    marginTop: 8,
    gap: 10,
  },
  approachingBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  approachingBadgeText: {
    ...type.heading,
    color: colors.textPrimary,
  },
  successMorphBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 32,
    color: 'white',
  },
  successTitle: {
    ...type.display,
    fontSize: 24,
    color: colors.textPrimary,
  },
  successSub: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Active Trip Features
  activeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  distanceSubtext: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -8,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    gap: 8,
  },
  safetyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    minHeight: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  safetyBtnIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  safetyBtnText: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  sosBtn: {
    borderColor: withAlpha(colors.danger, 0.3),
    backgroundColor: withAlpha(colors.danger, 0.05),
  },
  sosIconWrapper: {
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  sosText: {
    color: colors.danger,
  },
});
