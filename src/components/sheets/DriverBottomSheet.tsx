import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withTiming, Easing, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RideStatus, RideOffer, Receipt, type TripSummary } from '@/store/useRideStore';
import { colors, radius, withAlpha, fonts, type, spacing, elevationShadows } from '@/theme/theme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TripCompleteCelebration } from '@/components/trip/TripCompleteCelebration';
import { DriverRatingCard } from '@/components/trip/DriverRatingCard';
import { RatingService } from '@/services/ratingService';
import { CollectPaymentCard, PaymentMethod } from '@/components/trip/CollectPaymentCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { SwipeToAccept } from '@/components/trip/SwipeToAccept';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from '@/store/useToastStore';
import { calculateFareEstimate } from '@/utils/helpers';
import { INCOMING_REQUEST_COUNTDOWN_SEC } from '@/utils/constants';

interface DriverBottomSheetProps {
  status: RideStatus;
  pendingOffer: RideOffer | null;
  receipt: Receipt | null;
  counterpartyPhone: string | null;
  isThirdParty?: boolean;
  eta: number | null;
  arrivedAt?: number | null;
  verificationState?: 'WAITING_FOR_PASSENGER' | 'PASSENGER_APPROACHING' | 'PASSENGER_READY' | 'OTP_PENDING' | 'OTP_VERIFIED' | 'READY_TO_START';
  otpError?: string | null;
  tripProgress?: number;
  remainingDistanceKm?: number | null;
  remainingDurationMin?: number | null;
  tripSummary?: TripSummary | null;
  onAccept: () => void;
  onDecline: () => void;
  onAdvanceStatus: () => void;
  onCallRider: () => void;
  onEnterOTP?: () => void;
  onVerifyOTP?: (code: string) => void;
  onSubmitRating: (rating: number) => void;
  onSignOut: () => void;
}

const ACCENT = colors.driver;

/**
 * Animated wrapper (Phase 18): `key={status}` remounts the content on every
 * trip-state transition so each state springs in — see RiderBottomSheet.
 */
export function DriverBottomSheet(props: DriverBottomSheetProps) {
  return (
    <Animated.View
      key={props.status}
      entering={FadeInDown.springify().damping(19).stiffness(220).mass(0.9)}
    >
      <DriverSheetContent {...props} />
    </Animated.View>
  );
}

