import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import { getDriverProfile } from '@/lib/driverProfile';
import { fetchRideHistory, TripRecord } from '@/services/apiService';
import { haptics } from '@/lib/haptics';
import {
  colors,
  radius,
  spacing,
  typography,
  shadows,
  withAlpha,
  accentFor,
} from '@/theme/theme';

/**
 * Ride History screen (Phase 10)
 *
 * Lists a user's completed trips, fetched on mount from the dispatch server's
 * `GET /api/history/:userId` endpoint using the authenticated uid + role.
 *   • Rider view  → date · driver name · fare paid
 *   • Driver view → date · distance · fare earned
 * Works for both roles; pull-to-refresh re-fetches. Returns a friendly empty
 * state when there are no trips (or Firestore isn't configured server-side).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic, Intl-free date formatter (consistent on web + Hermes). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${m} ${ampm}`;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
function formatCurrency(n: number, ccy = 'USD'): string {
  const sym = CURRENCY_SYMBOL[ccy] ?? '$';
  return `${sym}${(n ?? 0).toFixed(2)}`;
}

/** A single trip row — renders the rider or driver variant. */
function TripHistoryCard({ trip, role }: { trip: TripRecord; role: 'rider' | 'driver' }) {
  const accent = accentFor(role);

  if (role === 'rider') {
    const profile = getDriverProfile(trip.driverId);
    return (
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: withAlpha(accent, 0x18) }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{profile.initials}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {formatDate(trip.date)}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {profile.car} · {trip.distanceKm} km
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.fare, { color: accent }]}>{formatCurrency(trip.fare, trip.currency)}</Text>
          <Text style={styles.fareLabel}>Paid</Text>
        </View>
      </View>
    );
  }

  // Driver view
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: withAlpha(accent, 0x18) }]}>
        <Ionicons name="car-sport" size={22} color={accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {formatDate(trip.date)}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {trip.distanceKm} km · {trip.durationMin} min
        </Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.fare, { color: accent }]}>{formatCurrency(trip.fare, trip.currency)}</Text>
        <Text style={styles.fareLabel}>Earned</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const role = (useAuthStore((s) => s.role) ?? 'rider') as 'rider' | 'driver';
  const user = useAuthStore((s) => s.user);
  const accent = accentFor(role);
  const isRider = role === 'rider';

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setTrips([]);
      return;
    }
    const data = await fetchRideHistory(uid, role);
    setTrips(data);
  }, [user?.uid, role]);

  // Fetch on mount (and whenever the user/role changes).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.selection();
    await load();
    setRefreshing(false);
  }, [load]);

  const goBack = useCallback(() => {
    haptics.selection();
    router.back();
  }, [router]);

  const totalFare = trips.reduce((sum, t) => sum + (t.fare || 0), 0);
  const currency = trips[0]?.currency ?? 'USD';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — "Back to Map" + title */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          <Text style={styles.backText}>Map</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Your Rides</Text>
        {/* Spacer to keep the title centered */}
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.centerText}>Loading your rides…</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: withAlpha(accent, 0x14) }]}>
            <Ionicons name="receipt-outline" size={34} color={accent} />
          </View>
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptySub}>
            {isRider
              ? 'Your completed trips will show up here after your first ride.'
              : 'Trips you complete will show up here with your earnings.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.tripId}
          renderItem={({ item }) => <TripHistoryCard trip={item} role={role} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryCount}>
                {trips.length} {trips.length === 1 ? 'ride' : 'rides'}
              </Text>
              <Text style={[styles.summaryFare, { color: accent }]}>
                {formatCurrency(totalFare, currency)} {isRider ? 'spent' : 'earned'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72, gap: 2 },
  backText: { color: colors.textPrimary, fontSize: 16, fontWeight: typography.weightMedium },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: typography.weightBold },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  centerText: { color: colors.textSecondary, fontSize: 15 },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: typography.weightBold },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
  },
  summaryCount: { color: colors.textSecondary, fontSize: 14, fontWeight: typography.weightMedium },
  summaryFare: { fontSize: 16, fontWeight: typography.weightBold },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: typography.weightBold },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: typography.weightBold },
  cardSub: { color: colors.textSecondary, fontSize: 13 },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
  cardRight: { alignItems: 'flex-end' },
  fare: { fontSize: 17, fontWeight: typography.weightHeavy },
  fareLabel: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
});
