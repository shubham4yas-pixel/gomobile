import { useState } from 'react';
import LottieView from 'lottie-react-native';
import { RadarPulse } from '@/components/trip/RadarPulse';
import { colors } from '@/theme/theme';

interface SearchingRadarProps {
  size?: number;
  /** Ring color family: navy (rider searching) or gold (driver online). */
  tint?: 'navy' | 'gold';
  /** Fallback glyph for the RadarPulse stand-in (web / animation failure). */
  glyph?: string;
}

/**
 * SearchingRadar (Phase 18) — the shared brand radar animation.
 *
 * One Lottie asset serves both roles: the rider's navy "searching for a
 * driver" and the driver's gold "online, scanning for requests" (recolored
 * at render time via colorFilters keyed to the ring layer names — no second
 * asset to keep in sync). Falls back to the Reanimated RadarPulse if the
 * animation fails; web builds resolve SearchingRadar.web.tsx instead, which
 * keeps lottie-react-native out of the web bundle.
 */
export function SearchingRadar({ size = 168, tint = 'navy', glyph = '🚕' }: SearchingRadarProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <RadarPulse
        color={tint === 'gold' ? colors.gold : colors.rider}
        glyph={glyph}
        size={88}
      />
    );
  }

  const goldFilters =
    tint === 'gold'
      ? [
          { keypath: 'ring-1', color: colors.gold },
          { keypath: 'ring-2', color: colors.gold },
          { keypath: 'ring-3', color: colors.gold },
        ]
      : undefined;

  return (
    <LottieView
      source={require('../../../assets/lottie/radar-search.json')}
      autoPlay
      loop
      colorFilters={goldFilters}
      style={{ width: size, height: size }}
      onAnimationFailure={() => setFailed(true)}
    />
  );
}
