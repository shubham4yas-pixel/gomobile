import { ReactNode } from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';

/**
 * PressableScale (Phase 17) — the app's shared "physical touch" primitive.
 *
 * Wraps any child in a Reanimated spring scale with a haptic tick on press-in,
 * so every tappable surface has the same weighty, responsive feel. The spring
 * runs on the UI thread (worklets) — it never stutters even when JS is busy.
 *
 * Tuning: a fast, over-damped press-in (feels immediate) and a slightly
 * bouncier release (feels alive without being toy-like).
 */

type HapticStyle = 'light' | 'medium' | 'selection' | 'none';

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** How far the surface sinks on press. Default 0.96; use 0.98 for large cards. */
  pressedScale?: number;
  /** Haptic fired on press-in. Default 'light'. */
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  pressedScale = 0.96,
  haptic = 'light',
  style,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    if (haptic !== 'none') haptics[haptic]();
    scale.value = withSpring(pressedScale, { damping: 40, stiffness: 600, mass: 0.8 });
  };

  const pressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 320, mass: 0.9 });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
