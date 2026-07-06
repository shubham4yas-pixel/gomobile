import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReceiptLineItem } from '@/components/trip/ReceiptLineItem';
import { colors, fonts, radius, spacing, type, elevationShadows, withAlpha } from '@/theme/theme';
import { toast } from '@/store/useToastStore';
import type { TripSummary, Receipt } from '@/store/useRideStore';
import type { DriverProfile } from '@/lib/driverProfile';

/**
 * RiderReceiptCard (Phase 20 — Receipt & Invoice Experience)
 *
 * A production-grade, banking-app-style digital receipt shown immediately after
 * a successful payment. It is fully DATA-DRIVEN from a single `TripSummary`
 * object (see the store) — nothing is hardcoded — so a backend-generated
 * receipt can populate it verbatim later. Any metadata the summary lacks today
 * (invoice no., payment id, timestamp) is mocked deterministically from the
 * trip id, so the value is stable across renders (no churn → 60 FPS).
 *
 * The payment engine (`paymentGateway`, payment state machine) is NOT touched:
 * this component only READS a summary and renders. All actions are UI-only,
 * wired to optional callbacks so backend hooks can drop in without a redesign.
 */

// ─── Fare breakdown model ───────────────────────────────────────────────────
export interface FareLine {
  key: string;
  label: string;
  /** Positive magnitude; `kind` decides how it renders. */
  value: number;
  kind: 'charge' | 'credit';
}

/**
 * Ordered fare breakdown derived from whatever components the summary carries.
 * ADDING A NEW FARE COMPONENT = add one `push(...)` here — the receipt UI maps
 * this array and needs no changes. Only non-zero components render.
 */
export function buildFareBreakdown(s: TripSummary): FareLine[] {
  const lines: FareLine[] = [];
  const push = (key: string, label: string, value: number | undefined, kind: FareLine['kind'] = 'charge') => {
    if (typeof value === 'number' && value > 0) lines.push({ key, label, value, kind });
  };

  push('base', 'Base Fare', s.baseFare);
  push('distance', 'Distance Fare', s.distanceFare);
  push('waiting', 'Waiting Charge', s.waitingFees);
  push('toll', 'Toll', s.tolls);
  push('platform', 'Platform Fee', s.platformFee);
  push('tax', 'Tax', s.taxes);
  push('tip', 'Tip', s.tip);
  push('discount', 'Discount', s.discounts, 'credit');
  push('promo', 'Promo', s.promo, 'credit');

  // Fallback so the breakdown card is never empty when the backend hasn't sent
  // itemised components yet — show the fare as a single line.
  if (lines.length === 0) {
    lines.push({ key: 'fare', label: 'Trip Fare', value: s.estimatedFare, kind: 'charge' });
  }
  return lines;
}

/**
 * Compose a complete receipt `TripSummary` from the various sources available
 * at completion. Prefers an explicit `summary`; otherwise derives one from the
 * store `Receipt`, then enriches party/route fields. Kept here (not in the
 * bottom sheet) so ALL receipt-data logic lives with the receipt.
 */
