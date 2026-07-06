/**
 * Centralised Logging Utility (Phase 4)
 *
 * All development logging should go through this logger instead of raw console.* calls.
 * In production builds, debug and info logs are silenced to preserve JS thread performance.
 * Error logs remain active for debugging and external crash reporting integrations.
 */

class Logger {
  private isProduction = process.env.NODE_ENV !== 'development';

  debug(...args: any[]) {
    if (this.isProduction) return;
    console.debug(...args);
  }

  info(...args: any[]) {
    if (this.isProduction) return;
    console.info(...args);
  }

  warn(...args: any[]) {
    if (this.isProduction) return;
    console.warn(...args);
  }

  error(...args: any[]) {
    // We explicitly allow error logs in production to ensure critical
    // failures are captured by native crash reporters or terminal logs.
    console.error(...args);
  }
}

export const logger = new Logger();