function DriverSheetContent({
  status,
  pendingOffer,
  receipt,
  counterpartyPhone,
  isThirdParty,
  eta,
  arrivedAt,
  verificationState,
  otpError,
  tripProgress = 0,
  remainingDistanceKm = null,
  remainingDurationMin = null,
  tripSummary = null,
  onAccept,
  onDecline,
  onAdvanceStatus,
  onCallRider,
  onEnterOTP,
  onVerifyOTP,
  onSubmitRating,
  onSignOut,
}: DriverBottomSheetProps) {
  // ── IDLE (online) ─────────────────────────────────────────────────────────
  if (status === 'IDLE') {
    return (
      <SheetScroll contentStyle={styles.idleContainer}>
        {/* Prominent Online Toggle */}
        <PressableScale onPress={onSignOut} style={styles.onlineToggleCard} haptic="medium" pressedScale={0.96}>
          <View style={styles.onlineToggleRow}>
            <View style={styles.onlinePulseDot} />
            <Text style={styles.onlineToggleText}>ONLINE</Text>
          </View>
          <Text style={styles.onlineToggleSub}>Finding trips near you…</Text>
        </PressableScale>

        {/* Productivity Dashboard */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Today</Text>
          <GlassCard style={styles.earningsMainCard} padding={16}>
            <Text style={styles.earningsLabel}>Earnings</Text>
            <Text style={styles.earningsValue}>₹0.00</Text>
          </GlassCard>
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard} padding={12}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </GlassCard>
            <GlassCard style={styles.statCard} padding={12}>
              <Text style={styles.statValue}>0h 0m</Text>
              <Text style={styles.statLabel}>Online</Text>
            </GlassCard>
          </View>
        </View>

        {/* Nearby Activity Empty State */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Nearby Activity</Text>
          <GlassCard style={styles.nearbyEmptyCard} padding={12}>
            <Text style={styles.nearbyEmptyText}>Scanning for nearby requests…</Text>
          </GlassCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsGrid}>
          <PressableScale style={styles.actionCard} haptic="light" pressedScale={0.95} accessibilityLabel="Trips">
            <View style={styles.actionIconWrap}>
              <Ionicons name="car-sport-outline" size={20} color={ACCENT} />
            </View>
            <Text style={styles.actionText}>Trips</Text>
          </PressableScale>
          <PressableScale style={styles.actionCard} haptic="light" pressedScale={0.95} accessibilityLabel="Wallet">
            <View style={styles.actionIconWrap}>
              <Ionicons name="wallet-outline" size={20} color={ACCENT} />
            </View>
            <Text style={styles.actionText}>Wallet</Text>
          </PressableScale>
          <PressableScale style={styles.actionCard} haptic="light" pressedScale={0.95} accessibilityLabel="Filter">
            <View style={styles.actionIconWrap}>
              <Ionicons name="options-outline" size={20} color={ACCENT} />
            </View>
            <Text style={styles.actionText}>Filter</Text>
          </PressableScale>
          <PressableScale style={styles.actionCard} haptic="light" pressedScale={0.95} accessibilityLabel="Support">
            <View style={styles.actionIconWrap}>
              <Ionicons name="help-circle-outline" size={20} color={ACCENT} />
            </View>
            <Text style={styles.actionText}>Support</Text>
          </PressableScale>
        </View>
      </SheetScroll>
    );
  }

  // ── OFFERED ────────────────────────────────────────────────────────────────
  if (status === 'OFFERED' && pendingOffer) {
    return (
      <IncomingRequestCard
        offer={pendingOffer}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );
  }

  // ── COMPLETED — Earnings & Rate Rider ────────────────────────────────────────
  if (status === 'COMPLETED') {
    return (
      <DriverEarningsFlow
        receipt={receipt}
        counterpartyPhone={counterpartyPhone}
        isThirdParty={isThirdParty || false}
        onSubmit={onSubmitRating}
      />
    );
  }

  // ── EN ROUTE TO PICKUP (ACCEPTED) ──────────────────────────────────────────
  if (status === 'ACCEPTED') {
    return (
      <EnRouteCard
        eta={eta}
        counterpartyPhone={counterpartyPhone}
        isThirdParty={isThirdParty}
        onArrived={onAdvanceStatus}
        onCallRider={onCallRider}
      />
    );
  }

  // ── WAITING FOR RIDER (ARRIVED) ────────────────────────────────────────────
  if (status === 'ARRIVED') {
    return (
      <DriverWaitingCard
        arrivedAt={arrivedAt}
        verificationState={verificationState}
        otpError={otpError}
        counterpartyPhone={counterpartyPhone}
        isThirdParty={isThirdParty}
        onVerifyAndStart={onAdvanceStatus}
        onCallRider={onCallRider}
        onEnterOTP={onEnterOTP}
        onVerifyOTP={onVerifyOTP}
      />
    );
  }

  // ── ACTIVE TRIP (IN_PROGRESS) ───────────────────────────
  if (status === 'IN_PROGRESS') {
    if (tripProgress >= 100 && tripSummary) {
      return (
        <DriverDestinationReachedCard
          tripSummary={tripSummary}
          onComplete={onAdvanceStatus}
        />
      );
    }

    return (
      <DriverActiveTripCard
        counterpartyPhone={counterpartyPhone}
        isThirdParty={isThirdParty}
        tripProgress={tripProgress}
        remainingDistanceKm={remainingDistanceKm}
        remainingDurationMin={remainingDurationMin}
        onCallRider={onCallRider}
      />
    );
  }
}

