import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, withAlpha, fonts } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

const THUMB_SIZE = 56;
const PADDING = 4;

interface SwipeToAcceptProps {
  onAccept: () => void;
  label?: string;
  accent?: string;
}

/**
 * Drag-to-confirm control. The thumb tracks the user's finger; releasing past
 * ~70% of the track (or a direct tap) fires `onAccept`. Built on the
 * react-native-gesture-handler v2 API + Reanimated worklets.
 */
export function SwipeToAccept({
  onAccept,
  label = 'Swipe to Accept',
  accent = colors.success,
}: SwipeToAcceptProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const completed = useSharedValue(false);

  const maxTranslate = Math.max(trackWidth - THUMB_SIZE - PADDING * 2, 0);

  const fire = () => {
    haptics.success();
    onAccept();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (completed.value) return;
      translateX.value = Math.min(Math.max(e.translationX, 0), maxTranslate);
    })
    .onEnd(() => {
      if (maxTranslate > 0 && translateX.value >= maxTranslate * 0.7) {
        translateX.value = withTiming(maxTranslate, { duration: 120 });
        completed.value = true;
        runOnJS(fire)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (completed.value || maxTranslate <= 0) return;
    translateX.value = withTiming(maxTranslate, { duration: 220 });
    completed.value = true;
    runOnJS(fire)();
  });

  const gesture = Gesture.Race(pan, tap);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity:
      maxTranslate > 0
        ? interpolate(
            translateX.value,
            [0, maxTranslate * 0.55],
            [1, 0],
            Extrapolation.CLAMP
          )
        : 1,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE + PADDING * 2,
  }));

  return (
    <View
      style={[styles.track, { borderColor: withAlpha(accent, 0x55) }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Swipe or tap to confirm this action"
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: withAlpha(accent, 0x26) }, fillStyle]}
      />
      <Animated.Text style={[styles.label, { color: accent }, labelStyle]}>
        {label}  ›››
      </Animated.Text>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.thumb, { backgroundColor: accent }, thumbStyle]}>
          <Text style={styles.thumbIcon}>›</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB_SIZE + PADDING * 2,
    borderRadius: (THUMB_SIZE + PADDING * 2) / 2,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: (THUMB_SIZE + PADDING * 2) / 2,
  },
  label: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  thumb: {
    position: 'absolute',
    left: PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  thumbIcon: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.black,
    marginTop: -4,
  },
});
