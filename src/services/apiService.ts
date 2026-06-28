import { Platform } from 'react-native';

/**
 * REST API service (Phase 10)
 *
 * Thin helpers over the dispatch server's REST endpoints. Mirrors the host
 * split used by `socketService` — web talks to localhost, native devices talk
 * to the dev machine's LAN IP. Keep this URL in sync with socketService.
 */
const API_BASE_URL =
  Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.243.3.247:3001';

/**
 * A persisted completed trip — mirrors a `completed_trips` Firestore document.
 * `rating` is the rider's score of the driver; `riderRating` is the driver's
 * score of the rider (two-sided accountability). Either may be null if unrated.
 */
export interface TripRecord {
  tripId: string;
  riderId: string;
  driverId: string | null;
  fare: number;
  distanceKm: number;
  durationMin: number;
  currency: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  date: string; // ISO completion timestamp
  createdAtMs?: number;
  status?: string;
  rating: number | null; // rider → driver
  riderRating: number | null; // driver → rider
}

/**
 * Fetch a user's completed-ride history (works for both riders and drivers).
 *
 * Resolves to [] on any failure (network error, non-200, or malformed body) so
 * the UI never has to handle a thrown error — it always gets a valid list.
 */
export async function fetchRideHistory(
  userId: string,
  role: 'rider' | 'driver'
): Promise<TripRecord[]> {
  if (!userId) return [];

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/history/${encodeURIComponent(userId)}?role=${role}`
    );

    if (!res.ok) {
      console.warn(`[apiService] history fetch failed: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? (data as TripRecord[]) : [];
  } catch (e) {
    console.warn('[apiService] history fetch error:', e);
    return [];
  }
}