function SheetScroll({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle: any;
}) {
  return (
    <BottomSheetScrollView
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </BottomSheetScrollView>
  );
}

// ── Post-Trip: Earnings & Rating (COMPLETED) ──────────────────────────────
const DriverEarningsFlow = React.memo(function DriverEarningsFlow({
  receipt,
  counterpartyPhone,
  isThirdParty,
  onSubmit,
}: {
  receipt: Receipt | null;
  counterpartyPhone: string | null;
  isThirdParty: boolean;
  onSubmit: (rating: number) => void;
}) {
  type PostTripState = 'RECEIPT' | 'RATING' | 'SUCCESS' | 'DONE';
  const [postTripState, setPostTripState] = useState<PostTripState>('RECEIPT');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [paidMethod, setPaidMethod] = useState<PaymentMethod | null>(null);

  if (!receipt) {
    return (
      <SheetScroll contentStyle={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.subText}>Wrapping up the trip…</Text>
      </SheetScroll>
    );
  }

  if (postTripState === 'RECEIPT') {
    // ── Step 1: collect the fare (Cash / UPI QR) before rating (Phase 15) ──────
    if (!paidMethod) {
      return (
        <SheetScroll contentStyle={styles.container}>
          <CollectPaymentCard
            amount={receipt.fare}
            currency={receipt.currency}
            tripId={receipt.tripId}
            onCollected={(method) => {
              setPaidMethod(method);
              toast.success(
                `Payment collected via ${method === 'cash' ? 'Cash' : 'UPI'}`
              );
            }}
          />
        </SheetScroll>
      );
    }

    // ── Step 2: earnings recap ───────────────────────────────
    return (
      <SheetScroll contentStyle={styles.container}>
        <View style={styles.celebrationWrap}>
          <TripCompleteCelebration size={120} />
        </View>
        <Text style={styles.earnKicker}>TRIP COMPLETE</Text>

        <View style={styles.earnBlock}>
          <Text style={styles.earnLabel}>You earned</Text>
          <Text style={styles.earnAmount}>${receipt.fare.toFixed(2)}</Text>
          <Text style={styles.earnSub}>
            {receipt.distanceKm.toFixed(1)} km · {receipt.durationMin} min
          </Text>
          <View style={styles.paidPill}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.paidPillText}>Paid via {paidMethod === 'cash' ? 'Cash' : 'UPI'}</Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <PrimaryButton
            label="Rate your passenger"
            variant="accent"
            accent={ACCENT}
            onPress={() => setPostTripState('RATING')}
          />
        </View>
      </SheetScroll>
    );
  }

  if (postTripState === 'RATING') {
    return (
      <SheetScroll contentStyle={styles.container}>
        {isSubmittingRating ? (
          <View style={[styles.container, styles.centered]}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.subText}>Submitting feedback…</Text>
          </View>
        ) : (
          <DriverRatingCard
            tripId={receipt.tripId}
            riderName={isThirdParty ? 'Passenger' : 'Rider'}
            onSubmit={async (payload) => {
              setIsSubmittingRating(true);
              await RatingService.submitRating(payload);
              setIsSubmittingRating(false);
              setPostTripState('SUCCESS');
            }}
            />
          )}
      </SheetScroll>
    );
  }

  if (postTripState === 'SUCCESS') {
    return (
      <SheetScroll contentStyle={[styles.container, styles.centered, { padding: 32 }]}>
        <Animated.View entering={FadeInDown.duration(600)} style={{ marginBottom: 24 }}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(200)} style={[{ fontSize: 24, fontWeight: 'bold', color: '#0A1B3D' }, { textAlign: 'center', marginBottom: 12 }]}>
          Thank you!
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300)} style={[styles.subText, { textAlign: 'center', marginBottom: 32 }]}>
          Your feedback helps improve the community.
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(400)} style={{ width: '100%' }}>
          <PrimaryButton
            label="Go Online"
            variant="accent"
            accent={ACCENT}
            onPress={() => onSubmit(5)}
          />
        </Animated.View>
      </SheetScroll>
    );
  }

  return null;
});

