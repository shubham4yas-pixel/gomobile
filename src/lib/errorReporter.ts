import { logger } from './logger';

/**
 * Error Reporting Abstraction (Phase 4)
 *
 * Provides a standardized interface for crash and exception reporting.
 * Currently forwards to the centralized logger, but serves as a drop-in
 * replacement layer for Sentry or Crashlytics in the future without
 * modifying UI or business logic components.
 */

class ErrorReporter {
  /**
   * Capture a hard exception/Error object.
   */
  captureException(error: Error | unknown, context?: Record<string, any>) {
    logger.error('[ErrorReporter] Exception caught:', error, context ? `Context: ${JSON.stringify(context)}` : '');
    // Future: Sentry.captureException(error, { extra: context })
  }

  /**
   * Capture a non-fatal message or breadcrumb.
   */
  captureMessage(message: string, context?: Record<string, any>) {
    logger.error(`[ErrorReporter] Message: ${message}`, context ? `Context: ${JSON.stringify(context)}` : '');
    // Future: Sentry.captureMessage(message, { extra: context })
  }

  /**
   * Attach user identity to future error reports.
   */
  setUser(userId: string | null, role?: string | null) {
    if (userId) {
      logger.info(`[ErrorReporter] User context set to ${userId} (${role || 'unknown'})`);
      // Future: Sentry.setUser({ id: userId, username: role })
    } else {
      logger.info(`[ErrorReporter] User context cleared`);
      // Future: Sentry.setUser(null)
    }
  }

  /**
   * Attach specific ride contextual tags to future error reports.
   */
  setRideContext(rideId: string | null, status?: string | null) {
    if (rideId) {
      logger.info(`[ErrorReporter] Ride context set to ${rideId} (${status || 'unknown'})`);
      // Future: Sentry.setTag("ride_id", rideId); Sentry.setTag("ride_status", status);
    } else {
      logger.info(`[ErrorReporter] Ride context cleared`);
      // Future: Sentry.setTag("ride_id", null); Sentry.setTag("ride_status", null);
    }
  }
}

export const errorReporter = new ErrorReporter();
