import { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, fonts, type } from '@/theme/theme';
import { haptics } from '@/lib/haptics';
import { isDriverApp } from '@/config/appVariant';

/** Variant-aware landing copy (Phase 17) — each app sells its own story. */
const COPY = isDriverApp
  ? {
      brand: 'RideShare Driver',
      tagline: 'Drive. Earn. Repeat.',
      features: [
        { icon: '💰', title: 'Earn on your schedule', body: 'Instant trip offers, transparent net earnings' },
        { icon: '📍', title: 'Smart dispatch', body: 'Matched to the nearest rider automatically' },
        { icon: '★', title: 'Build your rating', body: 'Great trips grow your reputation', gold: true },
      ],
    }
  : {
      brand: 'RideShare',
      tagline: 'Your journey, elevated',
      features: [
        { icon: '⚡', title: 'Pickups in minutes', body: 'Live-matched with the nearest driver' },
        { icon: '🛡', title: 'Trusted rides', body: 'Verified drivers, shared contact, live tracking' },
        { icon: '★', title: 'Rated 5-star', body: 'Two-sided ratings keep every trip accountable', gold: true },
      ],
    };

/**
 * Landing Screen (Phase 16 — auth-first flow)
 *
 * Premium brand moment with a single path forward: Get Started → the unified
 * /(auth)/login screen. Role selection no longer happens here — it moved into
 * the post-auth complete-profile funnel, matching the Uber/Ola pattern.
 */
export default function Landing() {
  const router = useRouter();
  const ctaScale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    haptics.selection();
    Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Branding */}
      <View style={styles.brandSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>◈</Text>
        </View>
        <Text style={styles.brandName}>{COPY.brand}</Text>
        <View style={styles.taglineRow}>
          <View style={styles.goldDash} />
          <Text style={styles.tagline}>{COPY.tagline}</Text>
          <View style={styles.goldDash} />
        </View>
      </View>

      {/* Value props */}
      <View style={styles.features}>
        {COPY.features.map((f) => (
          <FeatureRow key={f.title} icon={f.icon} title={f.title} body={f.body} gold={f.gold} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          onPressIn={pressIn}
          onPressOut={pressOut}
        >
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <LinearGradient
              colors={[colors.ctaTop, colors.ctaBottom]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Get Started</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Web admin shortcut */}
        {Platform.OS === 'web' && (
          <Pressable
            style={styles.adminLink}
            onPress={() => router.push('/(admin)/dashboard')}
          >
            <Text style={styles.adminLinkText}>🖥  God Mode (Admin)</Text>
          </Pressable>
        )}

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({
  icon,
  title,
  body,
  gold,
}: {
  icon: string;
  title: string;
  body: string;
  gold?: boolean;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, gold && styles.featureIconGold]}>
        <Text style={[styles.featureIconText, gold && { color: colors.gold }]}>{icon}</Text>
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
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
    paddingTop: 72,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadows.card,
    shadowColor: colors.navy,
    shadowOpacity: 0.35,
  },
  logoIcon: {
    fontSize: 40,
    color: colors.gold,
  },
  brandName: {
    ...type.display,
    color: colors.navy,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  goldDash: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  features: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    ...shadows.card,
    shadowOpacity: 0.07,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconGold: {
    backgroundColor: colors.goldSoft,
  },
  featureIconText: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  featureBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ctaSection: {
    paddingBottom: 16,
    gap: 14,
  },
  ctaButton: {
    height: 56,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...shadows.glow(colors.ctaBottom),
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.3,
  },
  ctaArrow: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.gold,
  },
  adminLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  adminLinkText: {
    ...type.label,
    color: colors.textSecondary,
  },
  footerText: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
