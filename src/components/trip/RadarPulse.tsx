import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, withAlpha } from '@/theme/theme';

interface RadarPulseProps {
  color?: string;
  /** Emoji/glyph shown in the core. */
  glyph?: string;
  size?: number;
}

/**
 * Expanding concentric rings that signal an "actively scanning" state — used on
 * the driver's idle (online) sheet.
 */
export function RadarPulse({
  color = colors.driver,
  glyph = '🛰️',
  size = 96,
}: RadarPulseProps) {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: 2400,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );

    const a = makeLoop(ringA, 0);
    const b = makeLoop(ringB, 1200);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [ringA, ringB]);

  const ringStyle = (val: Animated.Value) => ({
    transform: [
      {
        scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }),
      },
    ],
    opacity: val.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
  });

  const ring = { width: size, height: size, borderRadius: size / 2 };
  const core = size * 0.46;

  return (
    <View style={[styles.container, { width: size * 2.2, height: size * 2.2 }]}>
      <Animated.View
        style={[
          styles.ring,
          ring,
          { borderColor: withAlpha(color, 0x99) },
          ringStyle(ringA),
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          ring,
          { borderColor: withAlpha(color, 0x99) },
          ringStyle(ringB),
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: core,
            height: core,
            borderRadius: core / 2,
            backgroundColor: withAlpha(color, 0x22),
            borderColor: color,
            shadowColor: color,
          },
        ]}
      >
        <Text style={{ fontSize: core * 0.42 }}>{glyph}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
});
