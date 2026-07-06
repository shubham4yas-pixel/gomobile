/**
 * Colors sub-barrel (Phase 19) — re-exports the color tokens + helpers from
 * ./theme so `@/theme/colors` resolves. Supports the parallel payment/OTP
 * feature's import convention; the canonical source stays `./theme`.
 */
export { colors, withAlpha, idealTextOn, accentFor } from './theme';
