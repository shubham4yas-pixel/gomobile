import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { colors, radius, typography } from '@/theme/theme';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  /** Use the bottom-sheet-aware text input (keeps the sheet above the keyboard). */
  inSheet?: boolean;
  error?: string | null;
  accent?: string;
}

/**
 * Lightweight phone-number input (Phase 12).
 *
 * Accepts digits, spaces, and a leading "+". Validation is intentionally lenient
 * (`isValidPhone`) — enough to catch empty/too-short input without rejecting
 * international formats. Use `inSheet` inside a bottom sheet so the keyboard
 * doesn't cover it.
 */
export function PhoneInput({
  value,
  onChangeText,
  label,
  placeholder = '+1 555 123 4567',
  inSheet = false,
  error,
  accent = colors.rider,
}: PhoneInputProps) {
  const Input: any = inSheet ? BottomSheetTextInput : require('react-native').TextInput;

  // Permit only phone-ish characters as the user types.
  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^\d+\s()-]/g, '');
    onChangeText(cleaned);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : null, value.length > 0 && !error ? { borderColor: accent } : null]}>
        <Text style={styles.icon}>📞</Text>
        <Input
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={handleChange}
          keyboardType="phone-pad"
          returnKeyType="done"
          maxLength={20}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/** Lenient validity check: at least 7 digits once non-digits are stripped. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7;
}

/** Normalize for display/transport — collapse whitespace, keep a leading '+'. */
export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: typography.weightBold,
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  inputError: { borderColor: colors.danger },
  icon: { fontSize: 16 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
  },
  errorText: { fontSize: 12, color: colors.danger, marginLeft: 4 },
});
