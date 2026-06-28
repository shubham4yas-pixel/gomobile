import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { RideStatus, LocatedPlace, RouteInfo, Receipt, PickupMode, BookingFor } from '@/store/useRideStore';
import { getDriverProfile } from '@/lib/driverProfile';
import { colors, radius, shadows, typography, withAlpha } from '@/theme/theme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DestinationSearch } from '@/components/ui/DestinationSearch';
import { PickupSelector } from '@/components/ui/PickupSelector';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { RadarPulse } from '@/components/trip/RadarPulse';
import { DriverProfileCard } from '@/components/trip/DriverProfileCard';
import { StarRating } from '@/components/trip/StarRating';

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
  eta?: string | null;
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
  onSubmitRating: (rating: number) => void;
  onSignOut: () => void;
}

const ACCENT = colors.rider;

// Fare estimate constants — mirror the backend (server.js BASE_FARE / PER_KM_RATE)
// so the rider's pre-trip estimate matches the final receipt.
const BASE_FARE = 3.0;
const PER_KM_RATE = 1.5;

function statusMeta(status: RideStatus): { label: string; color: string } {
  switch (status) {
    case 'ACCEPTED':
      return { label: 'Driver is on the way', color: ACCENT };
    case 'ARRIVED':
      return { label: 'Your driver has arrived', color: colors.success };
    case 'IN_PROGRESS':
      return { label: 'On the way to your destination', color: colors.warning };
    case 'COMPLETED':
      return { label: 'Trip complete', color: colors.success };
    default:
      return { label: '', color: ACCENT };
  }
}

