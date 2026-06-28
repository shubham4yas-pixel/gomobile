import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  /** Star glyph size in px. */
  size?: number;
  /** Fill color for selected stars. */
  color?: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Interactive 5-star rating row (Phase 9).
 *
 * Tapping a star selects that value (and everything below it). A light
 * selection haptic fires per tap to match the app's tactile feedback.
 */
export function StarRating({
  value,
  onChange,
  size = 40,
  color = colors.warning,
}: StarRatingProps) {
  return (
    <View style={styles.row}>
      {STARS.map((star) => {
        const filled = star <= value;
        return (
          <Pressable
            key={star}
            hitSlop={6}
            style={styles.star}
            onPress={() => {
              haptics.selection();
              onChange(star);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? color : colors.hairlineStrong}
            />
          </Pressable>
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
