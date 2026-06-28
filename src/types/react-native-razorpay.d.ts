/**
 * Ambient types for `react-native-razorpay` (Phase 13).
 *
 * The package ships no TypeScript definitions, so we declare the slice of the
 * native checkout API we use. `RazorpayCheckout.open(options)` resolves with the
 * signed handshake on success and rejects with `{ code, description }` on
 * cancel/error.
 */
declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string;
    order_id?: string;
    amount?: number | string;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    theme?: { color?: string };
    prefill?: { email?: string; contact?: string; name?: string };
    notes?: Record<string, string>;
    [key: string]: unknown;
  }

  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }

  export interface RazorpayError {
    code?: number | string;
    description?: string;
    error?: { description?: string };
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccess>;
  };

  export default RazorpayCheckout;
}
