/**
 * UPI deep-link helper (Phase 15 — Driver post-ride payment collection).
 *
 * Builds a standard UPI intent string (`upi://pay?...`) that encodes the driver's
 * payee address (VPA), name, the exact ride fare, and a transaction note/ref.
 * Encoded into a QR code, ANY UPI app (GPay / PhonePe / Paytm / BHIM …) can scan
 * it and pre-fill the amount — no Razorpay SDK required (deferred for later).
 *
 * UPI settles in INR only, so `cu` is fixed to INR and `am` is the bare numeric
 * amount. The app's fares are computed in the receipt's `currency` (USD in dev);
 * the amount shown on the QR is the same numeric value — swap to an INR fare or
 * apply a conversion before production if you bill in another currency.
 */

/** Default payee VPA. Set EXPO_PUBLIC_DEFAULT_UPI_ID in .env / eas.json to override. */
export const DEFAULT_UPI_ID =
  process.env.EXPO_PUBLIC_DEFAULT_UPI_ID ?? 'rideshare.driver@upi';

export interface UpiIntentParams {
  /** Payee VPA, e.g. "driver@oksbi". Falls back to DEFAULT_UPI_ID. */
  payeeVpa?: string;
  /** Payee display name shown in the rider's UPI app. */
  payeeName: string;
  /** Exact amount to collect (two decimals). */
  amount: number;
  /** Optional human note ("RideShare fare"). */
  note?: string;
  /** Optional transaction reference (the tripId) for reconciliation. */
  transactionRef?: string;
}

/** UPI param values must be percent-encoded; spaces especially. */
function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Build a spec-compliant `upi://pay` intent string.
 *
 * @example
 *   buildUpiIntent({ payeeName: 'Asha K', amount: 12.5, transactionRef: 'trip-123' })
 *   // → upi://pay?pa=rideshare.driver%40upi&pn=Asha%20K&am=12.50&cu=INR&tn=...&tr=trip-123
 */
export function buildUpiIntent({
  payeeVpa,
  payeeName,
  amount,
  note = 'RideShare fare',
  transactionRef,
}: UpiIntentParams): string {
  const pa = payeeVpa?.trim() || DEFAULT_UPI_ID;
  const am = Math.max(0, amount || 0).toFixed(2);

  const params = [
    `pa=${enc(pa)}`,
    `pn=${enc(payeeName || 'RideShare Driver')}`,
    `am=${am}`,
    `cu=INR`,
    `tn=${enc(note)}`,
  ];
  if (transactionRef) params.push(`tr=${enc(transactionRef)}`);

  return `upi://pay?${params.join('&')}`;
}
