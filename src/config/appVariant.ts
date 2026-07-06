/**
 * App Variant (Phase 17 — the two-app split)
 *
 * One codebase compiles into two store listings:
 *   • RideShare        (rider app)  — EXPO_PUBLIC_APP_VARIANT=rider
 *   • RideShare Driver (driver app) — EXPO_PUBLIC_APP_VARIANT=driver
 *
 * The variant is inlined at build time by the EAS profile (see eas.json:
 * preview-rider / preview-driver / production-rider / production-driver) and
 * drives BOTH build config (app.config.ts → name, package, scheme) and runtime
 * behavior (locked role in the onboarding funnel, variant-aware landing copy,
 * wrong-app guard in the root layout).
 *
 * When the variable is unset (local dev, plain `preview` profile, web) the app
 * runs in UNIVERSAL mode — the original single-app behavior where users pick
 * Rider or Driver in the funnel. This keeps one dev workflow for both apps.
 */

export type AppVariant = 'rider' | 'driver';

const raw = process.env.EXPO_PUBLIC_APP_VARIANT;

/** The compiled variant, or null in universal (single-app dev) mode. */
export const APP_VARIANT: AppVariant | null =
  raw === 'rider' || raw === 'driver' ? raw : null;

export const isRiderApp = APP_VARIANT === 'rider';
export const isDriverApp = APP_VARIANT === 'driver';
export const isUniversalApp = APP_VARIANT === null;

/** Display name of the *other* app, for the wrong-app guard. */
export const otherAppName = isRiderApp ? 'RideShare Driver' : 'RideShare';
