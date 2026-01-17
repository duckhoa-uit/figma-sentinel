/**
 * Error Parser for Figma API responses
 *
 * Parses Figma API error responses and rate limit headers
 * to extract structured error information.
 */

/**
 * Figma error response format with 'err' field
 * Example: { "status": 400, "err": "Invalid parameters" }
 */
export interface ErrorResponsePayloadWithErrMessage {
  status: number;
  err: string;
}

/**
 * Figma error response format with 'error' boolean and 'message' field
 * Example: { "error": true, "status": 404, "message": "Not found" }
 */
export interface ErrorResponsePayloadWithErrorBoolean {
  error: true;
  status: number;
  message: string;
}

/**
 * Union type for both Figma API error response formats
 */
export type FigmaErrorPayload =
  | ErrorResponsePayloadWithErrMessage
  | ErrorResponsePayloadWithErrorBoolean;

/**
 * Parsed rate limit headers from Figma API response
 */
export interface RateLimitHeaders {
  /** Number of seconds to wait before retrying */
  retryAfterSec?: number;
  /** Figma plan tier (e.g., 'professional', 'organization') */
  planTier?: string;
  /** Type of rate limit (e.g., 'api', 'file') */
  rateLimitType?: string;
  /** Link to upgrade Figma plan */
  upgradeLink?: string;
}

/**
 * Structured error information parsed from Figma API response
 */
export interface ParsedErrorResponse {
  /** HTTP status code */
  status: number;
  /** Error message from response body */
  message: string;
  /** Parsed rate limit headers (if present) */
  rateLimitHeaders: RateLimitHeaders;
}

/**
 * Parse rate limit headers from Figma API response.
 *
 * @param headers - Response headers from Figma API
 * @returns Parsed rate limit information
 *
 * @example
 * ```ts
 * const headers = new Headers({
 *   'Retry-After': '60',
 *   'X-Figma-Plan-Tier': 'professional'
 * });
 * const rateLimitInfo = parseRateLimitHeaders(headers);
 * // { retryAfterSec: 60, planTier: 'professional' }
 * ```
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitHeaders {
  const result: RateLimitHeaders = {};

  // Parse Retry-After header (seconds)
  const retryAfter = headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      result.retryAfterSec = seconds;
    }
  }

  // Parse X-Figma-Plan-Tier header
  const planTier = headers.get('X-Figma-Plan-Tier');
  if (planTier) {
    result.planTier = planTier;
  }

  // Parse X-Figma-Rate-Limit-Type header
  const rateLimitType = headers.get('X-Figma-Rate-Limit-Type');
  if (rateLimitType) {
    result.rateLimitType = rateLimitType;
  }

  // Parse X-Figma-Upgrade-Link header
  const upgradeLink = headers.get('X-Figma-Upgrade-Link');
  if (upgradeLink) {
    result.upgradeLink = upgradeLink;
  }

  return result;
}

/**
 * Type guard to check if payload is ErrorResponsePayloadWithErrMessage format
 */
function isErrMessageFormat(payload: unknown): payload is ErrorResponsePayloadWithErrMessage {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    'err' in payload &&
    typeof (payload as ErrorResponsePayloadWithErrMessage).err === 'string'
  );
}

/**
 * Type guard to check if payload is ErrorResponsePayloadWithErrorBoolean format
 */
function isErrorBooleanFormat(payload: unknown): payload is ErrorResponsePayloadWithErrorBoolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    (payload as ErrorResponsePayloadWithErrorBoolean).error === true &&
    'message' in payload &&
    typeof (payload as ErrorResponsePayloadWithErrorBoolean).message === 'string'
  );
}

/**
 * Parse a Figma API error response.
 *
 * Figma API returns errors in two formats:
 * 1. `{ status: number, err: string }` - ErrorResponsePayloadWithErrMessage
 * 2. `{ error: true, status: number, message: string }` - ErrorResponsePayloadWithErrorBoolean
 *
 * @param response - Fetch Response object from Figma API
 * @returns Structured error information with status, message, and headers
 *
 * @example
 * ```ts
 * const response = await fetch('https://api.figma.com/v1/files/...');
 * if (!response.ok) {
 *   const errorInfo = await parseErrorResponse(response);
 *   console.log(errorInfo.message); // "File not found"
 *   console.log(errorInfo.status); // 404
 * }
 * ```
 */
export async function parseErrorResponse(response: Response): Promise<ParsedErrorResponse> {
  const status = response.status;
  const rateLimitHeaders = parseRateLimitHeaders(response.headers);

  let message = `HTTP ${status}: ${response.statusText}`;

  try {
    const text = await response.text();
    if (text) {
      try {
        const payload = JSON.parse(text) as unknown;

        // Check for { status, err } format
        if (isErrMessageFormat(payload)) {
          message = payload.err;
        }
        // Check for { error: true, status, message } format
        else if (isErrorBooleanFormat(payload)) {
          message = payload.message;
        }
        // Unknown JSON format - use as-is if it's a string
        else if (typeof payload === 'object' && payload !== null) {
          // Try to extract any message-like field
          const obj = payload as Record<string, unknown>;
          if (typeof obj.message === 'string') {
            message = obj.message;
          } else if (typeof obj.error === 'string') {
            message = obj.error;
          }
        }
      } catch {
        // Not valid JSON, use raw text if it's not too long
        if (text.length <= 200) {
          message = text;
        }
      }
    }
  } catch {
    // Failed to read response body, use default message
  }

  return {
    status,
    message,
    rateLimitHeaders,
  };
}
