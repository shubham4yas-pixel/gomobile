import { Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, fonts, radius } from '@/theme/theme';

interface FeedbackChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FeedbackChip({ label, selected, onPress }: FeedbackChipProps) {
  return (
    <PressableScale 
      style={[styles.container, selected && styles.selected]}
      onPress={onPress}
      haptic="selection"
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: 8,
    marginBottom: 8,
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.rider,
  },
  label: {
    ...fonts.bodyMedium,
    color: colors.textSecondary,
    fontSize: 14,
  },
  labelSelected: {
    color: colors.rider,
  },
});
