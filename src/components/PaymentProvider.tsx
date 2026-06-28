import { createContext, useContext, ReactNode } from 'react';

/**
 * PaymentProvider (Phase 13).
 *
 * Razorpay's React Native checkout is imperative (`RazorpayCheckout.open`), so —
 * unlike Stripe — it needs no React context to function. This thin provider
 * exists to satisfy the "wrap the app root" requirement and to expose the
 * publishable key id + a `configured` flag to the tree in one place. It performs
 * NO native import, so it is safe on web and in Expo Go.
 */

interface PaymentConfig {
  /** Publishable Razorpay key id (safe to ship in the client). */
  keyId: string | null;
  /** True when a key id is present (gateway likely live); informational only —
   *  the backend is the source of truth via the `mock` flag on initialize. */
  configured: boolean;
}

const KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? null;

const PaymentContext = createContext<PaymentConfig>({
  keyId: KEY_ID,
  configured: !!KEY_ID,
});

export function PaymentProvider({ children }: { children: ReactNode }) {
  return (
    <PaymentContext.Provider value={{ keyId: KEY_ID, configured: !!KEY_ID }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePaymentConfig(): PaymentConfig {
  return useContext(PaymentContext);
}
