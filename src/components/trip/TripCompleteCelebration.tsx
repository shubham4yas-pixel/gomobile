import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';

/**
 * TripCompleteCelebration (Phase 18) — one-shot gold check pop + confetti
 * burst in brand colors, shown at the top of the rider receipt and driver
 * earnings cards. Plays once (no loop — celebrations that repeat feel cheap).
 * Falls back to a static gold check badge if the animation fails; web builds
 * resolve TripCompleteCelebration.web.tsx.
 */
export function TripCompleteCelebration({ size = 110 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[styles.fallbackBadge, { width: size * 0.4, height: size * 0.4, borderRadius: size * 0.2 }]}>
        <Ionicons name="checkmark" size={size * 0.22} color={colors.white} />
      </View>
    );
  }

  return (
    <LottieView
      source={require('../../../assets/lottie/trip-complete.json')}
      autoPlay
      loop={false}
      style={{ width: size, height: size }}
      onAnimationFailure={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallbackBadge: {
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
