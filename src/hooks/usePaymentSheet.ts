import { useCallback } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  initializePaymentIntent,
  verifyPayment,
  PayResult,
} from '@/services/paymentService';
import { usePaymentConfig } from '@/components/PaymentProvider';

export interface PayArgs {
  amount: number; // dollars
  currency?: string;
  userId: string;
  name?: string;
  description?: string;
  email?: string;
  contact?: string | null;
}

/**
 * Native payment sheet hook (Phase 13) — Razorpay checkout + escrow authorize.
 *
 * Flow: create an authorize-only order on the backend → open the native sheet →
 * verify the signature server-side → return a `PayResult`. If the backend is in
 * simulated mode (`mock`), the sheet is skipped and the ride proceeds without a
 * real charge. Any failure/cancel resolves to `{ ok: false }` (never throws) so
 * the ride state machine can show the failure banner and stay put.
 */
export function usePaymentSheet() {
  const { keyId } = usePaymentConfig();

  const pay = useCallback(
    async ({
      amount,
      currency = 'USD',
      userId,
      name = 'RideShare',
      description = 'Ride fare authorization',
      email,
      contact,
    }: PayArgs): Promise<PayResult> => {
      // 1) Create the escrow hold (or learn we're in simulated mode).
      let intent;
      try {
        intent = await initializePaymentIntent(amount, currency, userId);
      } catch (e) {
        return { ok: false, simulated: false, error: (e as Error).message };
      }

      // 2) Simulated mode — no gateway keys server-side. Proceed without a sheet.
      if (intent.mock || !intent.orderId) {
        return { ok: true, simulated: true, payment: null };
      }

      // 3) Open the native Razorpay checkout for authorization.
      try {
        const options = {
          key: intent.keyId ?? keyId ?? '',
          order_id: intent.orderId,
          amount: intent.amount, // subunits, echoed by the server
          currency: intent.currency ?? currency,
          name,
          description,
          theme: { color: '#208AEF' },
          prefill: {
            email: email ?? undefined,
            contact: contact ?? undefined,
          },
        };

        const result: any = await RazorpayCheckout.open(options);

        // 4) Verify the handshake signature server-side before trusting it.
        const verified = await verifyPayment({
          razorpay_order_id: result.razorpay_order_id ?? intent.orderId,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature,
        });

        if (!verified) {
          return { ok: false, simulated: false, error: 'Payment could not be verified' };
        }

        return {
          ok: true,
          simulated: false,
          payment: {
            orderId: result.razorpay_order_id ?? intent.orderId,
            paymentId: result.razorpay_payment_id,
          },
        };
      } catch (e: any) {
        // User cancelled, native module unavailable (Expo Go), or gateway error.
        const msg =
          e?.description || e?.error?.description || e?.message || 'Payment was not completed';
        return { ok: false, simulated: false, error: msg };
      }
    },
    [keyId]
  );

  return { pay };
}
