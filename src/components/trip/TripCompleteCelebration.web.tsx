import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';

/**
 * TripCompleteCelebration — web build (Phase 18). Static gold check badge;
 * keeps lottie-react-native out of the web bundle (same split as
 * SearchingRadar.web.tsx / MapView.web.tsx).
 */
export function TripCompleteCelebration({ size = 110 }: { size?: number }) {
  const badge = size * 0.4;
  return (
    <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
      <Ionicons name="checkmark" size={size * 0.22} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
