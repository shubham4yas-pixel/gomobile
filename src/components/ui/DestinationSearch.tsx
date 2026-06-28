import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';
import { LocatedPlace } from '@/store/useRideStore';
import { colors, radius, typography } from '@/theme/theme';

interface DestinationSearchProps {
  onSelected: (place: LocatedPlace) => void;
  onFocus?: () => void;
}

/**
 * Google Places "session token" — bundles all autocomplete keystrokes + the
 * final Place Details lookup into ONE billable session (cost-efficiency). Rotate
 * it after each selection so the next search starts a fresh session.
 */
function makeSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Native destination search — Google Places Autocomplete (Phase 11).
 *
 * Anti-clipping inside @gorhom/bottom-sheet (the common bug):
 *   1. `InputComp: BottomSheetTextInput` — the field cooperates with the sheet's
 *      keyboard/focus layer (no focus jank).
 *   2. `disableScroll` — predictions render in-flow instead of as a floating,
 *      absolutely-positioned dropdown, so they can't be clipped by the sheet edge.
 *   3. `listView` is styled in normal flow (no absolute positioning) → the sheet's
 *      dynamic sizing grows to include the list.
 *   4. `keyboardShouldPersistTaps="handled"` — a tap on a result registers instead
 *      of being eaten by keyboard dismissal.
 * The parent lifts the sheet on focus (see map.tsx BottomSheet keyboardBehavior).
 *
 * Web uses DestinationSearch.web.tsx (Places web service is CORS-blocked in a browser).
 */
export function DestinationSearch({ onSelected, onFocus }: DestinationSearchProps) {
  const [sessionToken, setSessionToken] = useState(makeSessionToken);

  return (
    <GooglePlacesAutocomplete
      placeholder="Where to?"
      fetchDetails
      disableScroll
      keyboardShouldPersistTaps="handled"
      enablePoweredByContainer={false}
      minLength={2}
      debounce={250}
      predefinedPlaces={[]}
      query={{ key: GOOGLE_MAPS_API_KEY, language: 'en', sessiontoken: sessionToken }}
      GooglePlacesDetailsQuery={{ sessiontoken: sessionToken }}
      textInputProps={{
        InputComp: BottomSheetTextInput,
        placeholderTextColor: colors.textMuted,
        autoCorrect: false,
        returnKeyType: 'search',
        onFocus,
      }}
      onPress={(data, details = null) => {
        const loc = (details as any)?.geometry?.location;
        if (!loc) return;
        onSelected({
          latitude: loc.lat,
          longitude: loc.lng,
          formattedAddress:
            (details as any)?.formatted_address ?? data?.description ?? 'Selected destination',
        });
        // End this Places billing session; start a fresh one for the next search.
        setSessionToken(makeSessionToken());
      }}
      onFail={(e) => console.warn('[Places] error:', e)}
      renderLeftButton={() => (
        <View style={styles.leftIcon}>
          <Text style={styles.leftIconGlyph}>⌕</Text>
        </View>
      )}
      renderRow={(row: any) => (
        <View style={styles.row}>
          <Text style={styles.rowPin}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {row?.structured_formatting?.main_text ?? row?.description}
            </Text>
            {row?.structured_formatting?.secondary_text ? (
              <Text style={styles.rowSub} numberOfLines={1}>
                {row.structured_formatting.secondary_text}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      styles={{
        container: gpa.container,
        textInputContainer: gpa.textInputContainer,
        textInput: gpa.textInput,
        listView: gpa.listView,
        separator: gpa.separator,
      }}
    />
  );
}

const styles = StyleSheet.create({
  leftIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    marginRight: 10,
    alignSelf: 'center',
  },
  leftIconGlyph: { fontSize: 18, color: colors.textSecondary, marginTop: -2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowPin: { fontSize: 16 },
  rowTitle: { fontSize: 15, fontWeight: typography.weightMedium, color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});

// GooglePlacesAutocomplete-specific style slots (kept separate from RN StyleSheet
// since some slots expect plain objects).
const gpa = {
  container: { flex: 0 },
  textInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 56,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  textInput: {
    flex: 1,
    height: 54,
    fontSize: 16,
    fontWeight: typography.weightMedium as any,
    color: colors.textPrimary,
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  listView: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    overflow: 'hidden' as const,
  },
  separator: { height: 1, backgroundColor: colors.hairline },
};
