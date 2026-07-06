import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radius, fonts, elevationShadows } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

/**
 * Tabs Layout (Phase 19 — the dashboard-first pivot)
 *
 * Persistent bottom navigation for the authenticated app: Home, Services,
 * Activity, Account. The tab bar is a floating white pill dock (Uber-style);
 * the ACTIVE tab renders as a solid navy pill with white icon + label, and
 * every tab press fires a selection haptic. The map/booking flow remains a
 * stack screen pushed on top of the tabs.
 */

const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = {
  home: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  services: { label: 'Services', icon: 'grid-outline', iconActive: 'grid' },
  activity: { label: 'Activity', icon: 'receipt-outline', iconActive: 'receipt' },
  account: { label: 'Account', icon: 'person-outline', iconActive: 'person' },
};

function PillTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dockWrap, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name] ?? { label: route.name, icon: 'ellipse-outline', iconActive: 'ellipse' };
          const focused = state.index === index;

          const onPress = () => {
            haptics.selection();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (focused) {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="button" accessibilityState={{ selected: true }} accessibilityLabel={meta.label}>
                <Animated.View entering={FadeIn.duration(180)} style={styles.activePill}>
                  <Ionicons name={meta.iconActive} size={19} color={colors.white} />
                  <Text style={styles.activeLabel}>{meta.label}</Text>
                </Animated.View>
              </Pressable>
            );
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="button" accessibilityLabel={meta.label}>
              <Ionicons name={meta.icon} size={21} color={colors.textMuted} />
              <Text style={styles.inactiveLabel}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 66,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.floating,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.navy,
    boxShadow: elevationShadows.soft,
  },
  activeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  inactiveLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
});
