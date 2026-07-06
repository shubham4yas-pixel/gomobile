import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { colors, radius, shadows, fonts, type, elevationShadows } from '@/theme/theme';

/**
 * Unified Auth Screen (Phase 16 — auth-first flow)
 *
 * Role-agnostic: users authenticate first (Google or email/password), then
 * smart routing decides what happens next:
 *   • Returning user with a Firestore profile → straight to /(app)/map
 *     (the root layout gate redirects once role lands in the store).
 *   • New user / no profile → the complete-profile funnel, which collects
 *     name, phone, and role.
 */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const { login, register, loginWithGoogle, isLoading } = useAuthStore();

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  /** After any successful auth: new users go to the funnel; returning users
   *  are redirected to the map by the root layout gate once role is set. */
  const routeAfterAuth = () => {
    if (useAuthStore.getState().needsProfile) {
      router.replace('/(auth)/complete-profile');
    }
  };

  const handleSubmit = async () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const success = isSignUp
      ? await register(email, password)
      : await login(email, password);

    if (!success) {
      const errorMsg = useAuthStore.getState().error;
      toast.error(errorMsg ?? 'An unexpected error occurred');
      return;
    }
    routeAfterAuth();
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const success = await loginWithGoogle();
    setGoogleLoading(false);
    if (!success) {
      const errorMsg = useAuthStore.getState().error;
      if (errorMsg) toast.error(errorMsg);
      return;
    }
    routeAfterAuth();
  };

  const animatePressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const animatePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand mark */}
          <View style={styles.markContainer}>
            <View style={styles.mark}>
              <Text style={styles.markIcon}>◈</Text>
            </View>
          </View>

          {/* Header */}
          <Text style={styles.title}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'One account for riding and driving'
              : 'Sign in to continue your journey'}
          </Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Google Sign-In */}
            <Pressable
              style={[
                styles.googleButton,
                (isLoading || googleLoading) && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.email && styles.inputError,
                  email.length > 0 && !errors.email && styles.inputFocused,
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.password && styles.inputError,
                  password.length > 0 && !errors.password && styles.inputFocused,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            {!isSignUp && (
              <Pressable style={styles.forgotButton} disabled={isLoading}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              onPressIn={animatePressIn}
              onPressOut={animatePressOut}
              disabled={isLoading}
            >
              <Animated.View
                style={[
                  styles.signInButton,
                  { transform: [{ scale: buttonScale }], opacity: isLoading ? 0.7 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.signInText}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Animated.View>
            </Pressable>

            {/* Toggle Sign In / Sign Up */}
            <Pressable
              style={styles.toggleButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
                useAuthStore.getState().clearError();
              }}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleAction}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </Pressable>
          </View>

          <Text style={styles.funnelHint}>
            New here? You'll pick Rider or Driver right after this step.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  markContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
  },
  markIcon: {
    fontSize: 26,
    color: colors.gold,
  },
  title: {
    ...type.title,
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.raised,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    ...type.label,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputFocused: {
    borderColor: colors.rider,
  },
  inputError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  errorText: {
    ...type.caption,
    color: colors.danger,
    marginTop: 6,
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotText: {
    ...type.label,
    color: colors.rider,
  },
  signInButton: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rider,
    boxShadow: elevationShadows.floating,
  },
  signInText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
  },
  dividerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 18,
  },
  toggleText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  toggleAction: {
    fontFamily: fonts.bold,
    color: colors.rider,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  funnelHint: {
    ...type.caption,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
