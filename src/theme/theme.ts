/**
 * Design System Tokens
 *
 * Vibrant, whitish, blue aesthetic — airy light surfaces, deep-navy text,
 * and an electric-blue primary. Keep components referencing these tokens
 * instead of hard-coded values so the look stays cohesive.
 */

export const colors = {
  // Surfaces (whitish, faint blue tint)
  background: '#EEF3FC',
  surface: '#FFFFFF',
  surfaceElevated: '#F6F9FF',
  sheet: '#FFFFFF',
  hairline: '#E5ECF7',
  hairlineStrong: '#CBD8EC',

  // Text (deep navy, not pure black — softer on white)
  textPrimary: '#0C1A33',
  textSecondary: '#586A86',
  textMuted: '#95A3BA',

  // Brand / role accents
  rider: '#2563EB', // vibrant blue
  driver: '#F59E0B', // warm amber (role differentiation)

  // Semantic
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',

  // Vibrant blue CTA gradient
  ctaTop: '#4F8DFF',
  ctaBottom: '#2563EB',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const typography = {
  weightRegular: '500',
  weightMedium: '600',
  weightBold: '700',
  weightHeavy: '800',
} as const;

/** Soft, blue-tinted elevation presets for the light theme. */
export const shadows = {
  card: {
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  sheet: {
    shadowColor: '#1B2B4B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 20,
  },
  glow: (hex: string) => ({
    shadowColor: hex,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  }),
} as const;

/** Returns the role's accent color. */
export const accentFor = (role: 'rider' | 'driver' | null | undefined) =>
  role === 'driver' ? colors.driver : colors.rider;

/** Append an 8-bit alpha (0-255) hex suffix to a 6-digit hex color. */
export const withAlpha = (hex: string, alpha: number) => {
  const clamped = Math.max(0, Math.min(255, Math.round(alpha)));
  return hex + clamped.toString(16).padStart(2, '0').toUpperCase();
};

/** Pick black/white text for legibility on a given background color. */
export const idealTextOn = (hex: string) => {
  const c = hex.replace('#', '');
  if (c.length < 6) return colors.white;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? colors.textPrimary : colors.white;
};
