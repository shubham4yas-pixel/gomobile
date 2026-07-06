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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { colors, idealTextOn, fonts, type, elevationShadows } from '@/theme/theme';
import { APP_VARIANT } from '@/config/appVariant';

type Role = 'rider' | 'driver';

/**
 * Complete Profile Screen (Phase 15b — onboarding funnel)
 *
 * Shown after a first-time Google Sign-In (or any auth path that
 * results in a user without a Firestore profile). Collects:
 *   • Display name
 *   • Phone number
 *   • Role (Rider or Driver)
 *
 * On save, writes to Firestore `users/{uid}` and sets the role in the
 * auth store, which triggers the root layout to redirect to /(app)/map.
 */
export default function CompleteProfile() {
  const user = useAuthStore((s) => s.user);
  const { completeProfile, isLoading } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState('');
  // Phase 17: in a variant build (dedicated Rider/Driver app) the role is fixed
  // by the app itself — the selector below is hidden and this never changes.
  const [selectedRole, setSelectedRole] = useState<Role>(APP_VARIANT ?? 'rider');
  const [upiId, setUpiId] = useState('');
  const [errors, setErrors] = useState<{
    displayName?: string;
    phone?: string;
    upiId?: string;
  }>({});
  const buttonScale = useRef(new Animated.Value(1)).current;

  const photoUrl = user?.photoURL;

  const handleSave = async () => {
    const newErrors: { displayName?: string; phone?: string; upiId?: string } = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }

    if (phone.replace(/\D/g, '').length < 7) {
      newErrors.phone = 'Enter a valid phone number';
    }

    // Drivers must provide a valid UPI VPA (e.g. name@bank) to receive payments.
    if (selectedRole === 'driver') {
      const upi = upiId.trim();
      if (!upi) {
        newErrors.upiId = 'Enter your UPI ID to receive payments';
      } else if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
        newErrors.upiId = 'Enter a valid UPI ID (e.g. name@bank)';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const success = await completeProfile(
      displayName.trim(),
      phone,
      selectedRole,
      selectedRole === 'driver' ? upiId.trim() : undefined
    );
    if (!success) {
      toast.error('Could not save your profile. Please try again.');
    }
    // On success, the store sets role + clears needsProfile → root layout
    // redirects to /(app)/map automatically.
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

  const roleAccent = selectedRole === 'rider' ? colors.rider : colors.driver;

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
          {/* Avatar */}
          <View style={styles.avatarSection}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: roleAccent + '20' }]}>
                <Text style={styles.avatarInitial}>
                  {displayName ? displayName[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Header */}
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            Tell us who you are and how you'll use RideShare
          </Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Display Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your name</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.displayName && styles.inputError,
                  displayName.length > 0 && !errors.displayName && styles.inputFocused,
                ]}
              >
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="How should we call you?"
                  placeholderTextColor={colors.textMuted}
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    if (errors.displayName)
                      setErrors((prev) => ({ ...prev, displayName: undefined }));
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.displayName && (
                <Text style={styles.errorText}>{errors.displayName}</Text>
              )}
            </View>

            {/* Phone */}
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
                    if (errors.phone)
                      setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* Role Selector — hidden in variant builds (role fixed by the app) */}
            {!APP_VARIANT && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>I want to</Text>
              <View style={styles.roleRow}>
                <Pressable
                  style={[
                    styles.roleCard,
                    selectedRole === 'rider' && {
                      borderColor: colors.rider,
                      backgroundColor: colors.rider + '10',
                    },
                  ]}
                  onPress={() => setSelectedRole('rider')}
                  disabled={isLoading}
                >
                  <Text style={styles.roleEmoji}>🚘</Text>
                  <Text
                    style={[
                      styles.roleLabel,
                      selectedRole === 'rider' && { color: colors.rider, fontWeight: '700' },
                    ]}
                  >
                    Ride
                  </Text>
                  {selectedRole === 'rider' && (
                    <View style={[styles.roleCheck, { backgroundColor: colors.rider }]}>
                      <Text style={styles.roleCheckMark}>✓</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.roleCard,
                    selectedRole === 'driver' && {
                      borderColor: colors.driver,
                      backgroundColor: colors.driver + '10',
                    },
                  ]}
                  onPress={() => setSelectedRole('driver')}
                  disabled={isLoading}
                >
                  <Text style={styles.roleEmoji}>🛣️</Text>
                  <Text
                    style={[
                      styles.roleLabel,
                      selectedRole === 'driver' && { color: colors.driver, fontWeight: '700' },
                    ]}
                  >
                    Drive
                  </Text>
                  {selectedRole === 'driver' && (
                    <View style={[styles.roleCheck, { backgroundColor: colors.driver }]}>
                      <Text style={styles.roleCheckMark}>✓</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
            )}

            {/* UPI ID — drivers only (Phase 15). Used to collect ride payments. */}
            {selectedRole === 'driver' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>UPI ID</Text>
                <View
                  style={[
                    styles.inputContainer,
                    errors.upiId && styles.inputError,
                    upiId.length > 0 && !errors.upiId && styles.inputFocused,
                  ]}
                >
                  <Text style={styles.inputIcon}>🏦</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="yourname@bank"
                    placeholderTextColor={colors.textMuted}
                    value={upiId}
                    onChangeText={(text) => {
                      setUpiId(text);
                      if (errors.upiId) setErrors((prev) => ({ ...prev, upiId: undefined }));
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!isLoading}
                  />
                </View>
                {errors.upiId ? (
                  <Text style={styles.errorText}>{errors.upiId}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Riders pay you directly — fares go straight to this UPI ID.
                  </Text>
                )}
              </View>
            )}

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              onPressIn={animatePressIn}
              onPressOut={animatePressOut}
              disabled={isLoading}
            >
              <Animated.View
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: roleAccent,
                    transform: [{ scale: buttonScale }],
                    opacity: isLoading ? 0.7 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={idealTextOn(roleAccent)} size="small" />
                ) : (
                  <Text style={[styles.saveText, { color: idealTextOn(roleAccent) }]}>
                    Let's Go! 🚀
                  </Text>
                )}
              </Animated.View>
            </Pressable>
          </View>

          {/* Signed-in notice */}
          {user?.email && (
            <Text style={styles.signedInAs}>
              Signed in as {user.email}
            </Text>
          )}
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
  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.rider,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.rider,
  },
  // Header
  title: {
    ...type.title,
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  // Form
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: elevationShadows.raised,
  },
  inputGroup: {
    marginBottom: 22,
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
    borderRadius: 12,
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
  inputIcon: {
    fontSize: 16,
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
  helperText: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
  },
  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.background,
    gap: 6,
    position: 'relative',
  },
  roleEmoji: {
    fontSize: 28,
  },
  roleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckMark: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  // Save button
  saveButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  // Footer
  signedInAs: {
    ...type.caption,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
