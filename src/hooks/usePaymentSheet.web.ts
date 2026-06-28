import { useCallback } from 'react';
import { initializePaymentIntent, PayResult } from '@/services/paymentService';

export interface PayArgs {
  amount: number;
  currency?: string;
  userId: string;
  name?: string;
  description?: string;
  email?: string;
  contact?: string | null;
}

/**
 * Web payment sheet shim (Phase 13).
 *
 * `react-native-razorpay` is a native module with no browser build, so on web we
 * still call the backend intent endpoint (to exercise the contract) but always
 * resolve to a simulated authorization — the web client is the schematic/admin
 * surface, not the production checkout path. Never throws.
 */
export function usePaymentSheet() {
  const pay = useCallback(
    async ({ amount, currency = 'USD', userId }: PayArgs): Promise<PayResult> => {
      try {
        await initializePaymentIntent(amount, currency, userId);
      } catch {
        // Ignore — web proceeds in simulated mode regardless.
      }
      return { ok: true, simulated: true, payment: null };
    },
    []
  );

  return { pay };
}
