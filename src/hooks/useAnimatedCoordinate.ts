import { useEffect, useRef, useState } from 'react';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Smoothly interpolate a marker coordinate toward a moving target (Phase 12).
 *
 * Driver positions arrive in discrete socket ticks (~3s apart); plotting them
 * raw makes the car teleport between streets. This hook eases from the current
 * rendered position to each new target over `durationMs` using a requestAnimation
 * Frame lerp, emitting plain numeric `{latitude, longitude}` on every frame.
 *
 * It returns plain numbers (not an Animated value) so it works with the regular
 * <Marker> on BOTH native and the web schematic map — no wrapper changes, no
 * react-native-maps AnimatedRegion needed.
 *
 * @param target     the latest known coordinate (or null when none)
 * @param durationMs ease duration; tuned slightly under the broadcast interval
 */
export function useAnimatedCoordinate(
  target: Coordinate | null,
  durationMs = 1200
): Coordinate | null {
  const [coord, setCoord] = useState<Coordinate | null>(target);
  const rafRef = useRef<number | null>(null);
  // The position currently rendered — the start point of the next animation.
  const currentRef = useRef<Coordinate | null>(target);

  useEffect(() => {
    if (!target) return;

    const from = currentRef.current;

    // First fix (or a teleport with no prior position): snap immediately.
    if (!from) {
      currentRef.current = target;
      setCoord(target);
      return;
    }

    // Negligible movement — snap without animating to save frames.
    const dLat = Math.abs(target.latitude - from.latitude);
    const dLng = Math.abs(target.longitude - from.longitude);
    if (dLat < 1e-6 && dLng < 1e-6) {
      currentRef.current = target;
      setCoord(target);
      return;
    }

    const start = from;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutQuad — quick start, gentle settle (natural vehicle motion).
      const eased = 1 - (1 - t) * (1 - t);
      const next = {
        latitude: start.latitude + (target.latitude - start.latitude) * eased,
        longitude: start.longitude + (target.longitude - start.longitude) * eased,
      };
      currentRef.current = next;
      setCoord(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target?.latitude, target?.longitude, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return coord;
}
