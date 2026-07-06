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
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import { getDriverProfile } from '@/lib/driverProfile';
import { fetchRideHistory, TripRecord } from '@/services/apiService';
import { haptics } from '@/lib/haptics';
import { colors, radius, spacing, shadows, withAlpha, accentFor, fonts } from '@/theme/theme';

/**
 * Rider Ride History screen (Phase 10 → enriched Phase 14)
 *
 * Lists a rider's completed trips, fetched on mount from the dispatch server's
 * `GET /api/history/:userId?role=rider` endpoint (filtered by the authenticated
 * uid). Each row shows the date, the pickup → dropoff route, and the fare paid.
 * Pull-to-refresh re-fetches; a friendly empty state covers no-trips / Firestore
 * unconfigured. Drivers are redirected to their Earnings Dashboard.
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

/**
 * A readable label for a trip endpoint. Prefers the address captured at booking
 * (Phase 14); falls back to compact coordinates for trips persisted before
 * addresses were stored, and to a dash when nothing is available.
 */
function formatPoint(point?: { lat: number; lng: number; address?: string | null }): string {
  if (!point) return 'Unknown location';
  if (point.address && point.address.trim()) return point.address.trim();
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
  }
  return 'Unknown location';
}

/** A single ride row — date header, pickup → dropoff route, fare. */
function RideHistoryCard({ trip }: { trip: TripRecord }) {
  const accent = accentFor('rider');
  const profile = getDriverProfile(trip.driverId);

  return (
    <View style={styles.card}>
      {/* Top line: date + fare */}
      <View style={styles.cardHead}>
        <Text style={styles.cardDate} numberOfLines={1}>
          {formatDate(trip.date)}
        </Text>
        <View style={styles.fareWrap}>
          <Text style={[styles.fare, { color: accent }]}>
            {formatCurrency(trip.fare, trip.currency)}
          </Text>
          <Text style={styles.fareLabel}>Paid</Text>
        </View>
      </View>

      {/* Route: pickup → dropoff with a connecting rail */}
      <View style={styles.route}>
        <View style={styles.rail}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <View style={styles.railLine} />
          <View style={[styles.dot, styles.square, { backgroundColor: colors.danger }]} />
        </View>
        <View style={styles.routeBody}>
          <Text style={styles.routeText} numberOfLines={1}>
            {formatPoint(trip.pickup)}
          </Text>
          <Text style={[styles.routeText, styles.routeDrop]} numberOfLines={1}>
            {formatPoint(trip.dropoff)}
          </Text>
        </View>
      </View>

      {/* Footer: driver + distance */}
      <View style={styles.cardFoot}>
        <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.footText} numberOfLines={1}>
          {profile.name} · {profile.car} · {trip.distanceKm} km
        </Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const role = (useAuthStore((s) => s.role) ?? 'rider') as 'rider' | 'driver';
  const user = useAuthStore((s) => s.user);
  const accent = accentFor('rider');

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setTrips([]);
      return;
    }
    const data = await fetchRideHistory(uid, 'rider');
    setTrips(data);
  }, [user?.uid]);

  // Fetch on mount (and whenever the user changes).
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

  // Drivers get the Earnings Dashboard instead of a plain ride list (Phase 14).
  if (role === 'driver') {
    return <Redirect href="/earnings" />;
  }

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
            Your completed trips will show up here after your first ride.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.tripId}
          renderItem={({ item }) => <RideHistoryCard trip={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryCount}>
                {trips.length} {trips.length === 1 ? 'ride' : 'rides'}
              </Text>
              <Text style={[styles.summaryFare, { color: accent }]}>
                {formatCurrency(totalFare, currency)} spent
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
  backText: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.medium },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bold },

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
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bold },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
  },
  summaryCount: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.medium },
  summaryFare: { fontSize: 16, fontFamily: fonts.bold },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardDate: { flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium },
  fareWrap: { alignItems: 'flex-end', marginLeft: spacing.md },
  fare: { fontSize: 18, fontFamily: fonts.heavy },
  fareLabel: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  route: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 12, alignItems: 'center', paddingTop: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  square: { borderRadius: 3 },
  railLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.hairlineStrong, marginVertical: 3 },
  routeBody: { flex: 1, justifyContent: 'space-between' },
  routeText: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.medium },
  routeDrop: { marginTop: spacing.lg },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  footText: { flex: 1, color: colors.textMuted, fontSize: 12 },
});
