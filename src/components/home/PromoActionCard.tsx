import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fonts, elevationShadows, withAlpha } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

/**
 * PromoActionCard — a compact action card with bold copy, a pill CTA, and a
 * large icon in a soft halo on the right.
 */
export interface PromoActionCardProps {
  title: string;
  body?: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function PromoActionCard({ title, body, cta, icon, onPress }: PromoActionCardProps) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} haptic="medium" accessibilityLabel={`${title} — ${cta}`}>
      <View style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{cta}</Text>
          </View>
        </View>
        <View style={styles.halo}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={34} color={colors.gold} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: 20,
    gap: 12,
    boxShadow: elevationShadows.goldGlow,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: fonts.heavy,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 0,
    color: colors.navy,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    color: withAlpha(colors.navy, 0xcc),
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: elevationShadows.soft,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.navy,
  },
  halo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: withAlpha(colors.white, 0x55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
