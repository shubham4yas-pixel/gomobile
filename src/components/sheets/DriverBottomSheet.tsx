import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RideStatus, RideOffer, Receipt } from '@/store/useRideStore';
import { colors, radius, shadows, typography, withAlpha } from '@/theme/theme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RadarPulse } from '@/components/trip/RadarPulse';
import { SwipeToAccept } from '@/components/trip/SwipeToAccept';
import { StarRating } from '@/components/trip/StarRating';

interface DriverBottomSheetProps {
  status: RideStatus;
  pendingOffer: RideOffer | null;
  receipt: Receipt | null;
  /** Rider/passenger phone for the active trip (Phase 12). */
  counterpartyPhone: string | null;
  isThirdParty?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onAdvanceStatus: () => void;
  onCallRider: () => void;
  onSubmitRating: (rating: number) => void;
  onSignOut: () => void;
}

const ACCENT = colors.driver;

function tripMeta(status: RideStatus): {
  label: string;
  action: string;
  danger?: boolean;
} {
  switch (status) {
    case 'ACCEPTED':
      return { label: 'Heading to pickup', action: "I've Arrived" };
    case 'ARRIVED':
      return { label: 'Waiting for rider', action: 'Start Trip' };
    case 'IN_PROGRESS':
      return { label: 'Trip in progress', action: 'End Trip', danger: true };
    default:
      return { label: '', action: '' };
  }
}

export function DriverBottomSheet({
  status,
  pendingOffer,
  receipt,
  counterpartyPhone,
  isThirdParty,
  onAccept,
  onDecline,
  onAdvanceStatus,
  onCallRider,
  onSubmitRating,
  onSignOut,
}: DriverBottomSheetProps) {
  // ── IDLE (online) ─────────────────────────────────────────────────────────
  if (status === 'IDLE') {
    return (
      <View style={[styles.container, styles.centered]}>
        <RadarPulse color={ACCENT} glyph="🚗" size={92} />
        <View style={styles.onlineRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>You're online</Text>
        </View>
        <Text style={styles.subText}>Scanning for ride requests nearby…</Text>
        <Pressable onPress={onSignOut} style={styles.textBtn}>
          <Text style={styles.signOutText}>Go Offline</Text>
        </Pressable>
      </View>
    );
  }

  // ── OFFERED ────────────────────────────────────────────────────────────────
  if (status === 'OFFERED' && pendingOffer) {
    return (
      <View style={styles.container}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerKicker}>NEW RIDE REQUEST</Text>
          <View style={styles.distancePill}>
            <Text style={styles.distanceText}>
              {pendingOffer.distanceKm} km away
            </Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeNode, { backgroundColor: ACCENT }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>
                {pendingOffer.pickup.lat.toFixed(4)}, {pendingOffer.pickup.lng.toFixed(4)}
              </Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View
              style={[styles.routeNode, styles.routeNodeSquare, { backgroundColor: colors.success }]}
            />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeValue}>
                {pendingOffer.dropoff.lat.toFixed(4)}, {pendingOffer.dropoff.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>

        <SwipeToAccept onAccept={onAccept} accent={colors.success} />

        <Pressable onPress={onDecline} style={styles.textBtn}>
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
        <Text style={styles.timerNote}>Auto-declines in 30 seconds</Text>
      </View>
    );
  }

  // ── COMPLETED — Earnings & Rate Rider ────────────────────────────────────────
  if (status === 'COMPLETED') {
    return <DriverEarningsCard receipt={receipt} onSubmit={onSubmitRating} />;
  }

  // ── ACTIVE TRIP (ACCEPTED / ARRIVED / IN_PROGRESS) ───────────────────────────
  const meta = tripMeta(status);

  return (
    <View style={styles.container}>
      <View style={styles.statusHeader}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                status === 'ARRIVED'
                  ? colors.success
                  : status === 'IN_PROGRESS'
                  ? colors.warning
                  : ACCENT,
            },
          ]}
        />
        <Text style={styles.statusLabel}>{meta.label}</Text>
      </View>

      {/* Rider contact (Phase 12) — third-party bookings show the passenger's # */}
      {counterpartyPhone ? (
        <View style={styles.contactCard}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>
              {isThirdParty ? 'Passenger' : 'Rider'}
            </Text>
            <Text style={styles.contactPhone}>{counterpartyPhone}</Text>
          </View>
          <Pressable onPress={onCallRider} style={styles.contactCallBtn}>
            <Text style={styles.contactCallGlyph}>📞</Text>
            <Text style={styles.contactCallText}>Call</Text>
          </Pressable>
        </View>
      ) : null}

      <PrimaryButton
        label={meta.action}
        variant={meta.danger ? 'outline' : 'accent'}
        accent={meta.danger ? colors.danger : ACCENT}
        onPress={onAdvanceStatus}
      />
    </View>
  );
}

// ── Earnings & Rate-Rider card (driver, COMPLETED) ──────────────────────────
function DriverEarningsCard({
  receipt,
  onSubmit,
}: {
  receipt: Receipt | null;
  onSubmit: (rating: number) => void;
}) {
  const [rating, setRating] = useState(5);

  if (!receipt) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.subText}>Wrapping up the trip…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.earnKicker}>TRIP COMPLETE</Text>

      <View style={styles.earnBlock}>
        <Text style={styles.earnLabel}>You earned</Text>
        <Text style={styles.earnAmount}>${receipt.fare.toFixed(2)}</Text>
        <Text style={styles.earnSub}>
          {receipt.distanceKm.toFixed(1)} km · {receipt.durationMin} min
        </Text>
      </View>

      <Text style={styles.ratePrompt}>Rate your rider</Text>
      <StarRating value={rating} onChange={setRating} />

      <PrimaryButton
        label="Go Online"
        variant="accent"
        accent={ACCENT}
        onPress={() => onSubmit(rating)}
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
  subText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Online
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  onlineText: {
    fontSize: 20,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },

  // Offer
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offerKicker: {
    fontSize: 13,
    fontWeight: typography.weightHeavy,
    letterSpacing: 1.5,
    color: ACCENT,
  },
  distancePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(ACCENT, 0x22),
    borderWidth: 1,
    borderColor: withAlpha(ACCENT, 0x55),
  },
  distanceText: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: ACCENT,
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  routeRow: {
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
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
  },
  declineText: {
    fontSize: 15,
    fontWeight: typography.weightBold,
    color: colors.danger,
  },
  timerNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Completed — Earnings & Rate Rider
  earnKicker: {
    fontSize: 13,
    fontWeight: typography.weightHeavy,
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
    fontSize: 15,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  earnAmount: {
    fontSize: 46,
    fontWeight: typography.weightHeavy,
    color: colors.success,
    letterSpacing: -1,
  },
  earnSub: {
    fontSize: 14,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  ratePrompt: {
    fontSize: 16,
    fontWeight: typography.weightBold,
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
  contactLabel: { fontSize: 12, color: colors.textMuted },
  contactPhone: { fontSize: 16, fontWeight: typography.weightBold, color: colors.textPrimary },
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
  contactCallText: { fontSize: 14, fontWeight: typography.weightBold, color: colors.success },

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
});
