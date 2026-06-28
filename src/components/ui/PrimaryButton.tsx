import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, typography, shadows, withAlpha, idealTextOn } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

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
 * The app's primary call-to-action.
 *
 * `gradient` renders the signature black CTA; `accent` fills with the role
 * color; `outline` is a quieter bordered variant. All variants share a tactile
 * press-scale animation.
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
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    haptics.light();
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

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
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={isDisabled}
    >
      <Animated.View
        style={[
          styles.base,
          shadows.card,
          { transform: [{ scale }], opacity: isDisabled ? 0.6 : 1 },
          style,
        ]}
      >
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
                backgroundColor: withAlpha(accent, 0x22),
                borderWidth: 1.5,
                borderColor: accent,
              },
            ]}
          >
            {content}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 58,
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
    borderColor: withAlpha(colors.white, 0x14),
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
    fontSize: 17,
    fontWeight: typography.weightBold,
    letterSpacing: 0.3,
  },
});
