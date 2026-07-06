import Constants from 'expo-constants';

/**
 * Google Maps API key.
 *
 * Reuses the key already configured in app.json for map rendering. Note that
 * the `react-native-maps-directions` route drawing additionally requires the
 * **Directions API** to be enabled (and billing active) on this key — if it
 * isn't, MapDirections calls fail and the map screen falls back to drawing a
 * straight polyline between points.
 */
const fromConfig =
  (Constants.expoConfig?.ios as any)?.config?.googleMapsApiKey ??
  (Constants.expoConfig?.android as any)?.config?.googleMaps?.apiKey;

/**
 * Phase 11: prefer the `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` env var (Expo inlines it
 * at build time) so the same key powers Places Autocomplete, Place Details, and
 * the Directions routes. Falls back to the app.json map key, then a dev default.
 */
export const GOOGLE_MAPS_API_KEY: string =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  fromConfig ??
  '';
