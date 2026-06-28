import { StyleSheet, Text, View } from 'react-native';
import { DriverProfile } from '@/lib/driverProfile';
import { colors, radius, shadows, typography, withAlpha } from '@/theme/theme';

interface DriverProfileCardProps {
  profile: DriverProfile;
  accent?: string;
  /** Optional ETA label, e.g. "3 min away". */
  eta?: string | null;
}

/**
 * Rich rider-facing card identifying the assigned driver and their vehicle.
 */
export function DriverProfileCard({
  profile,
  accent = colors.rider,
  eta,
}: DriverProfileCardProps) {
  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: withAlpha(accent, 0x22), borderColor: accent },
          ]}
        >
          <Text style={[styles.avatarText, { color: accent }]}>
            {profile.initials}
          </Text>
        </View>

        <View style={styles.identity}>
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.rating}>★ {profile.rating}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.trips}>{profile.trips.toLocaleString()} trips</Text>
          </View>
        </View>

        {eta ? (
          <View style={[styles.etaPill, { borderColor: withAlpha(accent, 0x55) }]}>
            <Text style={[styles.etaText, { color: accent }]}>{eta}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.vehicleRow}>
        <View style={styles.vehicleIconWrap}>
          <Text style={styles.vehicleIcon}>🚗</Text>
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>
            {profile.color} {profile.car}
          </Text>
          <Text style={styles.vehicleSub}>Vehicle</Text>
        </View>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{profile.plate}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: typography.weightHeavy,
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rating: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: colors.warning,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 13,
  },
  trips: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  etaPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  etaText: {
    fontSize: 13,
    fontWeight: typography.weightBold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIcon: {
    fontSize: 22,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
  },
  vehicleSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  plate: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  plateText: {
    fontSize: 14,
    fontWeight: typography.weightHeavy,
    color: colors.black,
    letterSpacing: 1,
  },
});
