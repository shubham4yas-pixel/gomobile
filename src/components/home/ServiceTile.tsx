import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fonts, elevationShadows, withAlpha } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

/**
 * Circular elevated service button for Home and Services surfaces. Extra legacy
 * props are tolerated for compatibility, but only system icons render.
 */
export interface ServiceTileProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Small overlapping tag, e.g. "Promo" or "25%". */
  badge?: string;
  [legacyProp: string]: unknown;
}

const ICON_BY_LABEL: Record<string, keyof typeof Ionicons.glyphMap> = {
  Drive: 'car-sport-outline',
  Earnings: 'wallet-outline',
  History: 'receipt-outline',
  Trip: 'navigate-outline',
  Intercity: 'map-outline',
  Rentals: 'key-outline',
  'Bus tickets': 'bus-outline',
  Reserve: 'calendar-outline',
  Parcel: 'cube-outline',
  Seniors: 'accessibility-outline',
  'Group ride': 'people-outline',
};

export function ServiceTile({ label, icon, onPress, badge }: ServiceTileProps) {
  const resolvedIcon = icon ?? ICON_BY_LABEL[label] ?? 'sparkles-outline';

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      haptic="light"
      style={styles.wrap}
      accessibilityLabel={label}
    >
      <View style={styles.circleWrap}>
        <View style={styles.circle}>
          <Ionicons name={resolvedIcon} size={29} color={colors.navy} />
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  circleWrap: {
    // Badge overlaps the circle's top-left corner — needs an unclipped parent.
    position: 'relative',
  },
  circle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.raised,
  },
  badge: {
    position: 'absolute',
    top: -4,
    left: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.coral, 0xf0),
    boxShadow: elevationShadows.soft,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