export function buildRiderReceipt(params: {
  summary?: TripSummary | null;
  receipt?: Receipt | null;
  driver?: DriverProfile | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
}): TripSummary | null {
  const { summary, receipt, driver, pickupAddress, dropoffAddress } = params;

  const base: TripSummary | null =
    summary ??
    (receipt
      ? {
          distanceKm: receipt.distanceKm,
          durationMin: receipt.durationMin,
          estimatedFare: receipt.fare,
          estimatedEarnings: 0,
          currency: receipt.currency,
          baseFare: receipt.baseFare,
          distanceFare: round2(receipt.distanceKm * receipt.perKmRate),
          amountPaid: receipt.fare,
          tripId: receipt.tripId,
          paymentStatus: 'PAID',
        }
      : null);

  if (!base) return null;

  return {
    ...base,
    tripId: base.tripId ?? receipt?.tripId,
    amountPaid: base.amountPaid ?? base.estimatedFare,
    paymentStatus: base.paymentStatus ?? 'PAID',
    driverName: base.driverName ?? driver?.name,
    vehicleModel: base.vehicleModel ?? (driver ? `${driver.color} ${driver.car}` : undefined),
    vehicleNumber: base.vehicleNumber ?? driver?.plate,
    pickupAddress: base.pickupAddress ?? pickupAddress ?? undefined,
    dropoffAddress: base.dropoffAddress ?? dropoffAddress ?? undefined,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────
interface RiderReceiptCardProps {
  summary: TripSummary;
  onDone: () => void;
  /** UI-only actions — default to a "coming soon" toast; pass real handlers
   *  later (share sheet, PDF export, support deep-link) with no UI change. */
  onDownload?: () => void;
  onShare?: () => void;
  onHelp?: () => void;
}

export function RiderReceiptCard({ summary, onDone, onDownload, onShare, onHelp }: RiderReceiptCardProps) {
  // Derive all display data once. Memoised on the identity fields so mocked
  // ids / timestamp stay stable across re-renders (correctness + no flicker).
  const view = useMemo(() => deriveReceiptView(summary), [
    summary.tripId,
    summary.paymentId,
    summary.invoiceNumber,
    summary.completedAt,
    summary.estimatedFare,
    summary.amountPaid,
  ]);

  const money = (n: number) => formatMoney(summary.currency, n);
  const fareLines = useMemo(() => buildFareBreakdown(summary), [summary]);

  const notReady = (feature: string) => toast.info(`${feature} is coming soon`);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero: success + amount paid ── */}
      <Animated.View entering={FadeInDown.duration(320)}>
        <GlassCard rounded={radius.lg} padding={0}>
          <View style={styles.hero}>
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.statusPillText}>{formatStatus(view.paymentStatus)}</Text>
            </View>
            <Text style={styles.heroLabel}>Amount Paid</Text>
            <Text style={styles.heroAmount}>{money(view.amountPaid)}</Text>
            <Text style={styles.heroSub}>{view.dateLabel} · {view.timeLabel}</Text>
          </View>
        </GlassCard>
      </Animated.View>

      {/* ── Invoice metadata ── */}
      <Animated.View entering={FadeInDown.duration(320).delay(60)} style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice</Text>
        <View style={styles.card}>
          <ReceiptLineItem label="Invoice No." value={view.invoiceNumber} mono variant="strong" />
          <ReceiptLineItem label="Trip ID" value={view.tripId} mono />
          <ReceiptLineItem label="Payment ID" value={view.paymentId} mono />
          <ReceiptLineItem label="Date & Time" value={`${view.dateLabel}, ${view.timeLabel}`} />
        </View>
      </Animated.View>

      {/* ── Ride details ── */}
      <Animated.View entering={FadeInDown.duration(320).delay(120)} style={styles.section}>
        <Text style={styles.sectionTitle}>Ride details</Text>
        <View style={styles.card}>
          <ReceiptLineItem label="Driver" value={view.driverName} variant="strong" />
          <ReceiptLineItem label="Vehicle" value={view.vehicleModel} />
          <ReceiptLineItem label="Vehicle No." value={view.vehicleNumber} mono />
          <View style={styles.softDivider} />
          <ReceiptLineItem label="Pickup" value={view.pickupAddress} />
          <ReceiptLineItem label="Dropoff" value={view.dropoffAddress} />
          <View style={styles.softDivider} />
          <ReceiptLineItem label="Distance" value={`${summary.distanceKm.toFixed(1)} km`} />
          <ReceiptLineItem label="Duration" value={`${summary.durationMin} min`} />
        </View>
      </Animated.View>

      {/* ── Fare breakdown (data-driven) ── */}
      <Animated.View entering={FadeInDown.duration(320).delay(180)} style={styles.section}>
        <Text style={styles.sectionTitle}>Fare breakdown</Text>
        <GlassCard rounded={radius.md} padding={spacing.lg}>
          {fareLines.map((line) => (
            <ReceiptLineItem
              key={line.key}
              label={line.label}
              value={line.kind === 'credit' ? `- ${money(line.value)}` : money(line.value)}
              variant={line.kind === 'credit' ? 'credit' : 'default'}
            />
          ))}
          <ReceiptLineItem label="Grand Total" value={money(view.amountPaid)} variant="total" />
        </GlassCard>
      </Animated.View>

      {/* ── Payment ── */}
      <Animated.View entering={FadeInDown.duration(320).delay(240)} style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.card}>
          <ReceiptLineItem label="Payment Method" value={view.paymentMethod} variant="strong" />
          <ReceiptLineItem label="Payment Status" value={formatStatus(view.paymentStatus)} variant="strong" />
          <ReceiptLineItem label="Amount Paid" value={money(view.amountPaid)} variant="strong" />
        </View>
      </Animated.View>

      {/* ── Premium actions (UI-only) ── */}
      <Animated.View entering={FadeInDown.duration(320).delay(300)} style={styles.actionsRow}>
        <ReceiptAction icon="download-outline" label="Download" onPress={onDownload ?? (() => notReady('Download'))} />
        <ReceiptAction icon="share-social-outline" label="Share" onPress={onShare ?? (() => notReady('Sharing'))} />
        <ReceiptAction icon="help-buoy-outline" label="Need Help?" onPress={onHelp ?? (() => notReady('Support'))} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(340)}>
        <PrimaryButton label="Done" variant="gradient" onPress={onDone} style={styles.done} />
      </Animated.View>
    </ScrollView>
  );
}