// ── En Route to Pickup Card (ACCEPTED) ──────────────────────────────────────
const EnRouteCard = React.memo(function EnRouteCard({
  eta,
  counterpartyPhone,
  isThirdParty,
  onArrived,
  onCallRider,
}: {
  eta: number | null;
  counterpartyPhone: string | null;
  isThirdParty?: boolean;
  onArrived: () => void;
  onCallRider: () => void;
}) {
  return (
    <SheetScroll contentStyle={styles.enRouteContainer}>
      <GlassCard style={styles.enRouteGlassCard} padding={20}>

        {/* Navigation Status Header */}
        <View style={styles.navHeaderRow}>
          <View style={styles.navPulseDot} />
          <Text style={styles.navHeaderText}>Navigation Active • Fastest Route</Text>
        </View>

        {/* ETA & Status */}
        <View style={styles.enRouteHeaderRow}>
          <Text style={styles.enRouteTitle}>Driving to pickup</Text>
          <Text style={styles.enRouteEta}>{eta !== null ? `${eta} min` : '-- min'}</Text>
        </View>

        {/* Rider Context */}
        {counterpartyPhone && (
          <View style={styles.riderContextRow}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person-outline" size={22} color={ACCENT} />
            </View>
            <View style={styles.riderContextTextWrap}>
              <Text style={styles.riderContextName}>{isThirdParty ? 'Passenger' : 'Rider'}</Text>
              <Text style={styles.riderContextPhone}>{counterpartyPhone}</Text>
            </View>
            <PressableScale onPress={onCallRider} haptic="medium" style={styles.riderCallBtn} accessibilityLabel="Call passenger" accessibilityRole="button">
              <Ionicons name="call-outline" size={19} color={colors.white} />
            </PressableScale>
          </View>
        )}

        <View style={styles.enRouteExtensibilitySlot} />

        {/* Swipe to Arrive Action */}
        <View style={styles.enRouteActions}>
          <SwipeToAccept
            label="Swipe to Arrive"
            onAccept={onArrived}
            accent={colors.warning}
          />
        </View>
      </GlassCard>
    </SheetScroll>
  );
});

