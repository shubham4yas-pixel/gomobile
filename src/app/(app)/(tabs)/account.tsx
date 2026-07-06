import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { User } from 'firebase/auth';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { fetchRideHistory, type TripRecord } from '@/services/apiService';
import { colors, radius, fonts, type, elevationShadows, withAlpha, spacing } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

type ProfileSignal = {
  label: string;
  value: string;
  complete: boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

function getDisplayName(user: User | null) {
  return user?.displayName || user?.email?.split('@')[0] || 'Rider';
}

function getInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'R';
}

function buildSignals({
  avatarUrl,
  phone,
}: {
  avatarUrl: string | null;
  phone: string | null;
}): ProfileSignal[] {
  return [
    { label: 'Avatar', value: avatarUrl ? 'Added' : 'Ready', complete: Boolean(avatarUrl), icon: 'person-circle-outline' },
    { label: 'Phone', value: phone ? 'Verified' : 'Add', complete: Boolean(phone), icon: 'call-outline' },
    { label: 'Emergency', value: 'Add', complete: false, icon: 'medkit-outline' },
    { label: 'Preferences', value: 'Set up', complete: false, icon: 'options-outline' },
  ];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, role, phone, logout } = useAuthStore();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isLoadingJourney, setIsLoadingJourney] = useState(true);

  const isDriver = role === 'driver';
  const displayName = getDisplayName(user);
  const email = user?.email ?? 'No email on file';
  const avatarUrl = user?.photoURL ?? null;
  const contactPhone = phone ?? user?.phoneNumber ?? null;
  const roleLabel = isDriver ? 'Driver profile' : 'Rider profile';

  useEffect(() => {
    if (!user?.uid || !role) {
      setTrips([]);
      setIsLoadingJourney(false);
      return;
    }

    let cancelled = false;
    setIsLoadingJourney(true);
    fetchRideHistory(user.uid, role).then((records) => {
      if (cancelled) return;
      setTrips(records);
      setIsLoadingJourney(false);
    });

    return () => {
      cancelled = true;
    };
  }, [role, user?.uid]);

  const riderRating = useMemo(() => {
    const values = trips
      .map((trip) => (isDriver ? trip.rating : trip.riderRating))
      .filter((value): value is number => typeof value === 'number');
    return average(values);
  }, [isDriver, trips]);

  const signals = useMemo(
    () => buildSignals({ avatarUrl, phone: contactPhone }),
    [avatarUrl, contactPhone]
  );

  const openHistory = () => {
    if (isDriver) router.push('/(app)/earnings');
    else router.push('/(app)/history');
  };

  const placeholder = (label: string) => toast.info(`${label} is coming soon`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.title}>Your ride profile</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={20} color={colors.gold} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(280)} style={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{getInitial(displayName)}</Text>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {email}
                </Text>
                {contactPhone ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {contactPhone}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.roleBadge, isDriver && styles.roleBadgeDriver]}>
                <Text style={[styles.roleBadgeText, isDriver && styles.roleBadgeTextDriver]}>{roleLabel}</Text>
              </View>
            </View>

            <View style={styles.ratingStrip}>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={15} color={colors.gold} />
                <Text style={styles.ratingText}>{riderRating ? riderRating.toFixed(1) : 'New'}</Text>
              </View>
              <Text style={styles.ratingBody}>
                {riderRating
                  ? 'Your rating reflects reviewed completed trips.'
                  : 'Ratings appear after reviewed completed trips.'}
              </Text>
            </View>

            <View style={styles.signalGrid}>
              {signals.map((signal) => (
                <View key={signal.label} style={styles.signal}>
                  <View style={[styles.signalIcon, signal.complete && styles.signalIconComplete]}>
                    <Ionicons
                      name={signal.icon}
                      size={17}
                      color={signal.complete ? colors.teal : colors.textSecondary}
                    />
                  </View>
                  <Text style={styles.signalLabel}>{signal.label}</Text>
                  <Text style={[styles.signalValue, signal.complete && styles.signalValueComplete]}>{signal.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard
              label="Trips"
              value={isLoadingJourney ? '...' : String(trips.length)}
              icon="navigate-outline"
            />
            <MetricCard
              label="Rating"
              value={riderRating ? riderRating.toFixed(1) : 'New'}
              icon="star-outline"
            />
          </View>

          <SectionCard title="Journey">
            <AccountRow
              icon="receipt-outline"
              title={isDriver ? 'Earnings and trips' : 'Ride history'}
              body={isLoadingJourney ? 'Loading your journey summary' : `${trips.length} completed trip${trips.length === 1 ? '' : 's'}`}
              onPress={openHistory}
            />
            <AccountRow
              icon="trophy-outline"
              title="Rating"
              body={riderRating ? `${riderRating.toFixed(1)} average from reviewed trips` : 'Build your rating through completed rides'}
              onPress={() => placeholder('Rating details')}
            />
          </SectionCard>

          <SectionCard title="Saved Places">
            <AccountRow
              icon="home-outline"
              title="Home and work"
              body="Future-ready shortcuts for frequent pickups."
              onPress={() => placeholder('Saved places')}
            />
            <AccountRow
              icon="bookmark-outline"
              title="Favorite stops"
              body="Saved destinations will appear in search."
              onPress={() => placeholder('Favorite stops')}
            />
          </SectionCard>

          <SectionCard title="Safety">
            <AccountRow
              icon="shield-checkmark-outline"
              title="Safety centre"
              body="Trusted ride tools and trip accountability."
              onPress={() => placeholder('Safety centre')}
            />
            <AccountRow
              icon="medkit-outline"
              title="Emergency contact"
              body="Prepared for a future emergency contact field."
              onPress={() => placeholder('Emergency contact')}
            />
          </SectionCard>

          <SectionCard title="Support">
            <AccountRow
              icon="help-circle-outline"
              title="Help"
              body="Get support for trips, payments, and account questions."
              onPress={() => placeholder('Help')}
            />
            <AccountRow
              icon="chatbubble-ellipses-outline"
              title="Report an issue"
              body="A calm path for trip or app feedback."
              onPress={() => placeholder('Issue reporting')}
            />
          </SectionCard>

          <SectionCard title="Settings">
            <AccountRow
              icon="options-outline"
              title="Ride preferences"
              body="Quiet ride, accessibility, and pickup notes can live here."
              onPress={() => placeholder('Ride preferences')}
            />
            <AccountRow
              icon="notifications-outline"
              title="Notifications"
              body="Manage trip, safety, and account alerts."
              onPress={() => placeholder('Notifications')}
            />
          </SectionCard>

          <SectionCard title="Privacy">
            <AccountRow
              icon="lock-closed-outline"
              title="Privacy controls"
              body="Future controls for profile, location, and data visibility."
              onPress={() => placeholder('Privacy controls')}
            />
          </SectionCard>

          <SectionCard title="About">
            <AccountRow
              icon="information-circle-outline"
              title="RideShare Beta"
              body="Production readiness, trust, and reliability in progress."
              onPress={() => placeholder('About RideShare')}
            />
          </SectionCard>

          <PressableScale onPress={() => logout()} pressedScale={0.98} haptic="medium" accessibilityLabel="Sign out">
            <View style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={19} color={colors.danger} />
              <Text style={styles.signOutText}>Sign out</Text>
            </View>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color={colors.rider} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rowsCard}>{children}</View>
    </View>
  );
}

function AccountRow({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} haptic="selection" accessibilityLabel={title}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={19} color={colors.navy} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowLabel}>{title}</Text>
          <Text style={styles.rowBody}>{body}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    ...type.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  title: {
    ...type.title,
    fontFamily: fonts.heavy,
    color: colors.navy,
    marginTop: 3,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0x33),
  },
  content: {
    gap: 16,
  },
  profileCard: {
    gap: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.raised,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(colors.navy, 0x12),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 64,
    height: 64,
  },
  avatarInitial: {
    fontFamily: fonts.heavy,
    fontSize: 26,
    color: colors.navy,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...type.heading,
    color: colors.textPrimary,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.rider, 0x12),
  },
  roleBadgeDriver: {
    backgroundColor: colors.goldSoft,
  },
  roleBadgeText: {
    fontFamily: fonts.heavy,
    fontSize: 10,
    lineHeight: 13,
    color: colors.rider,
    textTransform: 'uppercase',
  },
  roleBadgeTextDriver: {
    color: colors.gold,
  },
  ratingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  ratingText: {
    fontFamily: fonts.heavy,
    fontSize: 13,
    color: colors.navy,
  },
  ratingBody: {
    flex: 1,
    ...type.caption,
    color: colors.textSecondary,
  },
  signalGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signal: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  signalIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  signalIconComplete: {
    backgroundColor: colors.tealSoft,
  },
  signalLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  signalValue: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
  },
  signalValueComplete: {
    color: colors.teal,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: withAlpha(colors.rider, 0x12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: fonts.heavy,
    fontSize: 23,
    lineHeight: 28,
    color: colors.navy,
  },
  metricLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    ...type.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  rowsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...type.label,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowBody: {
    ...type.caption,
    color: colors.textSecondary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.danger, 0x12),
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0x33),
  },
  signOutText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.danger,
  },
});
