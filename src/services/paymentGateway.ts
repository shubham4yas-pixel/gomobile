/**
 * Payment Gateway Abstraction Layer
 * 
 * This service acts as the shell for the payment engine. It fully decouples the
 * UI from the actual payment provider (e.g. Razorpay, Stripe).
 * 
 * When integrating a real provider in the future, only this file needs to be modified.
 * The rest of the application should just await processPayment().
 */

// Configure this for deterministic testing.
export type MockPaymentMode = 'success' | 'failure' | 'random';
const MOCK_PAYMENT_MODE: MockPaymentMode = 'success';

export interface PaymentRequest {
  amount: number;
  currency: string;
  method: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  transactionId?: string;
  paymentId?: string;
  timestamp?: number;
  errorMessage?: string;
}

/**
 * Simulates a delay for UI animated states.
 * Returns a promise that resolves after `ms` milliseconds.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class PaymentGateway {
  /**
   * Process a payment request.
   * Currently mocked to simulate a realistic network lifecycle.
   */
  static async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // State 1: Preparing secure transaction... (Simulated UI wait ~1000ms)
    // The UI handles its own state delays, but we can simulate the overall
    // network time here to let the UI breathe through its transitions.
    // Total simulated network time: ~3.5 seconds
    await delay(3500);

    const isSuccess = MOCK_PAYMENT_MODE === 'random' 
      ? Math.random() > 0.3 
      : MOCK_PAYMENT_MODE === 'success';

    if (isSuccess) {
      return {
        status: 'SUCCESS',
        transactionId: `txn_mock_${Math.random().toString(36).substr(2, 9)}`,
        paymentId: `pay_mock_${Date.now()}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        status: 'FAILED',
        errorMessage: 'Your bank declined the transaction. Please try another method.',
      };
    }
  }

  /**
   * Stub for fetching payment status
   */
  static async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    await delay(500);
    return {
      status: 'SUCCESS',
    };
  }

  /**
   * Stub for cancelling an inflight payment
   */
  static async cancelPayment(paymentId: string): Promise<boolean> {
    await delay(300);
    return true;
  }
}
