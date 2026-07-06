import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

/**
 * Google Static Maps URL builder (Phase 15 — rich notification route image).
 *
 * Produces a minimal route-snapshot image URL: a pickup marker, a dropoff
 * marker, and (optionally) the driver's live position, on a clean styled basemap.
 * Used as the `image`/`bigPicture` attachment in the rider's "driver on the way"
 * rich notification so the system tray shows a live-ish route preview.
 *
 * Requires the **Static Maps API** enabled + billed on GOOGLE_MAPS_API_KEY.
 */

type LatLng = { lat: number; lng: number };

export interface StaticRouteOptions {
  pickup: LatLng;
  dropoff: LatLng;
  /** Optional live driver position — drawn as a distinct marker when present. */
  driver?: LatLng;
  width?: number;
  height?: number;
  scale?: 1 | 2;
}

// A trimmed, label-light style matching the in-app minimal map aesthetic.
const STATIC_STYLE = [
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
  'feature:road|element:labels|visibility:off',
].map((s) => `style=${encodeURIComponent(s)}`);

function marker(color: string, label: string, p: LatLng): string {
  return `markers=${encodeURIComponent(`color:${color}|label:${label}|${p.lat},${p.lng}`)}`;
}

/** Build a Static Maps URL framing pickup → dropoff (+ driver if given). */
export function buildStaticRouteUrl({
  pickup,
  dropoff,
  driver,
  width = 600,
  height = 300,
  scale = 2,
}: StaticRouteOptions): string {
  const parts: string[] = [
    `size=${width}x${height}`,
    `scale=${scale}`,
    marker('0x2563EB', 'P', pickup),
    marker('0x10B981', 'D', dropoff),
    ...STATIC_STYLE,
    `key=${GOOGLE_MAPS_API_KEY}`,
  ];
  if (driver) parts.splice(2, 0, marker('0xF59E0B', 'C', driver));

  // Auto-frames all markers (no explicit center/zoom) so the whole route fits.
  return `https://maps.googleapis.com/maps/api/staticmap?${parts.join('&')}`;
}
