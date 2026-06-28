import { Platform } from 'react-native';

/**
 * Payment service (Phase 13) — talks to the backend payment controller.
 *
 * Mirrors the host split used by `apiService`/`socketService` (web → localhost,
 * native → dev-machine LAN IP). Keep this URL in sync with those.
 */
const API_BASE_URL =
  Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.243.3.247:3001';

/** Server response to initialize-intent. `mock` = run in simulated mode. */
export interface PaymentIntent {
  mock: boolean;
  orderId?: string;
  amount?: number; // gateway subunits (cents) when not mock
  currency?: string;
  keyId?: string;
}

/** Razorpay checkout handshake (returned by the native sheet). */
export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** Outcome of an authorization attempt, consumed by map.tsx. */
export interface PayResult {
  ok: boolean;
  simulated: boolean;
  payment?: { orderId: string | null; paymentId: string } | null;
  error?: string;
}

/**
 * Create an authorize-only order on the backend (escrow hold).
 * Returns `{ mock: true }` when the gateway isn't configured server-side.
 * Throws on network/non-200 so callers can surface the failure banner.
 */
export async function initializePaymentIntent(
  amount: number,
  currency: string,
  userId: string
): Promise<PaymentIntent> {
  const res = await fetch(`${API_BASE_URL}/api/payments/initialize-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, userId }),
  });
  if (!res.ok) {
    throw new Error(`initialize-intent failed: HTTP ${res.status}`);
  }
  return (await res.json()) as PaymentIntent;
}

/**
 * Cryptographically verify the checkout handshake on the backend before the
 * ride is broadcast. Returns true only on a valid signature.
 */
export async function verifyPayment(result: CheckoutResult): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/payments/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.verified === true;
  } catch (e) {
    console.warn('[paymentService] verify error:', e);
    return false;
  }
}
