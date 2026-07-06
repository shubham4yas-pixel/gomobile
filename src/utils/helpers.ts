import { BASE_FARE, PER_KM_RATE } from './constants';

/**
 * Calculate the estimated fare based on distance.
 */
export const calculateFareEstimate = (distanceKm: number): number => {
  return Math.round((BASE_FARE + distanceKm * PER_KM_RATE) * 100) / 100;
};

/**
 * Contextual subtitle adapting to time of day.
 */
export function getContextualSubtitle(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'Where are you heading this morning?';
  if (hour >= 9 && hour < 12) return 'Ready for your next ride?';
  if (hour >= 12 && hour < 14) return 'Need a ride somewhere?';
  if (hour >= 14 && hour < 17) return 'Where to this afternoon?';
  if (hour >= 17 && hour < 20) return 'Heading home?';
  if (hour >= 20 && hour < 23) return 'Going somewhere tonight?';
  return 'Need a late-night ride?';
}

/**
 * Time-of-day greeting with optional first name personalization.
 */
export function getGreeting(firstName: string | null): string {
  const hour = new Date().getHours();
  let base: string;
  if (hour >= 5 && hour < 12) base = 'Good morning';
  else if (hour >= 12 && hour < 17) base = 'Good afternoon';
  else if (hour >= 17 && hour < 22) base = 'Good evening';
  else base = 'Good night';
  return firstName ? `${base}, ${firstName}` : base;
}