export function RiderBottomSheet({
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
  onSubmitRating,
  onSignOut,
}: RiderBottomSheetProps) {
  // ── IDLE ────────────────────────────────────────────────────────────────
  if (status === 'IDLE') {
    const thirdParty = bookingFor.isThirdParty;
    return (
      <View style={styles.container}>
        <View style={styles.idleHeader}>
          <Text style={styles.greeting}>Where to?</Text>
          <View style={[styles.nearbyChip, nearbyCount === 0 && styles.nearbyChipMuted]}>
            <View
              style={[
                styles.nearbyDot,
                { backgroundColor: nearbyCount > 0 ? colors.success : colors.textMuted },
              ]}
            />
            <Text style={styles.nearbyText}>
              {nearbyCount > 0 ? `${nearbyCount} driver${nearbyCount > 1 ? 's' : ''} nearby` : 'No drivers yet'}
            </Text>
          </View>
        </View>

        {/* Pickup selector (Phase 12) — explicit current-location vs search/pin */}
        <PickupSelector
          mode={pickupMode}
          pickupLocation={pickupLocation}
          onUseCurrent={onUseCurrentPickup}
          onChooseCustom={onChoosePickupCustom}
          onSelectPickup={onSelectPickup}
          onFocusSearch={onFocusSearch}
        />

        {/* Destination */}
        <Text style={styles.fieldLabel}>Destination</Text>
        <DestinationSearch onSelected={onSelectDestination} onFocus={onFocusSearch} />

        {/* Booking for someone else (Phase 12) */}
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

        {onOpenMap ? (
          <Pressable onPress={onOpenMap} style={styles.mapLink} hitSlop={8}>
            <Text style={styles.mapLinkText}>📍  Set location on the map</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onSignOut} style={styles.textBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  // ── CONFIRMING — review route + fare, then request a ride ──────────────────
  if (status === 'CONFIRMING') {
    const estimate = routeInfo ? BASE_FARE + routeInfo.distanceKm * PER_KM_RATE : null;
    return (
      <View style={styles.container}>
        <Text style={styles.confirmTitle}>Confirm your ride</Text>

        {bookingFor.isThirdParty && bookingFor.riderPhoneNumber ? (
          <View style={styles.thirdPartyChip}>
            <Text style={styles.thirdPartyChipText}>
              👥 Booking for {bookingFor.riderPhoneNumber}
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

        <View style={styles.estimateCard}>
          {routeInfo && estimate != null ? (
            <>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Estimated fare</Text>
                <Text style={styles.estimateFare}>${estimate.toFixed(2)}</Text>
              </View>
              <Text style={styles.estimateMeta}>
                {routeInfo.distanceKm.toFixed(1)} km · {routeInfo.durationMin} min
              </Text>
            </>
          ) : (
            <View style={styles.estimateCalc}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.estimateCalcText}>Calculating route &amp; fare…</Text>
            </View>
          )}
        </View>

        <PrimaryButton
          label="Confirm RideShare"
          icon="→"
          variant="accent"
          accent={ACCENT}
          loading={authorizing}
          onPress={onConfirmRide}
        />
        <Pressable onPress={onChangeDestination} style={styles.textBtn} disabled={authorizing}>
          <Text style={styles.changeDestText}>Change destination</Text>
        </Pressable>
      </View>
    );
  }

  // ── SEARCHING ───────────────────────────────────────────────────────────
  if (status === 'SEARCHING') {
    return (
      <View style={[styles.container, styles.centered]}>
        <RadarPulse color={ACCENT} glyph="🚕" size={88} />
        <Text style={styles.searchTitle}>Finding your driver…</Text>
        <Text style={styles.searchSub}>Connecting you with nearby drivers</Text>
        <PrimaryButton
          label="Cancel"
          variant="outline"
          accent={colors.danger}
          onPress={onCancelSearch}
          style={styles.cancelWide}
        />
      </View>
    );
  }

  // ── COMPLETED — Receipt & Rating ──────────────────────────────────────────
  if (status === 'COMPLETED') {
    return <RiderReceiptCard receipt={receipt} onSubmit={onSubmitRating} />;
  }

  // ── ACTIVE TRIP (ACCEPTED / ARRIVED / IN_PROGRESS) ────────────────────────
  const meta = statusMeta(status);
  const profile = getDriverProfile(assignedDriver?.id);
  const canCancel = status === 'ACCEPTED';

  return (
    <View style={styles.container}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
        <Text style={styles.statusLabel}>{meta.label}</Text>
      </View>

      <DriverProfileCard profile={profile} accent={ACCENT} eta={eta} />

      {/* Mutual contact — call the driver (Phase 12) */}
      {counterpartyPhone ? (
        <Pressable onPress={onCallCounterparty} style={styles.callBtn}>
          <Text style={styles.callGlyph}>📞</Text>
          <Text style={styles.callText}>Call driver</Text>
        </Pressable>
      ) : null}

      {canCancel ? (
        <Pressable onPress={onCancelTrip} style={styles.textBtn}>
          <Text style={styles.cancelTripText}>Cancel Trip</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

// ── Receipt & Rating card (rider, COMPLETED) ────────────────────────────────
function RiderReceiptCard({
  receipt,
  onSubmit,
}: {
  receipt: Receipt | null;
  onSubmit: (rating: number) => void;
}) {
  const [rating, setRating] = useState(5);

  // Receipt may lag the status change by a network hop — show a brief
  // calculating state rather than an empty card.
  if (!receipt) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.searchSub}>Calculating your fare…</Text>
      </View>
    );
  }

  const fareText = `$${receipt.fare.toFixed(2)}`;

  return (
    <View style={styles.container}>
      <View style={styles.receiptKickerRow}>
        <View style={styles.receiptCheck}>
          <Text style={styles.receiptCheckGlyph}>✓</Text>
        </View>
        <Text style={styles.receiptKicker}>TRIP COMPLETE</Text>
      </View>

      <View style={styles.fareBlock}>
        <Text style={styles.fareAmount}>{fareText}</Text>
        <Text style={styles.fareSub}>
          {receipt.distanceKm.toFixed(1)} km · {receipt.durationMin} min
        </Text>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Base fare</Text>
          <Text style={styles.breakdownValue}>${receipt.baseFare.toFixed(2)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>
            Distance · {receipt.distanceKm.toFixed(1)} km × ${receipt.perKmRate.toFixed(2)}
          </Text>
          <Text style={styles.breakdownValue}>
            ${(receipt.distanceKm * receipt.perKmRate).toFixed(2)}
          </Text>
        </View>
        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownTotalLabel}>Total</Text>
          <Text style={styles.breakdownTotalValue}>{fareText}</Text>
        </View>
      </View>

      <Text style={styles.ratePrompt}>How was your trip?</Text>
      <StarRating value={rating} onChange={setRating} />

      <PrimaryButton
        label="Submit & Done"
        variant="gradient"
        onPress={() => onSubmit(rating)}
        style={styles.cancelWide}
      />
    </View>
  );
}

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
  greeting: {
    fontSize: 24,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },
  idleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
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
  nearbyText: { fontSize: 12, fontWeight: typography.weightBold, color: colors.textSecondary },

  fieldLabel: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // Booking-for-someone-else (Phase 12)
  bookingForCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 12,
  },
  bookingForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingForLabel: {
    fontSize: 14,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  thirdPartyChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(ACCENT, 0x14),
    borderWidth: 1,
    borderColor: withAlpha(ACCENT, 0x44),
  },
  thirdPartyChipText: { fontSize: 12, fontWeight: typography.weightBold, color: ACCENT },

  // Call button (Phase 12 contact exchange)
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.success, 0x18),
    borderWidth: 1,
    borderColor: withAlpha(colors.success, 0x55),
  },
  callGlyph: { fontSize: 16 },
  callText: { fontSize: 16, fontWeight: typography.weightBold, color: colors.success },

  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
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
  routeFrom: { fontSize: 13, color: colors.textMuted },
  routeSep: { height: 8 },
  routeTo: { fontSize: 16, fontWeight: typography.weightBold, color: colors.textPrimary },
  changeText: { fontSize: 13, fontWeight: typography.weightBold, color: ACCENT },

  // Confirming
  confirmTitle: {
    fontSize: 22,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },
  estimateCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estimateLabel: { fontSize: 14, fontWeight: typography.weightMedium, color: colors.textSecondary },
  estimateFare: { fontSize: 22, fontWeight: typography.weightHeavy, color: colors.textPrimary },
  estimateMeta: { fontSize: 13, color: colors.textSecondary },
  estimateCalc: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  estimateCalcText: { fontSize: 14, color: colors.textSecondary },
  changeDestText: { fontSize: 15, fontWeight: typography.weightBold, color: ACCENT },
  mapLink: { alignSelf: 'center', paddingVertical: 4 },
  mapLinkText: { fontSize: 13, fontWeight: typography.weightMedium, color: colors.textSecondary },
  textBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: typography.weightMedium,
    color: colors.textMuted,
  },

  // Searching
  searchTitle: {
    fontSize: 20,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  searchSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cancelWide: {
    alignSelf: 'stretch',
    marginTop: 8,
  },

  // Completed — Receipt & Rating
  receiptKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  receiptCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCheckGlyph: {
    fontSize: 13,
    fontWeight: typography.weightHeavy,
    color: colors.white,
  },
  receiptKicker: {
    fontSize: 13,
    fontWeight: typography.weightHeavy,
    letterSpacing: 1.5,
    color: colors.success,
  },
  fareBlock: {
    alignItems: 'center',
    gap: 2,
  },
  fareAmount: {
    fontSize: 46,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  fareSub: {
    fontSize: 15,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  breakdown: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 2,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },
  breakdownTotalValue: {
    fontSize: 15,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },
  ratePrompt: {
    fontSize: 16,
    fontWeight: typography.weightBold,
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
    fontSize: 17,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
  },
  cancelTripText: {
    fontSize: 15,
    fontWeight: typography.weightBold,
    color: colors.danger,
  },
  spacer: {
    height: 4,
  },
});
