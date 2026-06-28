import { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

/**
 * Landing Gate
 *
 * Full-screen splash that asks "Are you a Rider or a Driver?"
 * Tapping a card triggers devBypassLogin() for instant access
 * to the map screen without Firebase credentials.
 *
 * To restore real auth, change onPress to:
 *   router.push('/(auth)/rider-login')
 *   router.push('/(auth)/driver-login')
 */
export default function LandingGate() {
  const devBypassLogin = useAuthStore((s) => s.devBypassLogin);

  return (
    <SafeAreaView style={styles.container}>
      {/* Branding */}
      <View style={styles.brandSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>◈</Text>
        </View>
        <Text style={styles.brandName}>RideShare</Text>
        <Text style={styles.tagline}>Your journey, your way</Text>
      </View>

      {/* Role Selection */}
      <View style={styles.cardSection}>
        <Text style={styles.prompt}>How would you like to travel?</Text>

        <RoleCard
          role="Rider"
          description="Request a ride and get picked up in minutes"
          emoji="🚘"
          accentColor={colors.rider}
          onPress={() => devBypassLogin('rider')}
        />

        <RoleCard
          role="Driver"
          description="Hit the road and start earning today"
          emoji="🛣️"
          accentColor={colors.driver}
          onPress={() => devBypassLogin('driver')}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * RoleCard — Animated card button for role selection
 */
function RoleCard({
  role,
  description,
  emoji,
  accentColor,
  onPress,
}: {
  role: string;
  description: string;
  emoji: string;
  accentColor: string;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    haptics.selection();
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: accentColor + '30',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <View style={styles.cardText}>
            <Text style={[styles.cardRole, { color: accentColor }]}>
              I'm a {role}
            </Text>
            <Text style={styles.cardDescription}>{description}</Text>
          </View>
        </View>
        <View style={[styles.cardArrow, { backgroundColor: accentColor + '20' }]}>
          <Text style={[styles.arrowText, { color: accentColor }]}>→</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  brandSection: {
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.rider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.rider,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 36,
    color: colors.white,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 8,
  },
  cardSection: {
    gap: 16,
  },
  prompt: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardText: {
    flex: 1,
  },
  cardRole: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 20,
    fontWeight: '700',
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
