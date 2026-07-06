import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { fetchRideHistory, type TripRecord } from '@/services/apiService';
import { colors, radius, fonts, type, elevationShadows, withAlpha, spacing } from '@/theme/theme';
import { WhereToPill } from '@/components/home/WhereToPill';
import { ServiceTile } from '@/components/home/ServiceTile';
import { PromoActionCard } from '@/components/home/PromoActionCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptics } from '@/lib/haptics';

type TopTab = 'ride' | 'parcel';

type RecentDestination = {
  id: string;
  address: string;
  subtitle: string;
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(value?: string | null) {
  const clean = value?.trim();
  if (!clean) return 'there';
  return clean.split(/\s+/)[0];
}

function formatTripSubtitle(trip: TripRecord) {
  const date = trip.date ? new Date(trip.date) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Recent trip';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function buildRecents(trips: TripRecord[]): RecentDestination[] {
  const seen = new Set<string>();
  const addresses: RecentDestination[] = [];

  for (const trip of trips) {
    const address = trip.dropoff?.address?.trim();
    if (!address || seen.has(address)) continue;
    seen.add(address);
    addresses.push({
      id: `${trip.tripId}:${address}`,
      address,
      subtitle: formatTripSubtitle(trip),
    });
    if (addresses.length >= 4) break;
  }

  return addresses;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [topTab, setTopTab] = useState<TopTab>('ride');
  const [recents, setRecents] = useState<RecentDestination[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDriver = role === 'driver';
  const openMap = () => router.push('/(app)/map');
  const comingSoon = (what: string) => toast.info(`${what} is coming soon`);
  const displayName = user?.displayName || user?.email?.split('@')[0] || '';
  const firstName = getFirstName(displayName);
  const greeting = useMemo(() => greetingForNow(), []);

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (isDriver || !user?.uid) {
        setRecents([]);
        setIsLoadingHistory(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) setIsRefreshing(true);
      else setIsLoadingHistory(true);

      try {
        const trips = await fetchRideHistory(user.uid, 'rider');
        setRecents(buildRecents(trips));
      } finally {
        setIsLoadingHistory(false);
        setIsRefreshing(false);
      }
    },
    [isDriver, user?.uid]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => void loadDashboard(true)}
      tintColor={colors.rider}
      colors={[colors.rider]}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {isDriver ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
            <HeaderBlock eyebrow="Driver dashboard" title="Ready to drive?" body="Go online when you want requests nearby." />
            <PromoActionCard
              title="Demand check"
              body="Open the live map before going online."
              cta="View map"
              icon="car-sport"
              onPress={openMap}
            />
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <ServiceTile label="Drive" icon="car-sport-outline" onPress={openMap} />
              </View>
              <View style={styles.gridItem}>
                <ServiceTile label="Earnings" icon="wallet-outline" onPress={() => router.push('/(app)/earnings')} />
              </View>
              <View style={styles.gridItem}>
                <ServiceTile label="History" icon="receipt-outline" onPress={() => router.push('/(app)/history')} />
              </View>
            </View>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(260)} style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>{greeting}</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  Where are we heading, {firstName}?
                </Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark" size={19} color={colors.teal} />
                <Text style={styles.heroBadgeText}>Verified</Text>
              </View>
            </Animated.View>

            <View style={styles.topTabs}>
              <TopTabButton
                label="Ride"
                icon="navigate-outline"
                active={topTab === 'ride'}
                onPress={() => setTopTab('ride')}
              />
              <TopTabButton
                label="Parcel"
                icon="cube-outline"
                active={topTab === 'parcel'}
                onPress={() => {
                  setTopTab('parcel');
                  comingSoon('Parcel delivery');
                }}
              />
            </View>

            <Animated.View entering={FadeInDown.delay(70).duration(300)} style={styles.section}>
              <WhereToPill
                onPress={openMap}
                onPressLater={() => comingSoon('Ride scheduling')}
              />

              <View style={styles.statusGrid}>
                <StatusCard
                  icon="location-outline"
                  title="Nearby-first"
                  body="Search prioritises places around you when location is available."
                  tint={colors.sky}
                  soft={colors.skySoft}
                />
                <StatusCard
                  icon="lock-closed-outline"
                  title="Trip-safe"
                  body="Contact details are shared only after a match."
                  tint={colors.teal}
                  soft={colors.tealSoft}
                />
              </View>

              <SectionHeader title="Recent places" actionLabel="History" onPress={() => router.push('/(app)/history')} />
              {isLoadingHistory ? (
                <SkeletonCard />
              ) : recents.length > 0 ? (
                <View style={styles.recentsCard}>
                  {recents.map((item, index) => (
                    <PressableScale
                      key={item.id}
                      onPress={() => {
                        haptics.selection();
                        openMap();
                      }}
                      pressedScale={0.98}
                      haptic="none"
                      accessibilityLabel={`Recent destination: ${item.address}`}
                    >
                      <View style={[styles.recentRow, index > 0 && styles.recentRowBorder]}>
                        <View style={styles.recentIcon}>
                          <Ionicons name="time-outline" size={18} color={colors.navy} />
                        </View>
                        <View style={styles.recentCopy}>
                          <Text style={styles.recentText} numberOfLines={1}>
                            {item.address}
                          </Text>
                          <Text style={styles.recentSub}>{item.subtitle}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ) : (
                <EmptyDashboardCard
                  icon="compass-outline"
                  title="Start with a destination"
                  body="Your recent places will appear here after completed trips."
                  cta="Choose destination"
                  onPress={openMap}
                />
              )}

              <PromoActionCard
                title="Ride with more certainty"
                body="Pick a destination first, then review the route and fare before booking."
                cta="Plan ride"
                icon="sparkles"
                onPress={openMap}
              />

              <SectionHeader
                title="For you"
                actionLabel="All"
                onPress={() => router.push('/(app)/(tabs)/services')}
              />
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <ServiceTile label="Trip" icon="navigate-outline" badge="Ready" onPress={openMap} />
                </View>
                <View style={styles.gridItem}>
                  <ServiceTile label="Intercity" icon="map-outline" onPress={() => comingSoon('Intercity')} />
                </View>
                <View style={styles.gridItem}>
                  <ServiceTile label="Rentals" icon="key-outline" onPress={() => comingSoon('Rentals')} />
                </View>
                <View style={styles.gridItem}>
                  <ServiceTile label="Bus tickets" icon="bus-outline" onPress={() => comingSoon('Bus tickets')} />
                </View>
                <View style={styles.gridItem}>
                  <ServiceTile label="Reserve" icon="calendar-outline" onPress={() => comingSoon('Reserve')} />
                </View>
                <View style={styles.gridItem}>
                  <ServiceTile label="Parcel" icon="cube-outline" onPress={() => comingSoon('Parcel delivery')} />
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderBlock({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.headerBody}>{body}</Text>
    </View>
  );
}

function TopTabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.topTab, active && styles.topTabActive]}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={18} color={active ? colors.white : colors.textSecondary} />
      <Text style={[styles.topTabLabel, active && styles.topTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <PressableScale onPress={onPress} pressedScale={0.92} haptic="selection" accessibilityLabel={actionLabel}>
          <View style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.navy} />
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

function StatusCard({
  icon,
  title,
  body,
  tint,
  soft,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tint: string;
  soft: string;
}) {
  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusBody}>{body}</Text>
    </View>
  );
}

function EmptyDashboardCard({
  icon,
  title,
  body,
  cta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.rider} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
      <PressableScale onPress={onPress} pressedScale={0.94} haptic="selection" accessibilityLabel={cta}>
        <View style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>{cta}</Text>
        </View>
      </PressableScale>
    </View>
  );
}

