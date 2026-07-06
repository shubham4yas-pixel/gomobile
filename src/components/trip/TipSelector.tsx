import { View, StyleSheet } from 'react-native';
import { FeedbackChip } from './FeedbackChip';

interface TipSelectorProps {
  selectedTip: number | null;
  onSelect: (tip: number | null) => void;
}

const TIP_OPTIONS = [
  { label: 'No Tip', value: null },
  { label: '₹20', value: 20 },
  { label: '₹50', value: 50 },
  { label: '₹100', value: 100 },
];

export function TipSelector({ selectedTip, onSelect }: TipSelectorProps) {
  return (
    <View style={styles.container}>
      {TIP_OPTIONS.map((option) => (
        <FeedbackChip
          key={option.label}
          label={option.label}
          selected={selectedTip === option.value}
          onPress={() => onSelect(option.value)}
        />
      ))}
      <FeedbackChip
        label="Custom"
        selected={selectedTip !== null && !TIP_OPTIONS.find(o => o.value === selectedTip)}
        onPress={() => onSelect(150)} // Simple placeholder for custom tip functionality
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
