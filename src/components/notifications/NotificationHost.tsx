import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/hooks/useNotifications';
import { performNotificationAction } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { spacing } from '@/theme/theme';
import type { AppNotification, NotificationActionId } from '@/types/notifications';
import { NotificationBanner } from './NotificationBanner';

/**
 * NotificationHost (Phase 20)
 *
 * Single mount point for the in-app notification surface. Lives in the root
 * layout above the navigator (like <ToastHost />), so banners float over every
 * screen. Also mounts the `useNotifications` bridge, which turns ride events
 * into notifications — meaning the entire notification system boots from this
 * one component with zero wiring inside ride screens.
 */

export function NotificationHost() {
  const role = useAuthStore((s) => s.role);
  const banners = useNotificationStore((s) => s.banners);
  const insets = useSafeAreaInsets();

  // Boot the ride-event → notification bridge.
  useNotifications(role);

  const handleAction = useCallback(
    (action: NotificationActionId, notification: AppNotification) => {
      performNotificationAction(action, {
        id: notification.id,
        deepLink: notification.deepLink,
        tripId: notification.tripId,
      });
    },
    []
  );

  const handleDismiss = useCallback((id: string) => {
    useNotificationStore.getState().dismiss(id);
  }, []);

  if (banners.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {banners.map((banner) => (
        <NotificationBanner
          key={banner.id}
          notification={banner}
          onAction={handleAction}
          onDismiss={handleDismiss}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9998, // just beneath ToastHost (9999) — errors outrank updates
    gap: spacing.sm,
  },
});
