/**
 * Error classes for Figma Sentinel
 *
 * Provides typed error classes with structured properties for error handling,
 * retry logic, and user-facing error messages.
 */

/**
 * Base error class for all Figma Sentinel errors.
 * Extends Error with additional properties for error handling.
 */
export class FigmaSentinelError extends Error {
  /** Error code for programmatic identification */
  readonly code: string;

  /** Whether this error can be retried */
  readonly isRetryable: boolean;

  /** Original error that caused this error (for error chaining) */
  readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: string;
      isRetryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'FigmaSentinelError';
    this.code = options.code;
    this.isRetryable = options.isRetryable ?? false;
    this.cause = options.cause;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaSentinelError);
    }
  }
}
