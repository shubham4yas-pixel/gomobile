import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, radius, spacing, withAlpha } from '@/theme/theme';
import type { LiveApproachData } from '@/types/notifications';

/**
 * LiveApproachContent (Phase 20)
 *
 * The body of the live driver-approach banner: driver identity, vehicle,
 * plate, remaining ETA/distance, and an animated progress track that fills as
 * the driver closes in. The parent banner keeps a stable id, so every ETA tick
 * re-renders THIS content in place — the progress bar animates smoothly to its
 * new value instead of the banner re-entering.
 */

interface LiveApproachContentProps {
  live: LiveApproachData;
  accent: string;
}

export function LiveApproachContent({ live, accent }: LiveApproachContentProps) {
  const progress = useSharedValue(live.progress);
  const pulse = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(live.progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [live.progress, progress]);

  // Soft breathing pulse on the ETA while the driver is en route.
  useEffect(() => {
    if (live.phase === 'arrived') {
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [live.phase, pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));
  const etaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const etaLabel =
    live.phase === 'arrived' ? 'Here' : live.etaMin <= 1 ? 'Arriving' : `${live.etaMin} min`;
  const distanceLabel =
    live.distanceKm > 0
      ? live.distanceKm < 1
        ? `${Math.max(50, Math.round(live.distanceKm * 1000))} m away`
        : `${live.distanceKm.toFixed(1)} km away`
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.detailsRow}>
        <View style={styles.identity}>
          <Text style={styles.vehicle} numberOfLines={1}>
            {live.vehicle}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.plateChip}>
              <Text style={styles.plateText}>{live.plate}</Text>
            </View>
            {distanceLabel ? <Text style={styles.distance}>{distanceLabel}</Text> : null}
          </View>
        </View>

        <Animated.View style={[styles.etaWrap, etaStyle]}>
          <Text style={[styles.etaValue, { color: accent }]}>{etaLabel}</Text>
          {live.phase !== 'arrived' && live.etaMin > 1 ? (
            <Text style={styles.etaCaption}>ETA</Text>
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { backgroundColor: accent }, fillStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  vehicle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: withAlpha(colors.navy, 0x14),
    borderWidth: 1,
    borderColor: withAlpha(colors.navy, 0x22),
  },
  plateText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textPrimary,
  },
  distance: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  etaWrap: {
    alignItems: 'center',
    minWidth: 64,
  },
  etaValue: {
    fontFamily: fonts.heavy,
    fontSize: 20,
    lineHeight: 24,
  },
  etaCaption: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.navy, 0x14),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
