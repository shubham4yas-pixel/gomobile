import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { searchPlaces, resolvePlace, PlaceSuggestion } from '@/services/geocoding';
import { LocatedPlace } from '@/store/useRideStore';
import { colors, radius, fonts } from '@/theme/theme';

interface DestinationSearchProps {
  onSelected: (place: LocatedPlace) => void;
  onFocus?: () => void;
}

/**
 * Web destination search (Phase 11).
 *
 * The Google Places web service is CORS-blocked in a browser, so on web we reuse
 * the existing `geocoding` service (which transparently falls back to the device
 * geocoder) and render an in-flow result list — no clipping, since it's plain
 * layout inside the bottom sheet. Same `onSelected({lat,lng,address})` contract
 * as the native GooglePlacesAutocomplete variant.
 */
export function DestinationSearch({ onSelected, onFocus }: DestinationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const { results: r } = await searchPlaces(q);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const pick = async (s: PlaceSuggestion) => {
    setResolving(true);
    const place = await resolvePlace(s);
    setResolving(false);
    if (place) {
      onSelected({ latitude: place.lat, longitude: place.lng, formattedAddress: place.label });
    }
  };

  return (
    <View>
      <View style={styles.inputRow}>
        <Text style={styles.icon}>⌕</Text>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="Where to?"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onFocus={onFocus}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading || resolving ? <ActivityIndicator size="small" color={colors.rider} /> : null}
      </View>

      {results.length > 0 ? (
        <View style={styles.listView}>
          {results.map((r) => (
            <Pressable key={r.id} style={styles.row} onPress={() => pick(r)}>
              <Text style={styles.rowPin}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                {r.subtitle ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 56,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  icon: { fontSize: 18, color: colors.textSecondary, marginTop: -2 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  listView: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowPin: { fontSize: 16 },
  rowTitle: { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
