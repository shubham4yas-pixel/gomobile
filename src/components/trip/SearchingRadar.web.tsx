import { RadarPulse } from '@/components/trip/RadarPulse';
import { colors } from '@/theme/theme';

interface SearchingRadarProps {
  size?: number;
  /** Ring color family: navy (rider searching) or gold (driver online). */
  tint?: 'navy' | 'gold';
  /** Glyph shown in the RadarPulse center. */
  glyph?: string;
}

/**
 * SearchingRadar — web build (Phase 18).
 *
 * Metro resolves this file on web, keeping `lottie-react-native` (and its
 * `@lottiefiles/dotlottie-react` web peer) out of the web bundle entirely —
 * same platform-split idiom as MapView.web.tsx. The Reanimated RadarPulse
 * stands in for the Lottie animation, tinted to match the role.
 */
export function SearchingRadar({ size: _size = 168, tint = 'navy', glyph = '🚕' }: SearchingRadarProps) {
  return (
    <RadarPulse color={tint === 'gold' ? colors.gold : colors.rider} glyph={glyph} size={88} />
  );
}
