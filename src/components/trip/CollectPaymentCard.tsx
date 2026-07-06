import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchDriverUpiId } from '@/services/userService';
import { buildUpiIntent } from '@/lib/upi';
import { haptics } from '@/lib/haptics';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, shadows, spacing, withAlpha, fonts } from '@/theme/theme';

/**
 * CollectPaymentCard (Phase 15 — Driver post-ride payment)
 *
 * Shown to the driver the moment a trip is COMPLETED, before rating. Two elegant
 * options:
 *   • Collect Cash  → one tap confirms the driver took cash in person.
 *   • Collect via UPI → smoothly reveals an auto-generated QR encoding a standard
 *     `upi://pay` intent for the EXACT fare. The rider scans with any UPI app and
 *     the amount is pre-filled. (Razorpay SDK deferred.)
 *
 * Calls `onCollected(method)` once payment is settled; the parent then advances
 * to the rate-rider step.
 */

export type PaymentMethod = 'cash' | 'upi';

interface Props {
  amount: number;
  currency: string;
  tripId: string;
  onCollected: (method: PaymentMethod) => void;
}

const ACCENT = colors.driver;
const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };

export function CollectPaymentCard({ amount, currency, tripId, onCollected }: Props) {
  const driverName = useAuthStore((s) => s.user?.displayName) ?? 'RideShare Driver';
  const driverUid = useAuthStore((s) => s.user?.uid);
  const [mode, setMode] = useState<'select' | 'upi'>('select');
  // The driver's own UPI VPA from their Firestore profile; undefined until
  // fetched, then null (fall back to placeholder) or the resolved string.
  const [payeeVpa, setPayeeVpa] = useState<string | null>(null);

  // Cross-fade between the two-option selector and the QR panel.
  const qrAnim = useRef(new Animated.Value(0)).current;

  const fareLabel = `${SYMBOL[currency] ?? '$'}${(amount ?? 0).toFixed(2)}`;

  // Resolve the driver's payout VPA once (buildUpiIntent falls back to the
  // EXPO_PUBLIC_DEFAULT_UPI_ID placeholder when this stays null).
  useEffect(() => {
    let active = true;
    if (driverUid) {
      fetchDriverUpiId(driverUid).then((vpa) => {
        if (active) setPayeeVpa(vpa);
      });
    }
    return () => {
      active = false;
    };
  }, [driverUid]);

  const upiString = useMemo(
    () =>
      buildUpiIntent({
        payeeVpa: payeeVpa ?? undefined,
        payeeName: driverName,
        amount,
        transactionRef: tripId,
        note: 'RideShare fare',
      }),
    [payeeVpa, driverName, amount, tripId]
  );

  const revealUpi = () => {
    haptics.light();
    setMode('upi');
    Animated.spring(qrAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start();
  };

  const backToSelect = () => {
    haptics.selection();
    Animated.timing(qrAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setMode('select')
    );
  };

  const collectCash = () => {
    haptics.success();
    onCollected('cash');
  };

  const confirmUpi = () => {
    haptics.success();
    onCollected('upi');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.amountBlock}>
        <Text style={styles.kicker}>COLLECT PAYMENT</Text>
        <Text style={styles.amount}>{fareLabel}</Text>
        <Text style={styles.amountSub}>Choose how the rider is paying</Text>
      </View>

      {mode === 'select' ? (
        <View style={styles.options}>
          <PaymentOption
            icon="cash-outline"
            title="Collect Cash"
            subtitle="Rider pays in person"
            tint={colors.success}
            onPress={collectCash}
          />
          <PaymentOption
            icon="qr-code-outline"
            title="Collect via UPI"
            subtitle="Show a scannable QR"
            tint={colors.rider}
            onPress={revealUpi}
          />
        </View>
      ) : (
        <Animated.View
          style={[
            styles.qrPanel,
            {
              opacity: qrAnim,
              transform: [
                { scale: qrAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.qrFrame}>
            <QRCode
              value={upiString}
              size={188}
              color={colors.textPrimary}
              backgroundColor={colors.white}
            />
          </View>
          <Text style={styles.qrHint}>
            Scan with any UPI app — amount {fareLabel} is pre-filled
          </Text>

          <PrimaryButton
            label="Payment Received"
            variant="accent"
            accent={colors.success}
            onPress={confirmUpi}
          />
          <Pressable onPress={backToSelect} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={styles.backText}>Other payment method</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function PaymentOption({
  icon,
  title,
  subtitle,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tint: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
      }
      style={styles.optionPressable}
    >
      <Animated.View style={[styles.option, { transform: [{ scale }] }]}>
        <View style={[styles.optionIcon, { backgroundColor: withAlpha(tint, 0x1f) }]}>
          <Ionicons name={icon} size={24} color={tint} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  amountBlock: { alignItems: 'center', gap: 2 },
  kicker: {
    color: ACCENT,
    fontSize: 12,
    fontFamily: fonts.heavy,
    letterSpacing: 1.5,
  },
  amount: { color: colors.textPrimary, fontSize: 40, fontFamily: fonts.heavy },
  amountSub: { color: colors.textSecondary, fontSize: 14 },

  options: { gap: spacing.md },
  optionPressable: { borderRadius: radius.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    ...shadows.card,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.bold },
  optionSub: { color: colors.textMuted, fontSize: 13 },

  qrPanel: { alignItems: 'center', gap: spacing.lg },
  qrFrame: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  qrHint: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.xs },
  backText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.medium },
});
