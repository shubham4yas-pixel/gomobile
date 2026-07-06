import { logger } from '@/lib/logger';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';
import { LocatedPlace } from '@/store/useRideStore';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, radius, fonts, type, spacing, withAlpha, elevationShadows } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

interface DestinationSearchProps {
  onSelected: (place: LocatedPlace) => void;
  onFocus?: () => void;
}

type StoredPlace = LocatedPlace & {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: number;
};

const MAX_RECENTS = 6;
const MAX_VISIBLE_LOCAL = 3;

/**
 * Google Places session token. It bundles autocomplete keystrokes plus the
 * final Place Details lookup into one billable session. Rotate after selection.
 */
function makeSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function storageKey(scope: string, kind: 'recent' | 'saved') {
  return `destinationSearch:${kind}:v1:${scope}`;
}

function isStoredPlace(value: any): value is StoredPlace {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.formattedAddress === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number'
  );
}

function parsePlaces(raw: string | null): StoredPlace[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(isStoredPlace);
  } catch {
    return [];
  }
}

function placeTitle(data: any, formattedAddress: string) {
  return data?.structured_formatting?.main_text ?? formattedAddress.split(',')[0]?.trim() ?? formattedAddress;
}

function placeSubtitle(data: any, formattedAddress: string) {
  return data?.structured_formatting?.secondary_text ?? formattedAddress.split(',').slice(1).join(',').trim();
}

function toStoredPlace(data: any, place: LocatedPlace): StoredPlace {
  return {
    ...place,
    id: data?.place_id ?? `${place.latitude}:${place.longitude}:${place.formattedAddress}`,
    title: placeTitle(data, place.formattedAddress),
    subtitle: placeSubtitle(data, place.formattedAddress),
    updatedAt: Date.now(),
  };
}

function iconForPrediction(row: any): keyof typeof Ionicons.glyphMap {
  const types = Array.isArray(row?.types) ? row.types : [];
  if (types.includes('airport')) return 'airplane-outline';
  if (types.includes('transit_station') || types.includes('bus_station') || types.includes('subway_station')) {
    return 'train-outline';
  }
  if (types.includes('restaurant') || types.includes('cafe')) return 'restaurant-outline';
  if (types.includes('lodging')) return 'bed-outline';
  if (types.includes('school') || types.includes('university')) return 'school-outline';
  if (types.includes('hospital')) return 'medical-outline';
  return 'location-outline';
}

