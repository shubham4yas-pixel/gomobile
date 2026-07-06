import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, fonts, radius, spacing, withAlpha } from '@/theme/theme';
import { PaymentMethodCard, type PaymentMethod } from './PaymentMethodCard';
import { PaymentGateway } from '@/services/paymentGateway';
import { type TripSummary } from '@/store/useRideStore';

export type PaymentState = 'SELECT_METHOD' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

interface RiderPaymentSheetProps {
  tripSummary: TripSummary;
  onPaymentComplete: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'upi', title: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm', icon: 'phone-portrait-outline' },
  { id: 'cards', title: 'Credit / Debit Card', subtitle: 'Visa, MasterCard, RuPay', icon: 'card-outline' },
  { id: 'wallet', title: 'Wallet', subtitle: 'Amazon Pay, Freecharge', icon: 'wallet-outline' },
  { id: 'cash', title: 'Cash', subtitle: 'Pay driver directly', icon: 'cash-outline' },
];

export function RiderPaymentSheet({ tripSummary, onPaymentComplete }: RiderPaymentSheetProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>('SELECT_METHOD');
  const [selectedMethod, setSelectedMethod] = useState<string>(PAYMENT_METHODS[0].id);
  const [processingMsg, setProcessingMsg] = useState('Preparing secure transaction...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Payment Success Details
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  const handlePayNow = async () => {
    setPaymentState('PROCESSING');
    setProcessingMsg('Preparing secure transaction...');
    setErrorMessage(null);

    // Simulate animated UI states while backend processes
    const t1 = setTimeout(() => setProcessingMsg('Connecting to payment provider...'), 1200);
    const t2 = setTimeout(() => setProcessingMsg('Authorising payment...'), 2400);
    timersRef.current = [t1, t2];

    try {
      const result = await PaymentGateway.processPayment({
        amount: tripSummary.estimatedFare,
        currency: tripSummary.currency,
        method: selectedMethod,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      timersRef.current = [];

      if (result.status === 'SUCCESS') {
        setPaymentId(result.paymentId || null);
        setTransactionId(result.transactionId || null);
        setPaymentState('SUCCESS');
      } else {
        setErrorMessage(result.errorMessage || 'Payment failed.');
        setPaymentState('FAILED');
      }
    } catch {
      clearTimeout(t1);
      clearTimeout(t2);
      timersRef.current = [];
      setErrorMessage('Network error occurred.');
      setPaymentState('FAILED');
    }
  };

  if (paymentState === 'SUCCESS') {
    return (
      <View style={[styles.container, styles.centered]}>
        <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut} style={styles.successIconWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={42} color={colors.white} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.successTitle}>
          Payment Successful
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(400)} style={styles.receiptBlock}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Amount Paid</Text>
            <Text style={styles.receiptValueBold}>
              {tripSummary.currency}{tripSummary.estimatedFare.toFixed(2)}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Paid via</Text>
            <Text style={styles.receiptValue}>
              {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.title}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Transaction ID</Text>
            <Text style={styles.receiptValue}>{transactionId}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Payment ID</Text>
            <Text style={styles.receiptValue}>{paymentId}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Time</Text>
            <Text style={styles.receiptValue}>{new Date().toLocaleTimeString()}</Text>
          </View>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(600)} style={{ width: '100%', marginTop: 24 }}>
          <PrimaryButton label="Continue" onPress={onPaymentComplete} />
        </Animated.View>
      </View>
    );
  }

  if (paymentState === 'PROCESSING') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.rider} style={{ marginBottom: 24 }} />
        <Animated.Text 
          key={processingMsg}
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(300)} 
          style={styles.processingText}
        >
          {processingMsg}
        </Animated.Text>
      </View>
    );
  }

  return (
    <BottomSheetScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Complete Payment</Text>
      
      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Trip Summary</Text>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Base Fare</Text>
          <Text style={styles.receiptValue}>{tripSummary.currency}5.00</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Distance Fare</Text>
          <Text style={styles.receiptValue}>
            {tripSummary.currency}{(tripSummary.estimatedFare - 5 - (tripSummary.taxes || 0)).toFixed(2)}
          </Text>
        </View>
        {tripSummary.waitingFees ? (
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Waiting Charge</Text>
            <Text style={styles.receiptValue}>{tripSummary.currency}{tripSummary.waitingFees.toFixed(2)}</Text>
          </View>
        ) : null}
        {tripSummary.tolls ? (
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Tolls</Text>
            <Text style={styles.receiptValue}>{tripSummary.currency}{tripSummary.tolls.toFixed(2)}</Text>
          </View>
        ) : null}
        {tripSummary.discounts ? (
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Discount</Text>
            <Text style={[styles.receiptValue, { color: colors.success }]}>
              -{tripSummary.currency}{tripSummary.discounts.toFixed(2)}
            </Text>
          </View>
        ) : null}
        {tripSummary.taxes ? (
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Tax</Text>
            <Text style={styles.receiptValue}>{tripSummary.currency}{tripSummary.taxes.toFixed(2)}</Text>
          </View>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.receiptRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{tripSummary.currency}{tripSummary.estimatedFare.toFixed(2)}</Text>
        </View>
      </GlassCard>

      <Text style={styles.sectionTitle}>Select Payment Method</Text>
      <View style={styles.methodsList}>
        {PAYMENT_METHODS.map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            isSelected={selectedMethod === method.id}
            onSelect={setSelectedMethod}
          />
        ))}
      </View>

      {paymentState === 'FAILED' && (
        <Animated.View entering={FadeIn} style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Animated.View>
      )}

      <PrimaryButton
        label={
          paymentState === 'FAILED'
            ? `Retry ${tripSummary.currency}${tripSummary.estimatedFare.toFixed(2)}`
            : `Pay ${tripSummary.currency}${tripSummary.estimatedFare.toFixed(2)}`
        }
        onPress={handlePayNow}
        style={{ marginTop: 16 }}
      />
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...fonts.heading2,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  sectionTitle: {
    ...fonts.heading3,
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 24,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 8,
  },
  summaryTitle: {
    ...fonts.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    ...fonts.bodyRegular,
    color: colors.textSecondary,
  },
  receiptValue: {
    ...fonts.bodyRegular,
    color: colors.textPrimary,
  },
  receiptValueBold: {
    ...fonts.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 12,
  },
  totalLabel: {
    ...fonts.bodyBold,
    color: colors.textPrimary,
    fontSize: 18,
  },
  totalValue: {
    ...fonts.bodyBold,
    color: colors.rider,
    fontSize: 20,
  },
  methodsList: {
    gap: spacing.xs,
  },
  processingText: {
    ...fonts.bodyMedium,
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
  successIconWrap: {
    marginBottom: 24,
  },
  successIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...fonts.heading2,
    color: colors.textPrimary,
    marginBottom: 32,
  },
  receiptBlock: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(colors.danger, 0x12),
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0x55),
    borderRadius: radius.md,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    ...fonts.bodyMedium,
    color: colors.danger,
  },
});
