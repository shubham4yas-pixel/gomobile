import {
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  radius,
  fonts,
  elevationShadows,
  withAlpha,
  idealTextOn,
} from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

type Variant = 'gradient' | 'accent' | 'outline';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Accent color for `accent` / `outline` variants. */
  accent?: string;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * The app's primary call-to-action (Phase 17 premium edition).
 *
 * `gradient` renders the signature deep-blue CTA with a layered floating
 * shadow; `accent` fills with the role color; `outline` is a quieter bordered
 * variant. All variants share the PressableScale spring + haptic press —
 * the animation runs on the UI thread via Reanimated worklets.
 */
export function PrimaryButton({
  label,
  onPress,
  variant = 'gradient',
  accent = colors.rider,
  icon,
  disabled = false,
  loading = false,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'accent'
              ? idealTextOn(accent)
              : variant === 'gradient'
              ? colors.white
              : accent
          }
        />
      ) : (
        <>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text
            style={[
              styles.label,
              variant === 'gradient' && { color: colors.white },
              variant === 'accent' && { color: idealTextOn(accent) },
              variant === 'outline' && { color: accent },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      pressedScale={0.965}
      haptic="light"
      style={[
        styles.base,
        // Layered shadow lives on the outer (non-clipped) wrapper; the inner
        // surface clips the gradient to the pill radius.
        !isDisabled && variant !== 'outline' && { boxShadow: elevationShadows.floating },
        { opacity: isDisabled ? 0.55 : 1 },
        style,
      ]}
    >
      <View style={styles.surface}>
        {variant === 'gradient' && (
          <LinearGradient
            colors={[colors.ctaTop, colors.ctaBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.fill, styles.gradientBorder]}
          >
            {content}
          </LinearGradient>
        )}
        {variant === 'accent' && (
          <View style={[styles.fill, { backgroundColor: accent }]}>{content}</View>
        )}
        {variant === 'outline' && (
          <View
            style={[
              styles.fill,
              {
                backgroundColor: withAlpha(accent, 0x14),
                borderWidth: 1.5,
                borderColor: accent,
              },
            ]}
          >
            {content}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 58,
    borderRadius: radius.lg,
  },
  surface: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  gradientBorder: {
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0x1f),
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