// ── Waiting for Passenger (ARRIVED) ─────────────────────────────────────────
const DriverWaitingCard = React.memo(function DriverWaitingCard({
  arrivedAt,
  verificationState,
  otpError,
  counterpartyPhone,
  isThirdParty,
  onVerifyAndStart,
  onCallRider,
  onEnterOTP,
  onVerifyOTP,
}: {
  arrivedAt?: number | null;
  verificationState?: string;
  otpError?: string | null;
  counterpartyPhone: string | null;
  isThirdParty?: boolean;
  onVerifyAndStart: () => void;
  onCallRider: () => void;
  onEnterOTP?: () => void;
  onVerifyOTP?: (code: string) => void;
}) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [pin, setPin] = useState('');

  // Simple local timer based on arrivedAt timestamp
  useEffect(() => {
    if (!arrivedAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - arrivedAt) / 60000);
      setElapsedMinutes(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const handlePinChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 4) setPin(cleaned);
    if (cleaned.length === 4 && onVerifyOTP) {
      onVerifyOTP(cleaned);
    }
  };

  const isPending = verificationState === 'OTP_PENDING';
  const isVerified = verificationState === 'OTP_VERIFIED' || verificationState === 'READY_TO_START';
  const isPassengerApproaching = verificationState === 'PASSENGER_APPROACHING';
  const isPassengerReady = verificationState === 'PASSENGER_READY';

  // Morph to success state
  if (isVerified) {
    return (
      <SheetScroll contentStyle={styles.enRouteContainer}>
        <GlassCard style={styles.enRouteGlassCard} padding={24}>
          <View style={styles.successMorphBlock}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={32} color={colors.white} />
            </View>
            <Text style={styles.successTitle}>Passenger verified</Text>
            <Text style={styles.successSub}>Preparing your trip...</Text>
          </View>
          {verificationState === 'READY_TO_START' && (
            <View style={{ marginTop: 24 }}>
              <SwipeToAccept
                label="Swipe To Start Trip"
                onAccept={onVerifyAndStart}
                accent={colors.primary}
              />
            </View>
          )}
        </GlassCard>
      </SheetScroll>
    );
  }

  // Active OTP verification
  if (isPending) {
    return (
      <SheetScroll contentStyle={styles.enRouteContainer}>
        <GlassCard style={styles.enRouteGlassCard} padding={20}>
          <Text style={styles.verifyTitle}>Enter verification code</Text>
          <Text style={styles.verifySub}>
            Ask {isThirdParty ? 'the passenger' : 'the rider'} for their 4-digit PIN.
          </Text>

          <View style={styles.pinInputContainer}>
            <TextInput
              style={[styles.pinInput, otpError && styles.pinInputError]}
              keyboardType="number-pad"
              maxLength={4}
              value={pin}
              onChangeText={handlePinChange}
              autoFocus
              placeholder="0000"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              accessibilityLabel="Passenger verification code"
            />
            {otpError && <Text style={styles.pinErrorText}>{otpError}</Text>}
          </View>
        </GlassCard>
      </SheetScroll>
    );
  }

  // Default waiting experience
  return (
    <SheetScroll contentStyle={styles.enRouteContainer}>
      <GlassCard style={styles.enRouteGlassCard} padding={20}>
        <View style={styles.enRouteHeaderRow}>
          <Text style={styles.enRouteTitle}>
            {isPassengerReady
              ? 'Passenger at vehicle'
              : isPassengerApproaching
              ? 'Passenger is approaching'
              : 'Waiting for rider'}
          </Text>
          <Text style={styles.enRouteEta}>
            {elapsedMinutes > 0 ? `${elapsedMinutes} min` : '< 1 min'}
          </Text>
        </View>

        {/* Rider Context */}
        {counterpartyPhone && (
          <View style={styles.riderContextRow}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person-outline" size={22} color={ACCENT} />
            </View>
            <View style={styles.riderContextTextWrap}>
              <Text style={styles.riderContextName}>{isThirdParty ? 'Passenger' : 'Rider'}</Text>
              <Text style={styles.riderContextPhone}>{counterpartyPhone}</Text>
            </View>
            <PressableScale onPress={onCallRider} haptic="medium" style={styles.riderCallBtn} accessibilityLabel="Call passenger" accessibilityRole="button">
              <Ionicons name="call-outline" size={19} color={colors.white} />
            </PressableScale>
          </View>
        )}

        <View style={styles.enRouteExtensibilitySlot} />

        <View style={styles.enRouteActions}>
          {isPassengerReady ? (
            <PrimaryButton
              label="Verify Passenger"
              variant="accent"
              onPress={() => onEnterOTP && onEnterOTP()}
            />
          ) : (
            <PrimaryButton
              label="Waiting for passenger..."
              variant="outline"
              disabled
              onPress={() => {}}
            />
          )}
        </View>
      </GlassCard>
    </SheetScroll>
  );
});

