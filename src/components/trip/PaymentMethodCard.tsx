import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, fonts, radius } from '@/theme/theme';

export interface PaymentMethod {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: (methodId: string) => void;
}

export function PaymentMethodCard({ method, isSelected, onSelect }: PaymentMethodCardProps) {
  return (
    <PressableScale
      onPress={() => onSelect(method.id)}
      style={[
        styles.container,
        isSelected && styles.containerSelected,
      ]}
      pressedScale={0.97}
      haptic="selection"
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={method.icon} size={21} color={colors.rider} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{method.title}</Text>
          <Text style={styles.subtitle}>{method.subtitle}</Text>
        </View>
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 12,
  },
  containerSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.rider,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...fonts.bodyMedium,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    ...fonts.bodyRegular,
    color: colors.textSecondary,
    fontSize: 13,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.rider,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.rider,
  },
});
