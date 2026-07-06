import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fonts, elevationShadows } from '@/theme/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptics } from '@/lib/haptics';

/**
 * WhereToPill — the primary home search entry.
 *
 * A tactile white pill with a bold "Where to?" prompt and a nested scheduling
 * chip. The pill navigates to the booking flow; the chip is its own press
 * target.
 */
export function WhereToPill({
  onPress,
  onPressLater,
}: {
  onPress: () => void;
  onPressLater?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} haptic="light" accessibilityLabel="Where to? Open destination search">
      <View style={styles.pill}>
        <Ionicons name="search" size={22} color={colors.navy} />
        <Text style={styles.prompt}>Where to?</Text>
        {onPressLater ? (
          <Pressable
            style={({ pressed }) => [styles.laterChip, pressed && styles.laterChipPressed]}
            onPress={() => {
              haptics.selection();
              onPressLater();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Schedule a ride for later"
          >
            <Ionicons name="calendar-outline" size={16} color={colors.navy} />
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 62,
    paddingLeft: 20,
    paddingRight: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.floating,
  },
  prompt: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: 0,
    color: colors.navy,
  },
  laterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  laterChipPressed: {
    backgroundColor: colors.hairline,
  },
  laterText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.navy,
  },
});
