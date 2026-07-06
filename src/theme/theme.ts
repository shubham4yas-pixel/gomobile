/**
 * Design System Tokens — Premium mobility edition
 *
 * Crisp white surfaces, deep blue for primary actions, measured gold for
 * trust signals, and cooler secondary accents for useful context.
 * Keep components referencing these tokens instead of hard-coded values so
 * the look stays cohesive.
 */

export const colors = {
  // Surfaces (crisp white, barely-there cool tint)
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceElevated: '#F3F6FB',
  surfacePressed: '#EEF3FA',
  sheet: '#FFFFFF',
  hairline: '#E6EBF4',
  hairlineStrong: '#CBD5E6',

  // Text (deep navy, not pure black — softer on white)
  textPrimary: '#0A1B3D',
  textSecondary: '#4E5F7D',
  textMuted: '#93A0B8',

  // Brand / role accents
  rider: '#1E40AF', // deep premium blue (primary brand)
  driver: '#C9971C', // elegant gold (role differentiation)
  navy: '#0A1B3D', // headers / hero surfaces
  gold: '#C9971C', // star ratings, active toggles, premium options
  goldSoft: '#F6E8C4', // gold tint for chips/selected backgrounds
  teal: '#0F766E',
  tealSoft: '#DDF7F3',
  sky: '#2563EB',
  skySoft: '#DBEAFE',
  coral: '#E35D47',
  coralSoft: '#FCE7E1',

  // Semantic
  success: '#10B981',
  danger: '#EF4444',
  warning: '#D97706',

  // Deep blue CTA gradient
  ctaTop: '#2E5BDB',
  ctaBottom: '#1E3A8A',

  white: '#FFFFFF',
  black: '#000000',

  // Compat alias (Phase 19): the parallel payment/OTP feature refers to the
  // brand primary as `colors.primary`. Maps to the vibrant action blue (`rider`).
  primary: '#1E40AF',
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
  /** Compat alias for the parallel feature — same as `pill`. */
  full: 999,
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

/**
 * Font families (Phase 17) — Inter, loaded in the root layout via
 * @expo-google-fonts/inter. Always pair fontFamily with the matching weight
 * file; never set fontWeight alongside these (Android picks the wrong face).
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',

  // Compat aliases (Phase 19) — the parallel payment/OTP feature spreads these
  // as full text STYLES (`...fonts.heading2`), so they are objects (mirroring
  // the `type` scale below), unlike the family-string tokens above.
  bodyRegular: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 22 },
  heading2: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  heading3: { fontFamily: 'Inter_600SemiBold', fontSize: 19, lineHeight: 24, letterSpacing: 0 },
} as const;

/**
 * Type scale (Phase 17) — the strict hierarchy. Spread these into styles
 * (e.g. `...type.title`) instead of hand-picking sizes so the rhythm stays
 * consistent across screens.
 */
export const type = {
  /** Hero numerals / brand name */
  display: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 40, letterSpacing: 0 },
  /** Screen titles */
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: 0 },
  /** Card / section headings */
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: 0 },
  /** Default body copy */
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  /** Input labels, buttons, badges */
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0.1 },
  /** Timestamps, helper text, footnotes */
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
} as const;

/**
 * Multi-layered soft shadows (Phase 17) — CSS-style `boxShadow` strings,
 * supported natively on the New Architecture (RN 0.76+) and on web. A tight
 * contact shadow + a wide ambient shadow reads far more "physical" than a
 * single blur. Use as `style={{ boxShadow: elevationShadows.raised }}`.
 * (Legacy `shadows.*` presets below remain for existing components.)
 */
export const elevationShadows = {
  /** Resting cards, list rows */
  soft: '0 1px 2px rgba(10,27,61,0.06), 0 6px 16px rgba(10,27,61,0.07)',
  /** Interactive cards, form panels */
  raised: '0 2px 4px rgba(10,27,61,0.08), 0 12px 28px rgba(10,27,61,0.10)',
  /** CTAs, floating action buttons, sheets */
  floating: '0 2px 6px rgba(10,27,61,0.10), 0 10px 22px rgba(30,64,175,0.16), 0 24px 48px rgba(10,27,61,0.12)',
  /** Gold-tinted glow for premium accents */
  goldGlow: '0 2px 6px rgba(201,151,28,0.18), 0 10px 26px rgba(201,151,28,0.22)',
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
