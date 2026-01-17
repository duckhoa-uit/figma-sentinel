/**
 * Actionable error message generator for Figma Sentinel errors.
 *
 * Generates user-friendly error messages with clear guidance on how to
 * resolve different types of Figma API errors.
 */

import { FigmaSentinelError, FigmaRateLimitError, FigmaNotFoundError } from './errors.js';

/**
 * Context information for error message generation.
 */
export interface ErrorMessageContext {
  /** The Figma file key that was being accessed */
  fileKey?: string;
  /** The Figma node ID that was being accessed */
  nodeId?: string;
}

/**
 * Generates a user-friendly, actionable error message for a Figma Sentinel error.
 *
 * @param error - The error to generate a message for
 * @param context - Optional context information for interpolation
 * @returns A user-friendly error message with guidance on resolution
 */
export function generateErrorMessage(
  error: FigmaSentinelError,
  context?: ErrorMessageContext
): string {
  const fileKey =
    context?.fileKey ??
    (error instanceof FigmaNotFoundError ? (error as FigmaNotFoundError).fileKey : undefined);

  switch (error.code) {
    case 'VALIDATION_ERROR':
      return `Invalid request: ${error.message}. Check Figma URL format or reduce request size.`;

    case 'AUTH_ERROR':
      if (error.message.includes('403')) {
        const fileRef = fileKey ? ` for file ${fileKey}` : '';
        return `Access denied${fileRef}. Check: 1) Token has file_read scope 2) You have view access 3) Enterprise plan for Variables.`;
      }
      return 'Authentication failed. Verify your FIGMA_TOKEN is valid and not expired.';

    case 'NOT_FOUND': {
      const notFoundError = error as FigmaNotFoundError;
      const key = context?.fileKey ?? notFoundError.fileKey;
      const fileRef = key ? ` ${key}` : '';
      return `Figma file${fileRef} not found. Verify the file key from your Figma URL.`;
    }

    case 'RATE_LIMIT': {
      const rateLimitError = error as FigmaRateLimitError;
      const waitTime = rateLimitError.retryAfterSec;
      const tierInfo = rateLimitError.planTier ? `, Tier: ${rateLimitError.planTier}` : '';
      const typeInfo = rateLimitError.rateLimitType ? `, Type: ${rateLimitError.rateLimitType}` : '';
      const upgradeInfo = rateLimitError.upgradeLink ? `. Upgrade: ${rateLimitError.upgradeLink}` : '';
      return `Rate limit exceeded. Waiting ${waitTime}s${tierInfo}${typeInfo}${upgradeInfo}`;
    }

    case 'SERVER_ERROR':
      return 'Figma server error. Try reducing nodes requested or try again later.';

    case 'NETWORK_ERROR':
      return `Network error: ${error.message}. Check internet connection and try again.`;

    default:
      return error.message;
  }
}
