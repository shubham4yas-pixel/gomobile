import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LocatedPlace, PickupMode } from '@/store/useRideStore';
import { DestinationSearch } from '@/components/ui/DestinationSearch';
import { colors, radius, typography, withAlpha } from '@/theme/theme';

const ACCENT = colors.rider;

interface PickupSelectorProps {
  mode: PickupMode;
  pickupLocation: LocatedPlace | null;
  onUseCurrent: () => void;
  onChooseCustom: () => void;
  onSelectPickup: (place: LocatedPlace) => void;
  onFocusSearch?: () => void;
}

/**
 * Pickup point selector (Phase 12, Task 1).
 *
 * Replaces the old silent "pickup = current GPS" behavior with an explicit
 * choice:
 *   • "Use current location" — snaps pickup to the device GPS on tap.
 *   • "Search / drop pin"    — reveals a Places search for the pickup address
 *                              and lets the user drag the blue pin on the map.
 *
 * The pickup pin uses a 🔵 person glyph; the destination uses a 🏁 flag — so the
 * two are never confused on the map.
 */
export function PickupSelector({
  mode,
  pickupLocation,
  onUseCurrent,
  onChooseCustom,
  onSelectPickup,
  onFocusSearch,
}: PickupSelectorProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Pickup</Text>

      <View style={styles.pillRow}>
        <Pressable
          style={[styles.pill, mode === 'current' && styles.pillActive]}
          onPress={onUseCurrent}
        >
          <Text style={styles.pillGlyph}>📍</Text>
          <Text style={[styles.pillText, mode === 'current' && styles.pillTextActive]}>
            Use current location
          </Text>
        </Pressable>
        <Pressable
          style={[styles.pill, mode === 'custom' && styles.pillActive]}
          onPress={onChooseCustom}
        >
          <Text style={styles.pillGlyph}>🔎</Text>
          <Text style={[styles.pillText, mode === 'custom' && styles.pillTextActive]}>
            Search / drop pin
          </Text>
        </Pressable>
      </View>

      {mode === 'current' ? (
        <View style={styles.currentRow}>
          <View style={styles.pickupDot} />
          <Text style={styles.currentText} numberOfLines={1}>
            {pickupLocation?.formattedAddress ?? 'Locating you…'}
          </Text>
        </View>
      ) : (
        <View style={styles.customWrap}>
          <DestinationSearch
            onSelected={onSelectPickup}
            onFocus={onFocusSearch}
          />
          <Text style={styles.hint}>…or drag the blue pin on the map to set your pickup.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pillActive: {
    backgroundColor: withAlpha(ACCENT, 0x18),
    borderColor: withAlpha(ACCENT, 0x66),
  },
  pillGlyph: { fontSize: 14 },
  pillText: {
    fontSize: 12,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  pillTextActive: { color: ACCENT, fontWeight: typography.weightBold },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: colors.surface,
  },
  currentText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: typography.weightMedium },
  customWrap: { gap: 8 },
  hint: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 2 },
});
