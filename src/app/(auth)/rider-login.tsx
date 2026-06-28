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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, idealTextOn } from '@/theme/theme';

const ACCENT = colors.rider;

/**
 * Rider Login Screen
 *
 * Email/password form wired to Firebase Auth via Zustand store.
 * Supports both Sign In and Sign Up modes with loading states.
 */
export default function RiderLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; phone?: string }>({});
  const buttonScale = useRef(new Animated.Value(1)).current;

  const { login, register, isLoading } = useAuthStore();

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async () => {
    const newErrors: { email?: string; password?: string; phone?: string } = {};

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

    // Phone is collected at sign-up (Phase 12) for ride contact exchange.
    if (isSignUp && phone.replace(/\D/g, '').length < 7) {
      newErrors.phone = 'Enter a valid phone number';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const success = isSignUp
        ? await register(email, password, 'rider', phone)
        : await login(email, password, 'rider');

      if (!success) {
        const errorMsg = useAuthStore.getState().error;
        Alert.alert(
          isSignUp ? 'Registration Failed' : 'Sign In Failed',
          errorMsg ?? 'An unexpected error occurred'
        );
      }
      // On success, root layout handles redirect to /(app)/map
    }
  };

  const animatePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
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
          {/* Role Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: ACCENT + '20' }]}>
              <Text style={styles.badgeEmoji}>🚘</Text>
              <Text style={[styles.badgeText, { color: ACCENT }]}>Rider</Text>
            </View>
          </View>

          {/* Header */}
          <Text style={styles.title}>
            {isSignUp ? 'Create account' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Sign up to start requesting rides'
              : 'Sign in to request your next ride'}
          </Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.email && styles.inputError,
                  email.length > 0 && !errors.email && styles.inputFocused,
                ]}
              >
                <Text style={styles.inputIcon}>✉</Text>
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
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.password && styles.inputError,
                  password.length > 0 && !errors.password && styles.inputFocused,
                ]}
              >
                <Text style={styles.inputIcon}>🔒</Text>
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
                  <Text style={styles.toggleIcon}>
                    {showPassword ? '🙈' : '👁'}
                  </Text>
                </Pressable>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Phone Input (sign-up only — Phase 12) */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone number</Text>
                <View
                  style={[
                    styles.inputContainer,
                    errors.phone && styles.inputError,
                    phone.length > 0 && !errors.phone && styles.inputFocused,
                  ]}
                >
                  <Text style={styles.inputIcon}>📞</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 555 123 4567"
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>
            )}

            {/* Forgot Password */}
            {!isSignUp && (
              <Pressable style={styles.forgotButton} disabled={isLoading}>
                <Text style={[styles.forgotText, { color: ACCENT }]}>
                  Forgot password?
                </Text>
              </Pressable>
            )}

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              onPressIn={animatePressIn}
              onPressOut={animatePressOut}
              disabled={isLoading}
            >
              <Animated.View
                style={[
                  styles.signInButton,
                  {
                    backgroundColor: ACCENT,
                    transform: [{ scale: buttonScale }],
                    opacity: isLoading ? 0.7 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={idealTextOn(ACCENT)} size="small" />
                ) : (
                  <Text style={[styles.signInText, { color: idealTextOn(ACCENT) }]}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Animated.View>
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Toggle Sign In / Sign Up */}
            <Pressable
              style={styles.createAccountButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
                useAuthStore.getState().clearError();
              }}
              disabled={isLoading}
            >
              <Text style={styles.createAccountText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: ACCENT, fontWeight: '700' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </Pressable>
          </View>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  badgeEmoji: {
    fontSize: 18,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputFocused: {
    borderColor: ACCENT,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  toggleIcon: {
    fontSize: 18,
    padding: 4,
  },
  errorText: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '600',
  },
  signInButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 17,
    fontWeight: '700',
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
  createAccountButton: {
    alignItems: 'center',
  },
  createAccountText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