// ── Active Trip Card (IN_PROGRESS) ──────────────────────────────────────────
const DriverActiveTripCard = React.memo(function DriverActiveTripCard({
  counterpartyPhone,
  isThirdParty,
  tripProgress,
  remainingDistanceKm,
  remainingDurationMin,
  onCallRider,
}: {
  counterpartyPhone: string | null;
  isThirdParty?: boolean;
  tripProgress: number;
  remainingDistanceKm: number | null;
  remainingDurationMin: number | null;
  onCallRider: () => void;
}) {
  const isApproaching = tripProgress > 90;

  return (
    <SheetScroll contentStyle={styles.enRouteContainer}>
      <GlassCard style={styles.enRouteGlassCard} padding={20}>

        <View style={styles.statusHeader}>
          <View style={[styles.statusDot, { backgroundColor: isApproaching ? colors.warning : colors.primary }]} />
          <Text style={styles.statusLabel}>
            {isApproaching ? 'Approaching dropoff' : 'Heading to destination'}
          </Text>
        </View>

        <View style={styles.activeMetricsRow}>
          <View style={styles.activeMetricBlock}>
            <Text style={styles.activeMetricValue}>
              {remainingDistanceKm !== null ? remainingDistanceKm.toFixed(1) : '--'}
            </Text>
            <Text style={styles.activeMetricLabel}>km left</Text>
          </View>
          <View style={styles.activeMetricDivider} />
          <View style={styles.activeMetricBlock}>
            <Text style={styles.activeMetricValue}>
              {remainingDurationMin !== null ? remainingDurationMin : '--'}
            </Text>
            <Text style={styles.activeMetricLabel}>min left</Text>
          </View>
        </View>

        {/* Rider Context */}
        {counterpartyPhone && (
          <View style={styles.riderContextRow}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person-outline" size={22} color={ACCENT} />
            </View>
            <View style={styles.riderContextTextWrap}>
              <Text style={styles.riderContextName}>{isThirdParty ? 'Passenger' : 'Rider'}</Text>
              <Text style={styles.riderContextPhone}>{counterpartyPhone}</Text>
            </View>
            <PressableScale onPress={onCallRider} haptic="medium" style={styles.riderCallBtn} accessibilityLabel="Call passenger" accessibilityRole="button">
              <Ionicons name="call-outline" size={19} color={colors.white} />
            </PressableScale>
          </View>
        )}
      </GlassCard>
    </SheetScroll>
  );
});

// ── Destination Reached Card (IN_PROGRESS -> tripProgress >= 100) ───────────
const DriverDestinationReachedCard = React.memo(function DriverDestinationReachedCard({
  tripSummary,
  onComplete,
}: {
  tripSummary: TripSummary;
  onComplete: () => void;
}) {
  return (
    <SheetScroll contentStyle={styles.container}>
      <View style={styles.celebrationWrap}>
        <View style={styles.destinationIconWrap}>
          <Ionicons name="flag-outline" size={34} color={colors.primary} />
        </View>
      </View>
      <Text style={styles.earnKicker}>DESTINATION REACHED</Text>

      <View style={styles.earnBlock}>
        <Text style={styles.earnLabel}>Estimated earnings</Text>
        <Text style={styles.earnAmount}>{tripSummary.currency}{tripSummary.estimatedEarnings.toFixed(2)}</Text>
        <Text style={styles.earnSub}>
          {tripSummary.distanceKm.toFixed(1)} km · {tripSummary.durationMin} min
        </Text>
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

      <View style={{ marginTop: 24 }}>
        <SwipeToAccept
          label="Swipe To Complete Ride"
          onAccept={onComplete}
          accent={colors.primary}
        />
      </View>
    </SheetScroll>
  );
});

