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

/**
 * Error thrown when Figma API returns a 429 rate limit response.
 * Contains Figma-specific rate limit headers for retry logic.
 */
export class FigmaRateLimitError extends FigmaSentinelError {
  /** Number of seconds to wait before retrying (from Retry-After header) */
  readonly retryAfterSec: number;

  /** Figma plan tier from X-Figma-Plan-Tier header */
  readonly planTier?: string;

  /** Rate limit type from X-Figma-Rate-Limit-Type header */
  readonly rateLimitType?: string;

  /** Upgrade link from X-Figma-Upgrade-Link header */
  readonly upgradeLink?: string;

  constructor(
    message: string,
    options: {
      retryAfterSec: number;
      planTier?: string;
      rateLimitType?: string;
      upgradeLink?: string;
      cause?: Error;
    }
  ) {
    super(message, {
      code: 'RATE_LIMIT',
      isRetryable: true,
      cause: options.cause,
    });
    this.name = 'FigmaRateLimitError';
    this.retryAfterSec = options.retryAfterSec;
    this.planTier = options.planTier;
    this.rateLimitType = options.rateLimitType;
    this.upgradeLink = options.upgradeLink;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaRateLimitError);
    }
  }
}

/**
 * Error thrown when Figma API returns 401 or 403 authentication/authorization error.
 */
export class FigmaAuthenticationError extends FigmaSentinelError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, {
      code: 'AUTH_ERROR',
      isRetryable: false,
      cause: options?.cause,
    });
    this.name = 'FigmaAuthenticationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaAuthenticationError);
    }
  }
}

/**
 * Error thrown when Figma API returns 404 not found error.
 */
export class FigmaNotFoundError extends FigmaSentinelError {
  /** The file key that was not found */
  readonly fileKey?: string;

  constructor(message: string, options?: { fileKey?: string; cause?: Error }) {
    super(message, {
      code: 'NOT_FOUND',
      isRetryable: false,
      cause: options?.cause,
    });
    this.name = 'FigmaNotFoundError';
    this.fileKey = options?.fileKey;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaNotFoundError);
    }
  }
}

/**
 * Error thrown when Figma API returns 500 server error.
 */
export class FigmaServerError extends FigmaSentinelError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, {
      code: 'SERVER_ERROR',
      isRetryable: false,
      cause: options?.cause,
    });
    this.name = 'FigmaServerError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaServerError);
    }
  }
}

/**
 * Error thrown when Figma API returns 400 validation error.
 */
export class FigmaValidationError extends FigmaSentinelError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, {
      code: 'VALIDATION_ERROR',
      isRetryable: false,
      cause: options?.cause,
    });
    this.name = 'FigmaValidationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaValidationError);
    }
  }
}

/**
 * Error thrown when a network error occurs (connection failed, timeout, etc.).
 * Network errors are typically retryable.
 */
export class FigmaNetworkError extends FigmaSentinelError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, {
      code: 'NETWORK_ERROR',
      isRetryable: true,
      cause: options?.cause,
    });
    this.name = 'FigmaNetworkError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FigmaNetworkError);
    }
  }
}
