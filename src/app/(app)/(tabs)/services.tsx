import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { toast } from '@/store/useToastStore';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, type } from '@/theme/theme';
import { ServiceTile } from '@/components/home/ServiceTile';

/**
 * Services tab (Phase 19) — the full service catalog grid. "Trip"/"Drive" is
 * live (opens the map booking flow); the rest are premium placeholders that
 * toast until their phases land.
 */
export default function ServicesScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const openMap = () => router.push('/(app)/map');
  const comingSoon = (what: string) => toast.info(`${what} is coming soon`);

  const tiles =
    role === 'driver'
      ? [
          { label: 'Drive', emoji: '🚗', onPress: openMap },
          { label: 'Earnings', emoji: '👛', onPress: () => router.push('/(app)/earnings') },
          { label: 'History', emoji: '🧾', onPress: () => router.push('/(app)/history') },
        ]
      : [
          { label: 'Trip', emoji: '🚘', badge: '25%', onPress: openMap },
          { label: 'Intercity', emoji: '🛣️', badge: 'Promo', onPress: () => comingSoon('Intercity') },
          { label: 'Rentals', emoji: '🚙', onPress: () => comingSoon('Rentals') },
          { label: 'Bus tickets', emoji: '🚌', badge: 'Promo', onPress: () => comingSoon('Bus tickets') },
          { label: 'Reserve', emoji: '📅', onPress: () => comingSoon('Reserve') },
          { label: 'Parcel', emoji: '📦', onPress: () => comingSoon('Parcel delivery') },
          { label: 'Seniors', emoji: '🧓', onPress: () => comingSoon('Senior rides') },
          { label: 'Group ride', emoji: '👥', onPress: () => comingSoon('Group rides') },
        ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Services</Text>
        <Text style={styles.subtitle}>Go anywhere, get anything</Text>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.grid}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.gridItem}>
              <ServiceTile label={t.label} emoji={t.emoji} badge={(t as any).badge} onPress={t.onPress} />
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  title: {
    ...type.title,
    color: colors.navy,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 24,
  },
  gridItem: {
    width: '33.33%',
    alignItems: 'center',
  },
});
