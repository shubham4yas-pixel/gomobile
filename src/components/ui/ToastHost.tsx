import { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ToastItem, ToastVariant, useToastStore } from '@/store/useToastStore';
import { colors, radius, shadows, spacing, withAlpha, fonts } from '@/theme/theme';

/**
 * ToastHost (Phase 15)
 *
 * Renders the toast queue as stacked snackbars near the top of the screen.
 * Mounted once in the root layout, above the navigator, so toasts float over
 * every screen. Each toast animates in, auto-dismisses after its duration, and
 * is tappable to dismiss early. Cross-platform (web + native).
 */

const VARIANTS: Record<ToastVariant, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { color: colors.success, icon: 'checkmark-circle' },
  error: { color: colors.danger, icon: 'alert-circle' },
  info: { color: colors.rider, icon: 'information-circle' },
};

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const anim = new Animated.Value(0);
  const v = VARIANTS[item.variant];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        dismiss(item.id)
      );
    }, item.duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          borderLeftColor: v.color,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <Pressable style={styles.pressable} onPress={() => dismiss(item.id)} hitSlop={6}>
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(v.color, 0x1f) }]}>
          <Ionicons name={v.icon} size={20} color={v.color} />
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 19,
  },
});
