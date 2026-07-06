import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import HistoryScreen from '@/app/(app)/history';
import EarningsScreen from '@/app/(app)/earnings';

/**
 * Activity tab (Phase 19) — embeds the existing role-appropriate screen:
 * riders see Ride History, drivers see the Earnings dashboard. The role is
 * resolved BEFORE rendering so the screens' internal cross-redirects
 * (history→earnings for drivers, and vice-versa) never fire inside the tab.
 * Bottom padding clears the floating tab dock.
 */
export default function ActivityScreen() {
  const role = useAuthStore((s) => s.role);

  return (
    <View style={styles.container}>
      {role === 'driver' ? <EarningsScreen /> : <HistoryScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 84, // floating tab dock clearance
  },
});
