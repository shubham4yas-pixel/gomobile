import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchRideHistory, TripRecord } from '@/services/apiService';
import {
  computeDriverEarnings,
  summarizeEarnings,
  PLATFORM_COMMISSION,
} from '@/lib/earnings';
import { haptics } from '@/lib/haptics';
import { colors, radius, spacing, shadows, withAlpha, accentFor, fonts } from '@/theme/theme';

/**
 * Driver Earnings Dashboard (Phase 14)
 *
 * Fetches the driver's completed trips (`GET /api/history/:userId?role=driver`,
 * filtered by driverId), then computes their NET earnings after the platform
 * commission + gateway fee — the same split the backend writes to the wallet /
 * transaction_ledger (`src/lib/earnings.ts` mirrors `paymentController`). Shows
 * Today / This Week / All-time summary cards plus a list of recent trips with
 * the gross fare and the net kept. Riders are redirected to their ride history.
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
function money(n: number, ccy = 'USD'): string {
  const sym = CURRENCY_SYMBOL[ccy] ?? '$';
  return `${sym}${(n ?? 0).toFixed(2)}`;
}

/** A summary stat card (Today / This Week). */
function StatCard({
  label,
  value,
  hero,
  accent,
}: {
  label: string;
  value: string;
  hero?: boolean;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, hero && { backgroundColor: accent, borderColor: accent }]}>
      <Text style={[styles.statLabel, hero && { color: withAlpha(colors.white, 0xdd) }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, hero ? { color: colors.white } : { color: accent }]}>
        {value}
      </Text>
    </View>
  );
}

/** A single completed-trip row with gross fare + net earned. */
function EarningRow({ trip }: { trip: TripRecord }) {
  const accent = accentFor('driver');
  const { net } = computeDriverEarnings(trip.fare);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: withAlpha(accent, 0x18) }]}>
        <Ionicons name="car-sport" size={20} color={accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {formatDate(trip.date)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {trip.distanceKm} km · {trip.durationMin} min · fare {money(trip.fare, trip.currency)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowNet, { color: accent }]}>+{money(net, trip.currency)}</Text>
        <Text style={styles.rowNetLabel}>Earned</Text>
      </View>
    </View>
  );
}

export default function EarningsScreen() {
  const router = useRouter();
  const role = (useAuthStore((s) => s.role) ?? 'rider') as 'rider' | 'driver';
  const user = useAuthStore((s) => s.user);
  const accent = accentFor('driver');

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setTrips([]);
      return;
    }
    const data = await fetchRideHistory(uid, 'driver');
    setTrips(data);
  }, [user?.uid]);

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

  const summary = useMemo(() => summarizeEarnings(trips), [trips]);
  const currency = trips[0]?.currency ?? 'USD';

  // Riders don't have an earnings dashboard — send them to their ride history.
  if (role === 'rider') {
    return <Redirect href="/history" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          <Text style={styles.backText}>Map</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.centerText}>Crunching your earnings…</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.tripId}
          renderItem={({ item }) => <EarningRow trip={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Summary cards */}
              <View style={styles.statRow}>
                <StatCard label="Today" value={money(summary.today, currency)} hero accent={accent} />
                <StatCard label="This Week" value={money(summary.week, currency)} accent={accent} />
              </View>

              {/* All-time + commission breakdown */}
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>All-time net</Text>
                  <Text style={[styles.breakdownValue, { color: accent }]}>
                    {money(summary.allTime, currency)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Gross fares ({summary.tripCount} {summary.tripCount === 1 ? 'trip' : 'trips'})
                  </Text>
                  <Text style={styles.breakdownValueMuted}>
                    {money(summary.grossAllTime, currency)}
                  </Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownLast]}>
                  <Text style={styles.breakdownLabel}>
                    Platform commission ({Math.round(PLATFORM_COMMISSION * 100)}% + fees)
                  </Text>
                  <Text style={styles.breakdownFee}>−{money(summary.feesAllTime, currency)}</Text>
                </View>
              </View>

              {trips.length > 0 && <Text style={styles.sectionTitle}>Recent trips</Text>}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: withAlpha(accent, 0x14) }]}>
                <Ionicons name="wallet-outline" size={34} color={accent} />
              </View>
              <Text style={styles.emptyTitle}>No earnings yet</Text>
              <Text style={styles.emptySub}>
                Trips you complete will show up here with your net earnings after commission.
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl * 2,
    gap: spacing.md,
  },
  centerText: { color: colors.textSecondary, fontSize: 15 },

  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bold },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  statRow: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: 6,
    ...shadows.card,
  },
  statLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium },
  statValue: { fontSize: 26, fontFamily: fonts.heavy },

  breakdown: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  breakdownLast: { borderBottomWidth: 0 },
  breakdownLabel: { flex: 1, color: colors.textSecondary, fontSize: 14 },
  breakdownValue: { fontSize: 16, fontFamily: fonts.heavy },
  breakdownValueMuted: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bold },
  breakdownFee: { color: colors.danger, fontSize: 15, fontFamily: fonts.bold },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  row: {
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
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bold },
  rowSub: { color: colors.textSecondary, fontSize: 12 },
  rowRight: { alignItems: 'flex-end' },
  rowNet: { fontSize: 16, fontFamily: fonts.heavy },
  rowNetLabel: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
});
