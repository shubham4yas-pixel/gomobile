import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

/**
 * Destination search + geocoding.
 *
 * Primary path: Google Places Autocomplete + Place Details (real POI search;
 * requires the Places API enabled on the Maps key — works on-device since there's
 * no CORS on native). If that returns a non-OK status (e.g. the API isn't enabled
 * yet), we transparently fall back to the device's native geocoder
 * (`expo-location`), which is free and needs no setup — so typing always resolves
 * to *something*. Reverse geocoding (for the map-pin path) uses the device too.
 */

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  /** Google place id — needs a details lookup to resolve coordinates. */
  placeId?: string;
  /** Present when the suggestion already carries coordinates (device geocoder). */
  coords?: { lat: number; lng: number };
}

export interface ResolvedPlace {
  lat: number;
  lng: number;
  label: string;
}

export type SearchSource = 'google' | 'device' | 'none';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

/** Autocomplete-style search. Tries Google first, falls back to the device geocoder. */
export async function searchPlaces(
  query: string
): Promise<{ results: PlaceSuggestion[]; source: SearchSource }> {
  const q = query.trim();
  if (q.length < 3) return { results: [], source: 'none' };

  // ── Google Places Autocomplete ──────────────────────────────────────────
  try {
    const url = `${PLACES_BASE}/autocomplete/json?input=${encodeURIComponent(
      q
    )}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'OK' && Array.isArray(json.predictions) && json.predictions.length) {
      return {
        source: 'google',
        results: json.predictions.slice(0, 6).map((p: any) => ({
          id: p.place_id,
          title: p.structured_formatting?.main_text ?? p.description,
          subtitle: p.structured_formatting?.secondary_text,
          placeId: p.place_id,
        })),
      };
    }
    // Any other status (REQUEST_DENIED, ZERO_RESULTS, …) → device fallback.
  } catch {
    // network/parse error → device fallback
  }

  // ── Device geocoder fallback ──────────────────────────────────────────────
  try {
    const matches = await Location.geocodeAsync(q);
    if (matches?.length) {
      const results: PlaceSuggestion[] = await Promise.all(
        matches.slice(0, 5).map(async (m, i) => {
          const label = await reverseGeocode(m.latitude, m.longitude);
          return {
            id: `dev-${i}-${m.latitude.toFixed(4)}`,
            title: label !== 'Dropped pin' ? label : q,
            subtitle: `${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}`,
            coords: { lat: m.latitude, lng: m.longitude },
          };
        })
      );
      return { results, source: 'device' };
    }
  } catch {
    // ignore
  }

  return { results: [], source: 'none' };
}

/** Resolve a suggestion to coordinates (Place Details for Google results). */
export async function resolvePlace(s: PlaceSuggestion): Promise<ResolvedPlace | null> {
  if (s.coords) return { lat: s.coords.lat, lng: s.coords.lng, label: s.title };

  if (s.placeId) {
    try {
      const url = `${PLACES_BASE}/details/json?place_id=${s.placeId}&fields=geometry,name,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json.result?.geometry?.location;
      if (loc) {
        return { lat: loc.lat, lng: loc.lng, label: json.result?.name ?? s.title };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/** Coordinates → human label, using the device's native reverse geocoder. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const a = r?.[0];
    if (a) {
      const parts = [a.name, a.street, a.city ?? a.subregion].filter(Boolean);
      const label = Array.from(new Set(parts)).join(', ');
      if (label) return label;
    }
  } catch {
    // ignore
  }
  return 'Dropped pin';
}
