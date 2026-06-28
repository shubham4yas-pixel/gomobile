import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, typography } from '@/theme/theme';

interface SearchBarProps {
  onPress?: () => void;
  placeholder?: string;
}

/**
 * "Where to?" entry point. Visual only for now — tapping is a no-op placeholder
 * for the future destination-search flow.
 */
export function SearchBar({ onPress, placeholder = 'Where to?' }: SearchBarProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={[styles.bar, shadows.card]}>
        <View style={styles.iconWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
        </View>
        <Text style={styles.placeholder}>{placeholder}</Text>
        <View style={styles.savedChip}>
          <Text style={styles.savedChipText}>★ Saved</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    height: 56,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: -2,
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  savedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  savedChipText: {
    fontSize: 12,
    fontWeight: typography.weightBold,
    color: colors.textMuted,
  },
});