// ── Incoming Ride Request Card (OFFERED) ────────────────────────────────────
const IncomingRequestCard = React.memo(function IncomingRequestCard({
  offer,
  onAccept,
  onDecline,
  countdownSec = INCOMING_REQUEST_COUNTDOWN_SEC,
}: {
  offer: RideOffer;
  onAccept: () => void;
  onDecline: () => void;
  countdownSec?: number;
}) {
  const [timeLeft, setTimeLeft] = useState(countdownSec);
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(0, {
      duration: countdownSec * 1000,
      easing: Easing.linear,
    });

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline(); // Auto-expire
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownSec, onDecline, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Estimate fare and duration from the existing offer payload.
  const estFare = calculateFareEstimate(offer.distanceKm).toFixed(2);
  const estDuration = Math.round(offer.distanceKm * 3 + 4);

  return (
    <SheetScroll contentStyle={styles.offerContainer}>
      <Animated.View entering={FadeInDown.springify().damping(19).stiffness(220)}>
      <GlassCard style={styles.offerGlassCard} padding={20}>

        {/* Extensibility Slot (Top) */}
        <View style={styles.offerExtensibilityTop} />

        {/* 1. Estimated Fare (Primary Element) */}
        <Text style={styles.offerFareLabel}>Estimated Fare</Text>
        <Text style={styles.offerFareValue}>${estFare}</Text>

        {/* 2. Context Row */}
        <View style={styles.offerContextRow}>
          <Text style={styles.offerContextText}>{offer.distanceKm.toFixed(1)} km away</Text>
          <View style={styles.offerContextDot} />
          <Text style={styles.offerContextText}>{estDuration} min trip</Text>
        </View>

        {/* Extensibility Slot (Middle) */}
        <View style={styles.offerExtensibilityMiddle} />

        {/* 3. Raw Coordinates */}
        <View style={styles.offerRouteBlock}>
          <View style={styles.offerRouteRow}>
            <View style={[styles.routeNode, { backgroundColor: colors.navy }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>{offer.pickup.lat.toFixed(4)}, {offer.pickup.lng.toFixed(4)}</Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.offerRouteRow}>
            <View style={[styles.routeNode, styles.routeNodeSquare, { backgroundColor: colors.success }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeValue}>{offer.dropoff.lat.toFixed(4)}, {offer.dropoff.lng.toFixed(4)}</Text>
            </View>
          </View>
        </View>

        {/* 4. Bold Numeric Countdown + Linear Progress */}
        <View style={styles.countdownBlock}>
          <View style={styles.countdownHeader}>
            <Text style={styles.countdownText}>Accept in</Text>
            <Text style={styles.countdownNumber}>{timeLeft}s</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, progressStyle]} />
          </View>
        </View>

        {/* 5. Actions */}
        <View style={styles.offerActions}>
          <SwipeToAccept onAccept={onAccept} accent={colors.success} />
          <PrimaryButton
            label="Decline"
            variant="outline"
            accent={colors.danger}
            onPress={onDecline}
          />
        </View>

      </GlassCard>
      </Animated.View>
    </SheetScroll>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 14,
  },
  centered: {
    alignItems: 'center',
  },
  // One-shot celebration Lottie — negative margins trim the canvas whitespace.
  celebrationWrap: {
    alignSelf: 'center',
    marginTop: -12,
    marginBottom: -22,
  },
  textBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  subText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Online / Dashboard
  idleContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 24,
    gap: spacing.lg,
  },
  onlineToggleCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: withAlpha(colors.success, 0x44),
    boxShadow: elevationShadows.soft,
  },
  onlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  onlinePulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
  },
  onlineToggleText: {
    ...type.display,
    fontSize: 28,
    color: colors.success,
    letterSpacing: 2,
  },
  onlineToggleSub: {
    ...type.caption,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  dashboardSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  earningsMainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: withAlpha(colors.surfaceElevated, 0xAA),
  },
  earningsLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  earningsValue: {
    ...type.display,
    fontSize: 32,
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.surfaceElevated, 0xAA),
    paddingVertical: spacing.md,
  },
  statValue: {
    ...type.heading,
    fontSize: 22,
    color: colors.textPrimary,
  },
  statLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  nearbyEmptyCard: {
    backgroundColor: withAlpha(colors.surfaceElevated, 0x66),
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  nearbyEmptyText: {
    ...type.caption,
    color: colors.textMuted,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: elevationShadows.soft,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actionText: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    fontSize: 11,
  },

  // EN ROUTE (ACCEPTED)
  enRouteContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  enRouteGlassCard: {
    backgroundColor: withAlpha(colors.surfaceElevated, 0xEE),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  navPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  navHeaderText: {
    ...type.caption,
    color: colors.primary,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  enRouteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  enRouteTitle: {
    ...type.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  enRouteEta: {
    ...type.heading,
    fontSize: 24,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  riderContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  riderContextTextWrap: {
    flex: 1,
  },
  riderContextName: {
    ...type.label,
    color: colors.textPrimary,
  },
  riderContextPhone: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  riderCallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enRouteExtensibilitySlot: {
    height: 16,
  },
  enRouteActions: {
    marginTop: 4,
  },
  otpPrepBlock: {
    backgroundColor: withAlpha(colors.warning, 0.1),
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.warning, 0.3),
    alignItems: 'center',
    marginBottom: 16,
  },
  otpPrepText: {
    ...type.body,
    color: colors.warning,
    fontFamily: fonts.medium,
  },
  verifyTitle: {
    ...type.display,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  verifySub: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  pinInputContainer: {
    alignItems: 'center',
  },
  pinInput: {
    ...type.display,
    fontSize: 48,
    letterSpacing: 16,
    color: colors.primary,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderColor: colors.hairlineStrong,
    paddingBottom: 8,
    minWidth: 160,
  },
  pinInputError: {
    color: colors.danger,
    borderColor: colors.danger,
  },
  pinErrorText: {
    ...type.caption,
    color: colors.danger,
    marginTop: 8,
  },
  successMorphBlock: {
    alignItems: 'center',
    paddingVertical: 16,
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

  // Active Trip Metrics
  activeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  activeMetricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  activeMetricValue: {
    ...type.display,
    fontSize: 32,
    color: colors.textPrimary,
  },
  activeMetricLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  activeMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.hairlineStrong,
  },

  // OFFERED (Incoming Request)
  offerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  offerGlassCard: {
    backgroundColor: withAlpha(colors.surfaceElevated, 0xEE),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  offerExtensibilityTop: { height: 0 }, // Ready for Future metadata like "SURGE 1.5x"
  offerExtensibilityMiddle: { height: 16 }, // Ready for Rider Rating, Ride Score
  offerFareLabel: {
    ...type.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  offerFareValue: {
    ...type.display,
    fontSize: 48,
    color: colors.success,
    letterSpacing: -1,
  },
  offerContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  offerContextText: {
    ...type.heading,
    fontSize: 16,
    color: colors.textPrimary,
  },
  offerContextDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  offerRouteBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: 12,
  },
  offerRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  routeNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  routeNodeSquare: {
    borderRadius: 3,
  },
  routeConnector: {
    width: 2,
    height: 22,
    marginLeft: 5,
    backgroundColor: colors.hairlineStrong,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  routeValue: {
    ...type.label,
    color: colors.textPrimary,
  },
  countdownBlock: {
    marginTop: 24,
    marginBottom: 20,
    gap: 8,
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownText: {
    ...type.body,
    color: colors.textSecondary,
  },
  countdownNumber: {
    ...type.heading,
    fontSize: 22,
    color: colors.danger,
    fontFamily: fonts.heavy,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: withAlpha(colors.danger, 0x22),
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.danger,
    borderRadius: 3,
  },
  offerActions: {
    gap: 12,
  },

  // Completed — Earnings & Rate Rider
  earnKicker: {
    fontSize: 13,
    fontFamily: fonts.heavy,
    letterSpacing: 1.5,
    color: colors.success,
    textAlign: 'center',
  },
  earnBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  earnLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  earnAmount: {
    fontSize: 46,
    fontFamily: fonts.heavy,
    color: colors.success,
    letterSpacing: -1,
  },
  earnSub: {
    ...type.body,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Fare/earnings breakdown (tolls, waiting fees) — mirrors the rider sheet.
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
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.success, 0x1f),
  },
  paidPillText: {
    ...type.caption,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.success,
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
  ratePrompt: {
    ...type.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Rider contact (Phase 12)
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  contactInfo: { flex: 1, gap: 2 },
  contactLabel: { ...type.caption, color: colors.textMuted },
  contactPhone: { ...type.body, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  contactCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.success, 0x1a),
    borderWidth: 1,
    borderColor: withAlpha(colors.success, 0x55),
  },
  contactCallGlyph: { fontSize: 14 },
  contactCallText: { fontSize: 14, fontFamily: fonts.bold, color: colors.success },

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
});
