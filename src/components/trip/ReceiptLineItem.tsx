import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, fonts, spacing, type } from '@/theme/theme';

/**
 * ReceiptLineItem (Phase 20) — the single, reusable label→value row used for
 * EVERY row in the digital receipt: metadata (Trip ID, Date, Driver…),
 * fare-breakdown lines, and the grand total. One primitive → zero duplicated
 * row UI, one place to tune spacing/typography.
 *
 * Variants:
 *   default — neutral label, primary value
 *   muted   — quieter value (secondary text)
 *   strong  — emphasised value (semibold, primary)
 *   credit  — discounts/promos (success green, already-negative caller value)
 *   total   — grand total (larger, brand navy, heavier weight + top rule)
 */
export type ReceiptLineVariant = 'default' | 'muted' | 'strong' | 'credit' | 'total';

interface ReceiptLineItemProps {
  label: string;
  value: string;
  variant?: ReceiptLineVariant;
  /** Tabular figures for IDs / codes / money so columns align cleanly. */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ReceiptLineItem({
  label,
  value,
  variant = 'default',
  mono = false,
  style,
}: ReceiptLineItemProps) {
  const isTotal = variant === 'total';
  return (
    <View style={[styles.row, isTotal && styles.totalRow, style]}>
      <Text style={[styles.label, isTotal && styles.totalLabel]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          mono && styles.mono,
          variant === 'muted' && styles.valueMuted,
          variant === 'strong' && styles.valueStrong,
          variant === 'credit' && styles.valueCredit,
          isTotal && styles.valueTotal,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  label: {
    ...type.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  totalLabel: {
    ...type.heading,
    color: colors.textPrimary,
  },
  value: {
    ...type.body,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: '58%',
  },
  mono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  valueMuted: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  valueStrong: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  valueCredit: {
    color: colors.success,
    fontFamily: fonts.semibold,
  },
  valueTotal: {
    ...type.heading,
    color: colors.navy,
    fontFamily: fonts.heavy,
  },
});
