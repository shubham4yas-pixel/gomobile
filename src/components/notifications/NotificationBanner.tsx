import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  SlideInUp,
  SlideOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { colors, fonts, radius, spacing, withAlpha } from '@/theme/theme';
import type { AppNotification, NotificationActionId } from '@/types/notifications';
import { LiveApproachContent } from './LiveApproachContent';

/**
 * NotificationBanner (Phase 20)
 *
 * A premium glassmorphism banner: slides down from the top edge, blurred
 * translucent surface, Ionicons glyph, quick-action row, auto-dismiss for
 * transient notifications. Live driver-approach notifications render the
 * animated ETA/progress block and stay pinned until the ride state moves on —
 * content updates IN PLACE (stable component key = notification id).
 */

interface NotificationBannerProps {
  notification: AppNotification;
  onAction: (action: NotificationActionId, notification: AppNotification) => void;
  onDismiss: (id: string) => void;
}

const ENTER = SlideInUp.springify().damping(18).stiffness(160).mass(0.7);
const EXIT = SlideOutUp.duration(220).easing(Easing.in(Easing.cubic));

export function NotificationBanner({
  notification,
  onAction,
  onDismiss,
}: NotificationBannerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss transient banners; re-arm when the content is replaced
  // in place (timestamp changes on every upsert).
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!notification.sticky) {
      timerRef.current = setTimeout(() => onDismiss(notification.id), notification.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification.id, notification.sticky, notification.duration, notification.timestamp, onDismiss]);

  const glass = Platform.OS === 'ios';

  const inner = (
    <View style={styles.inner}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: withAlpha(notification.accent, 0x1c),
              borderColor: withAlpha(notification.accent, 0x30),
            },
          ]}
        >
          <Ionicons name={notification.icon} size={19} color={notification.accent} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => onDismiss(notification.id)}
          style={styles.close}
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {notification.live ? (
        <LiveApproachContent live={notification.live} accent={notification.accent} />
      ) : null}

      {notification.actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {notification.actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => onAction(action.id, notification)}
              style={({ pressed }) => [
                styles.actionButton,
                action.id === 'call' && {
                  backgroundColor: withAlpha(notification.accent, 0x16),
                  borderColor: withAlpha(notification.accent, 0x3a),
                },
                pressed && styles.actionPressed,
              ]}
            >
              <Ionicons
                name={action.icon}
                size={14}
                color={action.id === 'call' ? notification.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionLabel,
                  action.id === 'call' && { color: notification.accent },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <Animated.View
      entering={ENTER}
      exiting={EXIT}
      layout={LinearTransition.springify().damping(20).stiffness(180)}
      style={styles.shell}
    >
      {glass ? (
        <BlurView intensity={55} tint="light" style={styles.blur}>
          {inner}
        </BlurView>
      ) : (
        // Android/web: blur is costly/unsupported — a translucent frosted
        // surface preserves the glass look at 60fps.
        <View style={[styles.blur, styles.frosted]}>{inner}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0xaa),
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 10,
  },
  blur: {
    backgroundColor: withAlpha(colors.white, Platform.OS === 'ios' ? 0x9e : 0xf2),
  },
  frosted: {
    backgroundColor: withAlpha(colors.white, 0xf2),
  },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.navy, 0x0d),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: withAlpha(colors.white, 0xb0),
  },
  actionPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.97 }],
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
