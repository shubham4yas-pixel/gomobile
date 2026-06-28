import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/MapView';
import { useAdminStore, AdminTrip } from '@/store/useAdminStore';
import { connectSocket, disconnectSocket, onAdminSync, getSocket } from '@/services/socketService';
import { colors, radius, spacing, typography, withAlpha } from '@/theme/theme';

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const ACTIVE_TRIP_STATES = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];

const STATUS_COLORS: Record<string, string> = {
  SEARCHING: colors.rider,
  OFFERED: colors.warning,
  ACCEPTED: colors.rider,
  ARRIVED: colors.success,
  IN_PROGRESS: colors.warning,
  COMPLETED: colors.textMuted,
};

const shortId = (id: string) =>
  !id ? '—' : id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

const coordStr = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

/**
 * Admin "God Mode" Dashboard (web-optimized)
 *
 * Split-screen: a schematic live fleet map on the left, a dispatch console on
 * the right. Subscribes to the server's `admin:sync` snapshot.
 */
export default function DashboardScreen() {
  const { liveDrivers, liveTrips, connected, lastSyncAt, setSync, setConnected, reset } =
    useAdminStore();
  const mapRef = useRef<MapView>(null);
  const lastFitSig = useRef('');

  // ─── Socket: authenticate as admin + receive full-state syncs ─────────────
  useEffect(() => {
    const adminId = `admin-${Date.now()}`;
    const socket = connectSocket('admin', adminId);

    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const unsub = onAdminSync((data) => {
      setSync(data.drivers || [], data.trips || []);
    });

    return () => {
      unsub();
      const s = getSocket();
      s?.off('connect', onConnect);
      s?.off('disconnect', onDisconnect);
      disconnectSocket();
      reset();
    };
  }, [setConnected, setSync, reset]);

  // ─── Auto-frame the fleet when the set of drivers/trips changes ───────────
  const allPoints = useCallback(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    liveDrivers.forEach((d) => pts.push({ latitude: d.lat, longitude: d.lng }));
    liveTrips.forEach((t) => {
      pts.push({ latitude: t.pickup.lat, longitude: t.pickup.lng });
      pts.push({ latitude: t.dropoff.lat, longitude: t.dropoff.lng });
    });
    return pts;
  }, [liveDrivers, liveTrips]);

  const recenter = useCallback(() => {
    const pts = allPoints();
    if (pts.length === 0) {
      mapRef.current?.animateToRegion(DEFAULT_REGION, 400);
      return;
    }
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: 90, right: 90, bottom: 90, left: 90 },
      animated: true,
    });
  }, [allPoints]);

  const fitSig = useMemo(
    () =>
      liveDrivers.map((d) => d.id).sort().join(',') +
      '|' +
      liveTrips.map((t) => t.id).sort().join(','),
    [liveDrivers, liveTrips]
  );

  useEffect(() => {
    if (fitSig === lastFitSig.current) return; // don't refit on mere position drift
    if (liveDrivers.length === 0 && liveTrips.length === 0) return;
    lastFitSig.current = fitSig;
    recenter();
  }, [fitSig, liveDrivers.length, liveTrips.length, recenter]);

  const activeTrips = liveTrips.filter((t) => ACTIVE_TRIP_STATES.includes(t.status));
  const lastSyncLabel = lastSyncAt
    ? `${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s ago`
    : '—';

  return (
    <View style={styles.root}>
      {/* ═══ LEFT: Live Fleet Map ═══ */}
      <View style={styles.mapPanel}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={false}
          showsMyLocationButton={false}
          userInterfaceStyle="dark"
        >
          {/* Trip routes (active trips only) */}
          {activeTrips.map((t) => (
            <Polyline
              key={`route-${t.id}`}
              coordinates={[
                { latitude: t.pickup.lat, longitude: t.pickup.lng },
                { latitude: t.dropoff.lat, longitude: t.dropoff.lng },
              ]}
              strokeColor={STATUS_COLORS[t.status] || colors.rider}
              strokeWidth={4}
            />
          ))}

          {/* Trip endpoints */}
          {activeTrips.map((t) => (
            <Marker
              key={`pick-${t.id}`}
              coordinate={{ latitude: t.pickup.lat, longitude: t.pickup.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.endpoint, { backgroundColor: colors.rider }]} />
            </Marker>
          ))}
          {activeTrips.map((t) => (
            <Marker
              key={`drop-${t.id}`}
              coordinate={{ latitude: t.dropoff.lat, longitude: t.dropoff.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.endpoint, styles.endpointSquare, { backgroundColor: colors.success }]} />
            </Marker>
          ))}

          {/* Fleet markers */}
          {liveDrivers.map((d) => {
            const c = d.busy ? colors.driver : colors.success;
            return (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.lat, longitude: d.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.fleetDot, { borderColor: c, backgroundColor: withAlpha(c, 0x33) }]}>
                  <Text style={styles.fleetDotEmoji}>🚗</Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Map overlay: title + recenter */}
        <View style={styles.mapOverlay} pointerEvents="box-none">
          <View style={styles.mapBadge}>
            <View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.danger }]} />
            <Text style={styles.mapBadgeText}>FLEET MAP</Text>
          </View>
          <Pressable style={styles.recenterBtn} onPress={recenter}>
            <Text style={styles.recenterText}>⌖ Recenter</Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ RIGHT: Dispatch Console ═══ */}
      <View style={styles.console}>
        <View style={styles.consoleHeader}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerKicker}>GO · GOD MODE</Text>
            <View style={styles.connPill}>
              <View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.danger }]} />
              <Text style={[styles.connText, { color: connected ? colors.success : colors.danger }]}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Dispatch Console</Text>
          <View style={styles.statRow}>
            <Stat label="Drivers" value={String(liveDrivers.length)} accent={colors.success} />
            <Stat label="Active Trips" value={String(activeTrips.length)} accent={colors.warning} />
            <Stat label="All Trips" value={String(liveTrips.length)} accent={colors.rider} />
            <Stat label="Synced" value={lastSyncLabel} accent={colors.textSecondary} />
          </View>
        </View>

        <ScrollView style={styles.consoleBody} contentContainerStyle={styles.consoleBodyContent}>
          {/* Active Fleet */}
          <Text style={styles.sectionTitle}>ACTIVE FLEET</Text>
          {liveDrivers.length === 0 ? (
            <EmptyRow text="No drivers online" />
          ) : (
            liveDrivers.map((d) => {
              const c = d.busy ? colors.driver : colors.success;
              return (
                <View key={d.id} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.cardDot, { backgroundColor: c }]} />
                    <View>
                      <Text style={styles.cardTitle}>🚗 {shortId(d.id)}</Text>
                      <Text style={styles.cardSub}>{coordStr(d.lat, d.lng)}</Text>
                    </View>
                  </View>
                  <View style={[styles.pill, { borderColor: withAlpha(c, 0x66), backgroundColor: withAlpha(c, 0x22) }]}>
                    <Text style={[styles.pillText, { color: c }]}>{d.busy ? 'ON TRIP' : 'AVAILABLE'}</Text>
                  </View>
                </View>
              );
            })
          )}

          {/* Live Trips */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>LIVE TRIPS</Text>
          {liveTrips.length === 0 ? (
            <EmptyRow text="No active trips" />
          ) : (
            liveTrips.map((t) => <TripCard key={t.id} trip={t} />)
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Small presentational helpers ──────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function TripCard({ trip }: { trip: AdminTrip }) {
  const c = STATUS_COLORS[trip.status] || colors.rider;
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.cardDot, { backgroundColor: c }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{shortId(trip.id)}</Text>
          <Text style={styles.cardSub}>
            👤 {shortId(trip.riderId)}  →  🚗 {trip.driverId ? shortId(trip.driverId) : 'unmatched'}
          </Text>
        </View>
      </View>
      <View style={[styles.pill, { borderColor: withAlpha(c, 0x66), backgroundColor: withAlpha(c, 0x22) }]}>
        <Text style={[styles.pillText, { color: c }]}>{trip.status.replace('_', ' ')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  // Map panel
  mapPanel: {
    flex: 1,
    minWidth: 360,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(colors.background, 0xcc),
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  mapBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.weightHeavy,
    letterSpacing: 1.5,
  },
  recenterBtn: {
    backgroundColor: withAlpha(colors.background, 0xcc),
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  recenterText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: typography.weightBold,
  },

  // Markers
  fleetDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetDotEmoji: { fontSize: 14 },
  endpoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
  },
  endpointSquare: { borderRadius: 3 },

  // Console
  console: {
    width: 440,
    maxWidth: '42%',
    backgroundColor: colors.sheet,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  consoleHeader: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerKicker: {
    fontSize: 12,
    fontWeight: typography.weightHeavy,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  connPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  connText: { fontSize: 12, fontWeight: typography.weightHeavy, letterSpacing: 1 },
  headerTitle: {
    fontSize: 26,
    fontWeight: typography.weightHeavy,
    color: colors.textPrimary,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  statValue: { fontSize: 18, fontWeight: typography.weightHeavy },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  consoleBody: { flex: 1 },
  consoleBodyContent: { padding: spacing.xl },
  sectionTitle: {
    fontSize: 12,
    fontWeight: typography.weightHeavy,
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
    gap: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 15, fontWeight: typography.weightBold, color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: typography.weightHeavy, letterSpacing: 0.5 },

  empty: {
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
