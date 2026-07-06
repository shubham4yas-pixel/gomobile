import { logger } from '@/lib/logger';
import { Platform } from 'react-native';

/**
 * REST API service (Phase 10)
 *
 * Thin helpers over the dispatch server's REST endpoints. Mirrors the host
 * split used by `socketService` — web talks to localhost, native devices talk
 * to the dev machine's LAN IP. Keep this URL in sync with socketService.
 */
// Mirrors socketService — prefers EXPO_PUBLIC_SOCKET_URL (ngrok/deployed), else
// the platform dev defaults. Keep in sync with socketService / paymentService.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  (Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.243.3.247:3001');

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
  // `address` is the formatted label captured at booking time (Phase 14); older
  // trips persisted before then carry coordinates only (address undefined).
  pickup?: { lat: number; lng: number; address?: string | null };
  dropoff?: { lat: number; lng: number; address?: string | null };
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
      logger.warn(`[apiService] history fetch failed: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? (data as TripRecord[]) : [];
  } catch (e) {
    logger.warn('[apiService] history fetch error:', e);
    return [];
  }
}
