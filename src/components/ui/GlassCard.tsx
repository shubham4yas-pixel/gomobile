import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, elevationShadows, withAlpha } from '@/theme/theme';

/**
 * GlassCard (Phase 17) — frosted-glass surface for content floating over the
 * map (HUD chips, ETA banners, floating controls).
 *
 * Structure: an outer wrapper carries the layered shadow (shadows can't live
 * on a clipped view), an inner clipped BlurView frosts whatever is behind it,
 * and a translucent white wash + hairline top border give it the "lit edge"
 * that makes glass read as glass.
 *
 * On Android, BlurView falls back to `experimentalBlurMethod` dimezisBlurView;
 * on web it degrades to a translucent card — both intentional and safe.
 */

interface GlassCardProps {
  children: ReactNode;
  /** Blur strength. Default 28 — enough to frost the map without muddying it. */
  intensity?: number;
  /** Corner radius token. Default radius.md (16). */
  rounded?: number;
  /** Inner padding. Default 14. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function GlassCard({
  children,
  intensity = 28,
  rounded = radius.md,
  padding = 14,
  style,
}: GlassCardProps) {
  return (
    <View style={[styles.shadowWrap, { borderRadius: rounded }, style]}>
      <View style={[styles.clip, { borderRadius: rounded }]}>
        <BlurView
          intensity={intensity}
          tint="light"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        {/* Translucent wash + lit top edge — what sells the glass. */}
        <View style={[StyleSheet.absoluteFill, styles.wash, { borderRadius: rounded }]} />
        <View style={{ padding }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    boxShadow: elevationShadows.raised,
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.white, 0x66), // web/no-blur fallback wash
  },
  wash: {
    backgroundColor: withAlpha(colors.white, 0x59),
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0x99),
  },
});
