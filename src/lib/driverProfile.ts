/**
 * Deterministic mock driver profiles.
 *
 * The dispatch backend only knows a driver's id + live coordinates, so the
 * "premium" rider-facing details (name, car, plate, rating) are synthesized
 * here. Using a stable hash of the driver id means the same driver always
 * renders with the same identity for the duration of a session — no flicker.
 */

export interface DriverProfile {
  name: string;
  initials: string;
  car: string;
  color: string;
  plate: string;
  rating: string; // e.g. "4.9"
  trips: number;
}

const FIRST_NAMES = [
  'Marcus', 'Elena', 'Devon', 'Priya', 'Andre', 'Sofia',
  'Liam', 'Yuki', 'Omar', 'Nadia', 'Theo', 'Camila',
];
const LAST_INITIALS = ['R.', 'K.', 'M.', 'S.', 'T.', 'B.', 'L.', 'A.', 'D.', 'P.'];
const CARS = [
  'Tesla Model 3', 'Toyota Camry', 'Honda Accord', 'BMW 3 Series',
  'Hyundai Sonata', 'Audi A4', 'Kia K5', 'Mercedes C-Class',
];
const CAR_COLORS = ['Black', 'White', 'Silver', 'Graphite', 'Midnight Blue'];
const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

/** Simple, stable 32-bit string hash. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

export function getDriverProfile(driverId: string | null | undefined): DriverProfile {
  const seed = hashString(driverId || 'driver');

  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const lastInitial = LAST_INITIALS[(seed >> 3) % LAST_INITIALS.length];
  const car = CARS[(seed >> 5) % CARS.length];
  const color = CAR_COLORS[(seed >> 7) % CAR_COLORS.length];

  const l1 = PLATE_LETTERS[(seed >> 2) % PLATE_LETTERS.length];
  const l2 = PLATE_LETTERS[(seed >> 4) % PLATE_LETTERS.length];
  const digits = String((seed % 9000) + 1000); // 4 digits, 1000-9999
  const l3 = PLATE_LETTERS[(seed >> 6) % PLATE_LETTERS.length];

  // Ratings cluster between 4.6 and 5.0
  const rating = (4.6 + ((seed % 5) * 0.1)).toFixed(1);
  const trips = 480 + (seed % 4200);

  return {
    name: `${first} ${lastInitial}`,
    initials: `${first[0]}${lastInitial[0]}`,
    car,
    color,
    plate: `${l1}${l2}${digits.slice(0, 2)} ${digits.slice(2)}${l3}`,
    rating,
    trips,
  };
}
