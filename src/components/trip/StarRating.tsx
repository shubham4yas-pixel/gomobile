import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  /** Star glyph size in px. */
  size?: number;
  /** Fill color for selected stars. Defaults to the premium gold accent. */
  color?: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Interactive 5-star rating row (Phase 9; gold + spring pop in Phase 18).
 *
 * Tapping a star selects that value (and everything below it). Each star is a
 * PressableScale with a deep pressed scale, so the tap has a satisfying pop,
 * plus the shared selection haptic.
 */
export function StarRating({
  value,
  onChange,
  size = 40,
  color = colors.gold,
}: StarRatingProps) {
  return (
    <View style={styles.row}>
      {STARS.map((star) => {
        const filled = star <= value;
        return (
          <PressableScale
            key={star}
            hitSlop={6}
            style={styles.star}
            pressedScale={0.78}
            haptic="selection"
            onPress={() => onChange(star)}
            accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? color : colors.hairlineStrong}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  star: {
    padding: 2,
  },
});
