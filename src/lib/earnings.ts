/**
 * Driver earnings math (Phase 14)
 *
 * Mirrors the backend split engine in `backend/controllers/paymentController.js`
 * (`computeSplit`) so the Earnings Dashboard shows the SAME net a driver is
 * actually credited in their wallet / transaction_ledger. Keep these constants
 * in sync with the server — they are the single source of truth for the take-rate.
 *
 *   gross      = the fare the rider paid
 *   gatewayFee = 2% of gross (payment-processing overhead)
 *   platformFee= 20% of gross (platform commission)
 *   net        = gross − gatewayFee − platformFee (floored at 0)
 */
export const GATEWAY_PERCENT = 0.02; // payment-gateway overhead
export const PLATFORM_COMMISSION = 0.2; // platform take-rate

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface EarningsSplit {
  gross: number;
  gatewayFee: number;
  platformFee: number;
  /** What the driver keeps after the gateway + platform fees. */
  net: number;
}

/** Split a single gross fare into the driver's net + the deducted fees. */
export function computeDriverEarnings(gross: number): EarningsSplit {
  const g = Math.max(0, gross || 0);
  const gatewayFee = round2(g * GATEWAY_PERCENT);
  const platformFee = round2(g * PLATFORM_COMMISSION);
  const net = Math.max(0, round2(g - gatewayFee - platformFee));
  return { gross: g, gatewayFee, platformFee, net };
}

/** Start of the local day (00:00) for a given date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Start of the current week (Monday 00:00, local time).
 * Monday-based to match common driver-payout weeks.
 */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  day.setDate(day.getDate() - dow);
  return day;
}

export interface EarningsSummary {
  /** Net earnings for trips completed today. */
  today: number;
  /** Net earnings for trips completed since Monday. */
  week: number;
  /** Net earnings across every trip in the list. */
  allTime: number;
  /** Total gross fares (pre-commission) across every trip. */
  grossAllTime: number;
  /** Total commission + gateway fees the platform kept across every trip. */
  feesAllTime: number;
  tripCount: number;
}

/** A trip shape with just what the earnings math needs. */
type FaredTrip = { fare: number; date: string };

/**
 * Roll a list of completed trips up into Today / This Week / All-time net
 * earnings. `now` is injectable for testing; defaults to the current time.
 */
export function summarizeEarnings(trips: FaredTrip[], now: Date = new Date()): EarningsSummary {
  const todayStart = startOfDay(now).getTime();
  const weekStart = startOfWeek(now).getTime();

  let today = 0;
  let week = 0;
  let allTime = 0;
  let grossAllTime = 0;
  let feesAllTime = 0;

  for (const t of trips) {
    const split = computeDriverEarnings(t.fare);
    const ts = new Date(t.date).getTime();

    allTime = round2(allTime + split.net);
    grossAllTime = round2(grossAllTime + split.gross);
    feesAllTime = round2(feesAllTime + split.gatewayFee + split.platformFee);

    if (!isNaN(ts)) {
      if (ts >= todayStart) today = round2(today + split.net);
      if (ts >= weekStart) week = round2(week + split.net);
    }
  }

  return {
    today,
    week,
    allTime,
    grossAllTime,
    feesAllTime,
    tripCount: trips.length,
  };
}