export function DestinationSearch({ onSelected, onFocus }: DestinationSearchProps) {
  const { user } = useAuthStore();
  const scope = user?.uid ?? 'guest';
  const [sessionToken, setSessionToken] = useState(makeSessionToken);
  const [queryText, setQueryText] = useState('');
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<StoredPlace[]>([]);
  const [isHydratingLocal, setIsHydratingLocal] = useState(true);
  const [nearbyLocation, setNearbyLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLocalPlaces() {
      setIsHydratingLocal(true);
      try {
        const [recentRaw, savedRaw] = await Promise.all([
          AsyncStorage.getItem(storageKey(scope, 'recent')),
          AsyncStorage.getItem(storageKey(scope, 'saved')),
        ]);
        if (cancelled) return;
        setRecentPlaces(parsePlaces(recentRaw).slice(0, MAX_RECENTS));
        setSavedPlaces(parsePlaces(savedRaw).slice(0, MAX_RECENTS));
      } finally {
        if (!cancelled) setIsHydratingLocal(false);
      }
    }

    void hydrateLocalPlaces();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateNearbyBias() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 2000,
        });
        const position =
          lastKnown ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));

        if (!cancelled) {
          setNearbyLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch {
        if (!cancelled) setNearbyLocation(null);
      }
    }

    void hydrateNearbyBias();
    return () => {
      cancelled = true;
    };
  }, []);

  const placesQuery = useMemo(
    () => ({
      key: GOOGLE_MAPS_API_KEY,
      language: 'en',
      sessiontoken: sessionToken,
      ...(nearbyLocation
        ? {
            location: `${nearbyLocation.latitude},${nearbyLocation.longitude}`,
            radius: 30000,
          }
        : {}),
    }),
    [nearbyLocation, sessionToken]
  );

  const saveRecentPlace = useCallback(
    (place: StoredPlace) => {
      setRecentPlaces((current) => {
        const next = [place, ...current.filter((item) => item.id !== place.id)].slice(0, MAX_RECENTS);
        AsyncStorage.setItem(storageKey(scope, 'recent'), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [scope]
  );

  const selectPlace = useCallback(
    (place: StoredPlace) => {
      saveRecentPlace({ ...place, updatedAt: Date.now() });
      onSelected({
        latitude: place.latitude,
        longitude: place.longitude,
        formattedAddress: place.formattedAddress,
      });
      setSessionToken(makeSessionToken());
    },
    [onSelected, saveRecentPlace]
  );

  const showLocalPanel = queryText.trim().length < 2;

  return (
    <View>
      <GooglePlacesAutocomplete
        placeholder="Search destination"
        fetchDetails
        keyboardShouldPersistTaps="always"
        enablePoweredByContainer={false}
        minLength={2}
        debounce={220}
        keepResultsAfterBlur
        listViewDisplayed="auto"
        disableScroll={false}
        isRowScrollable={false}
        timeout={12000}
        listEmptyComponent={<EmptyState query={queryText} hasNearbyBias={Boolean(nearbyLocation)} />}
        listLoaderComponent={<LoaderState />}
        query={placesQuery}
        GooglePlacesDetailsQuery={{ sessiontoken: sessionToken }}
        textInputProps={{
          InputComp: BottomSheetTextInput,
          placeholderTextColor: colors.textMuted,
          autoCorrect: false,
          autoCapitalize: 'words',
          returnKeyType: 'search',
          enablesReturnKeyAutomatically: true,
          clearButtonMode: 'while-editing',
          onChangeText: setQueryText,
          onFocus,
        }}
        onPress={(data, details = null) => {
          const loc = (details as any)?.geometry?.location;
          if (!loc) return;
          const formattedAddress =
            (details as any)?.formatted_address ?? data?.description ?? 'Selected destination';
          const selected: LocatedPlace = {
            latitude: loc.lat,
            longitude: loc.lng,
            formattedAddress,
          };
          const stored = toStoredPlace(data, selected);
          saveRecentPlace(stored);
          onSelected(selected);
          setSessionToken(makeSessionToken());
        }}
        onFail={(e) => logger.warn('[Places] error:', e)}
        renderLeftButton={() => (
          <View style={styles.leftIcon}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
          </View>
        )}
        renderRow={(row: any, index: number) => {
          const title = row?.structured_formatting?.main_text ?? row?.description;
          const sub = row?.structured_formatting?.secondary_text;
          const icon = iconForPrediction(row);

          return (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 10) * 32).duration(220)}
              style={styles.row}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={18} color={colors.rider} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                {sub ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          );
        }}
        styles={{
          container: gpa.container,
          textInputContainer: gpa.textInputContainer,
          textInput: gpa.textInput,
          listView: gpa.listView,
          separator: gpa.separator,
        }}
      />

      {showLocalPanel ? (
        <LocalSuggestionsPanel
          isLoading={isHydratingLocal}
          savedPlaces={savedPlaces}
          recentPlaces={recentPlaces}
          hasNearbyBias={Boolean(nearbyLocation)}
          onSelect={selectPlace}
        />
      ) : null}
    </View>
  );
}

function LocalSuggestionsPanel({
  isLoading,
  savedPlaces,
  recentPlaces,
  hasNearbyBias,
  onSelect,
}: {
  isLoading: boolean;
  savedPlaces: StoredPlace[];
  recentPlaces: StoredPlace[];
  hasNearbyBias: boolean;
  onSelect: (place: StoredPlace) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.localPanel}>
        <LoaderState />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.localPanel}>
      <SuggestionSection title="Saved places">
        {savedPlaces.length > 0 ? (
          savedPlaces.slice(0, MAX_VISIBLE_LOCAL).map((place) => (
            <SuggestionRow key={place.id} place={place} icon="bookmark-outline" onPress={() => onSelect(place)} />
          ))
        ) : (
          <PlaceholderRow
            icon="bookmark-outline"
            title="No saved places yet"
            body="Home, work, and preferred places will appear here once added."
          />
        )}
      </SuggestionSection>

      <SuggestionSection title="Recent places">
        {recentPlaces.length > 0 ? (
          recentPlaces.slice(0, MAX_VISIBLE_LOCAL).map((place) => (
            <SuggestionRow key={place.id} place={place} icon="time-outline" onPress={() => onSelect(place)} />
          ))
        ) : (
          <PlaceholderRow
            icon="compass-outline"
            title="Search to build recents"
            body="Places you choose are remembered on this device."
          />
        )}
      </SuggestionSection>

      <SuggestionSection title="Nearby">
        <PlaceholderRow
          icon={hasNearbyBias ? 'locate' : 'locate-outline'}
          title={hasNearbyBias ? 'Nearby ranking is active' : 'Nearby ranking is ready'}
          body={
            hasNearbyBias
              ? 'Google Places is prioritising results around your current area.'
              : 'When location is available, search results move closer to you first.'
          }
        />
      </SuggestionSection>
    </Animated.View>
  );
}

function SuggestionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.suggestionSection}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function SuggestionRow({
  place,
  icon,
  onPress,
}: {
  place: StoredPlace;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} haptic="selection" accessibilityLabel={place.title}>
      <View style={styles.localRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.rider} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {place.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {place.subtitle || place.formattedAddress}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </PressableScale>
  );
}

function PlaceholderRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.placeholderRow}>
      <View style={styles.placeholderIcon}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderBody}>{body}</Text>
      </View>
    </View>
  );
}

function EmptyState({ query, hasNearbyBias }: { query: string; hasNearbyBias: boolean }) {
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="search-outline" size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No places found</Text>
      <Text style={styles.emptySub}>
        Try a more specific address or landmark{query ? ` for "${query.trim()}"` : ''}.
      </Text>
      <Text style={styles.emptyHint}>
        {hasNearbyBias ? 'Results are prioritised near you.' : 'Location bias will apply when available.'}
      </Text>
    </Animated.View>
  );
}

function SkeletonRow({ index }: { index: number }) {
  const opacity = useSharedValue(0.42);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 780 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.row, animatedStyle]} entering={FadeInDown.delay(index * 45).duration(220)}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]} />
      <View style={styles.skeletonCopy}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineShort} />
      </View>
    </Animated.View>
  );
}

function LoaderState() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  leftIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    marginRight: spacing.sm,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    minHeight: 58,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.rider, 0x12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...type.label,
    color: colors.textPrimary,
  },
  rowSub: {
    ...type.caption,
    color: colors.textMuted,
  },
  localPanel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.soft,
    gap: spacing.lg,
  },
  suggestionSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  sectionRows: {
    gap: 2,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    minHeight: 58,
  },
  placeholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    ...type.label,
    color: colors.textPrimary,
  },
  placeholderBody: {
    ...type.caption,
    color: colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...type.label,
    color: colors.textPrimary,
  },
  emptySub: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyHint: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  skeletonCopy: {
    flex: 1,
    gap: 7,
    paddingVertical: 4,
  },
  skeletonLineWide: {
    height: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 7,
    width: '62%',
  },
  skeletonLineShort: {
    height: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 5,
    width: '42%',
  },
});

const gpa = {
  container: { flex: 0 },
  textInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    height: 58,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    boxShadow: elevationShadows.soft,
  },
  textInput: {
    flex: 1,
    height: 56,
    fontSize: 16,
    fontFamily: fonts.medium as any,
    color: colors.textPrimary,
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  listView: {
    marginTop: spacing.sm,
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    overflow: 'hidden' as const,
    boxShadow: elevationShadows.soft,
  },
  separator: { height: 1, backgroundColor: colors.hairline },
};