// ─── Action button ──────────────────────────────────────────────────────────
function ReceiptAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.94} haptic="light" style={styles.action} accessibilityLabel={label}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.navy} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

// ─── Derivation helpers ─────────────────────────────────────────────────────
interface ReceiptView {
  invoiceNumber: string;
  tripId: string;
  paymentId: string;
  dateLabel: string;
  timeLabel: string;
  driverName: string;
  vehicleModel: string;
  vehicleNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  paymentMethod: string;
  paymentStatus: NonNullable<TripSummary['paymentStatus']>;
  amountPaid: number;
}

const PLACEHOLDER = '—';

function deriveReceiptView(s: TripSummary): ReceiptView {
  const when = s.completedAt ? new Date(s.completedAt) : new Date();
  const seed = s.tripId ?? s.paymentId ?? s.invoiceNumber ?? String(s.estimatedFare);
  return {
    invoiceNumber: s.invoiceNumber ?? mockInvoiceNumber(seed, when),
    tripId: s.tripId ?? `TRIP-${stableCode(seed, 8)}`,
    paymentId: s.paymentId ?? `pay_${stableCode(seed, 14).toLowerCase()}`,
    dateLabel: when.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    timeLabel: when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    driverName: s.driverName ?? PLACEHOLDER,
    vehicleModel: s.vehicleModel ?? PLACEHOLDER,
    vehicleNumber: s.vehicleNumber ?? PLACEHOLDER,
    pickupAddress: s.pickupAddress ?? PLACEHOLDER,
    dropoffAddress: s.dropoffAddress ?? PLACEHOLDER,
    paymentMethod: s.paymentMethod ?? 'Card',
    paymentStatus: s.paymentStatus ?? 'PAID',
    amountPaid: s.amountPaid ?? s.estimatedFare,
  };
}

function formatMoney(currency: string, amount: number): string {
  return `${currency}${amount.toFixed(2)}`;
}

function formatStatus(status: NonNullable<TripSummary['paymentStatus']>): string {
  switch (status) {
    case 'PAID': return 'Paid';
    case 'PENDING': return 'Pending';
    case 'FAILED': return 'Failed';
    case 'REFUNDED': return 'Refunded';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stable, deterministic base-36 code from a seed — same trip → same id. */
function stableCode(seed: string, len: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = '';
  let x = h >>> 0;
  while (out.length < len) {
    out += (x % 36).toString(36);
    x = Math.floor(x / 36) || (h = Math.imul(h ^ out.length, 16777619)) >>> 0;
  }
  return out.slice(0, len).toUpperCase();
}

function mockInvoiceNumber(seed: string, when: Date): string {
  const ym = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, '0')}`;
  return `INV-${ym}-${stableCode(seed, 6)}`;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.success, 0x1a),
    marginBottom: spacing.sm,
  },
  statusPillText: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.success,
    letterSpacing: 0.4,
  },
  heroLabel: {
    ...type.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    ...type.display,
    fontSize: 44,
    color: colors.navy,
  },
  heroSub: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Sections
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  softDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.xs,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...type.caption,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  done: {
    marginTop: spacing.xs,
  },
});
