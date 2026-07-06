export interface RatingPayload {
  tripId: string;
  rating: number;
  chips: string[];
  comment?: string;
  tipAmount?: number;
}

export interface RatingResult {
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export const RIDER_FEEDBACK_CHIPS = [
  'Excellent driving',
  'Friendly',
  'Clean vehicle',
  'Smooth ride',
  'Great navigation',
];

export const DRIVER_FEEDBACK_CHIPS = [
  'Polite',
  'On Time',
  'Respectful',
  'Easy Pickup',
  'Would Ride Again',
  'Report Issue',
];

/**
 * Service to handle rating submission and feedback flow.
 * Currently simulates network latency and a successful backend response.
 */
export class RatingService {
  static async submitRating(payload: RatingPayload): Promise<RatingResult> {
    return new Promise((resolve) => {
      // Simulate network request
      setTimeout(() => {
        resolve({
          status: 'SUCCESS'
        });
      }, 1000);
    });
  }
}
