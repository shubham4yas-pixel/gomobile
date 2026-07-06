/**
 * Theme barrel (Phase 19) — re-exports everything from ./theme so imports can
 * use `@/theme` as well as `@/theme/theme`. Added to support the parallel
 * payment/OTP feature, which imports from `@/theme` and `@/theme/colors`.
 */
export * from './theme';