function SkeletonCard() {
  const opacity = useSharedValue(0.42);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.skeletonCard, animatedStyle]}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeletonRow, item > 0 && styles.recentRowBorder]}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonCopy}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineShort} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  section: {
    gap: 18,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...type.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...type.title,
    fontFamily: fonts.heavy,
    color: colors.navy,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: withAlpha(colors.teal, 0x22),
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.teal,
  },
  headerBlock: {
    gap: 6,
    marginTop: 4,
  },
  headerBody: {
    ...type.body,
    color: colors.textSecondary,
  },
  topTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  topTab: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  topTabActive: {
    backgroundColor: colors.navy,
    boxShadow: elevationShadows.soft,
  },
  topTabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  topTabLabelActive: {
    color: colors.white,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusCard: {
    flex: 1,
    minHeight: 132,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusTitle: {
    ...type.label,
    color: colors.textPrimary,
  },
  statusBody: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    ...type.heading,
    color: colors.navy,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sectionActionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.navy,
  },
  recentsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 64,
  },
  recentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  recentIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentText: {
    ...type.label,
    color: colors.textPrimary,
  },
  recentSub: {
    ...type.caption,
    color: colors.textMuted,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.rider, 0x12),
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    ...type.label,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...type.caption,
    color: colors.textSecondary,
  },
  emptyButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 20,
  },
  gridItem: {
    width: '33.33%',
    alignItems: 'center',
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 64,
  },
  skeletonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonCopy: {
    flex: 1,
    gap: 7,
  },
  skeletonLineWide: {
    width: '72%',
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonLineShort: {
    width: '38%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceElevated,
  },
});
