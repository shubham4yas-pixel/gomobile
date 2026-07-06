import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { PROVIDER_GOOGLE } from '@/components/MapView';
import { LIGHT_MAP_STYLE } from '@/config/mapStyle';
import { haptics } from '@/lib/haptics';
import { useRideStore } from '@/store/useRideStore';
import { useLocationStore } from '@/store/useLocationStore';
import {
  searchPlaces,
  resolvePlace,
  reverseGeocode,
  PlaceSuggestion,
  SearchSource,
} from '@/services/geocoding';
import { colors, radius, spacing, withAlpha, fonts } from '@/theme/theme';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/**
 * Destination picker (modal).
 *
 * Two ways to set "Where to?": type-to-search (Google Places, with a device
 * geocoder fallback) or drop a pin on the map. Writes the chosen destination to
 * the ride store and pops back to the map.
 */
export default function DestinationScreen() {
  const router = useRouter();
  const setDropoffLocation = useRideStore((s) => s.setDropoffLocation);
  const setRideStatus = useRideStore((s) => s.setStatus);
  const userLocation = useLocationStore((s) => s.userLocation);

  const [mode, setMode] = useState<'search' | 'map'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [source, setSource] = useState<SearchSource>('none');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const initialRegion: Region = {
    latitude: userLocation?.latitude ?? 37.7749,
    longitude: userLocation?.longitude ?? -122.4194,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
  const [region, setRegion] = useState<Region>(initialRegion);

  // ─── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSource('none');
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const { results: r, source: src } = await searchPlaces(q);
      setResults(r);
      setSource(src);
      setLoading(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  const commit = useCallback(
    (lat: number, lng: number, label: string) => {
      haptics.success();
      setDropoffLocation({ latitude: lat, longitude: lng, formattedAddress: label });
      setRideStatus('CONFIRMING');
      router.back();
    },
    [setDropoffLocation, setRideStatus, router]
  );

  const onPickSuggestion = useCallback(
    async (s: PlaceSuggestion) => {
      setResolving(true);
      const place = await resolvePlace(s);
      setResolving(false);
      if (place) commit(place.lat, place.lng, place.label);
    },
    [commit]
  );

  const onConfirmPin = useCallback(async () => {
    setResolving(true);
    const label = await reverseGeocode(region.latitude, region.longitude);
    setResolving(false);
    commit(region.latitude, region.longitude, label);
  }, [region, commit]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Set destination</Text>
        <View style={styles.closeBtn} />
      </View>

      {/* Mode toggle */}
      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, mode === 'search' && styles.toggleBtnActive]}
          onPress={() => {
            haptics.selection();
            setMode('search');
          }}
        >
          <Text style={[styles.toggleText, mode === 'search' && styles.toggleTextActive]}>
            🔍  Search
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, mode === 'map' && styles.toggleBtnActive]}
          onPress={() => {
            haptics.selection();
            setMode('map');
          }}
        >
          <Text style={[styles.toggleText, mode === 'map' && styles.toggleTextActive]}>
            📍  Pin on map
          </Text>
        </Pressable>
      </View>

      {mode === 'search' ? (
        <View style={styles.searchWrap}>
          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>⌕</Text>
            <TextInput
              style={styles.input}
              placeholder="Search address or place"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {loading ? <ActivityIndicator size="small" color={colors.rider} /> : null}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.results}>
            {query.trim().length < 3 ? (
              <Text style={styles.hint}>Type at least 3 characters to search.</Text>
            ) : !loading && results.length === 0 ? (
              <Text style={styles.hint}>
                No matches. Try a different term or use “Pin on map”.
              </Text>
            ) : (
              results.map((r) => (
                <Pressable key={r.id} style={styles.resultRow} onPress={() => onPickSuggestion(r)}>
                  <View style={styles.resultPin}>
                    <Text style={styles.resultPinIcon}>📍</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    {r.subtitle ? (
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {r.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}

            {source === 'device' && results.length > 0 ? (
              <Text style={styles.sourceNote}>
                Showing device results (enable the Places API for richer search).
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            customMapStyle={LIGHT_MAP_STYLE}
            userInterfaceStyle="light"
            onRegionChangeComplete={(r: Region) => setRegion(r)}
          />
          {/* Center pin */}
          <View pointerEvents="none" style={styles.centerPin}>
            <Text style={styles.centerPinIcon}>📍</Text>
          </View>

          <View style={styles.mapFooter}>
            <Pressable style={styles.confirmBtn} onPress={onConfirmPin} disabled={resolving}>
              {resolving ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Text style={styles.confirmText}>Set this location</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {resolving && mode === 'search' ? (
        <View style={styles.resolveOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.rider} />
        </View>
      ) : null}
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
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.bold },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bold },

  toggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.surfaceElevated },
  toggleText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.medium },
  toggleTextActive: { color: colors.textPrimary, fontFamily: fonts.bold },

  searchWrap: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  inputIcon: { color: colors.textSecondary, fontSize: 20 },
  input: { flex: 1, color: colors.textPrimary, fontSize: 16, fontFamily: fonts.medium },

  results: { flex: 1, marginTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: 14, paddingVertical: spacing.lg, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  resultPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPinIcon: { fontSize: 18 },
  resultTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.medium },
  resultSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  sourceNote: { color: colors.textMuted, fontSize: 12, paddingVertical: spacing.lg, textAlign: 'center' },

  mapWrap: { flex: 1, marginTop: spacing.md, overflow: 'hidden' },
  centerPin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinIcon: { fontSize: 40, marginBottom: 40 },
  mapFooter: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
  confirmBtn: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.rider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: colors.white, fontSize: 17, fontFamily: fonts.bold },

  resolveOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.background, 0x88),
  },
});
