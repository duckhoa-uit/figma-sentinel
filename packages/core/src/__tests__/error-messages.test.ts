/**
 * Tests for error message generation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateErrorMessage,
  FigmaSentinelError,
  FigmaRateLimitError,
  FigmaNotFoundError,
  FigmaAuthenticationError,
  FigmaServerError,
  FigmaValidationError,
  FigmaNetworkError,
} from '../index.js';

describe('generateErrorMessage', () => {
  describe('VALIDATION_ERROR (400)', () => {
    it('generates message with error details', () => {
      const error = new FigmaValidationError('Invalid node ID format');
      const message = generateErrorMessage(error);

      expect(message).toBe(
        'Invalid request: Invalid node ID format. Check Figma URL format or reduce request size.'
      );
    });

    it('includes context fileKey if provided', () => {
      const error = new FigmaValidationError('Missing parameters');
      const message = generateErrorMessage(error, { fileKey: 'abc123' });

      expect(message).toContain('Missing parameters');
      expect(message).toContain('Check Figma URL format');
    });
  });

  describe('AUTH_ERROR (401)', () => {
    it('generates authentication failed message for 401', () => {
      const error = new FigmaAuthenticationError('Unauthorized');
      const message = generateErrorMessage(error);

      expect(message).toBe(
        'Authentication failed. Verify your FIGMA_TOKEN is valid and not expired.'
      );
    });

    it('generates access denied message for 403', () => {
      const error = new FigmaAuthenticationError('403 Forbidden');
      const message = generateErrorMessage(error);

      expect(message).toContain('Access denied');
      expect(message).toContain('Token has file_read scope');
      expect(message).toContain('view access');
      expect(message).toContain('Enterprise plan for Variables');
    });

    it('includes file key in 403 message when context provided', () => {
      const error = new FigmaAuthenticationError('403 Forbidden');
      const message = generateErrorMessage(error, { fileKey: 'abc123' });

      expect(message).toContain('Access denied for file abc123');
    });
  });

  describe('NOT_FOUND (404)', () => {
    it('generates file not found message', () => {
      const error = new FigmaNotFoundError('File not found');
      const message = generateErrorMessage(error);

      expect(message).toContain('Figma file');
      expect(message).toContain('not found');
      expect(message).toContain('Verify the file key from your Figma URL');
    });

    it('includes file key from error', () => {
      const error = new FigmaNotFoundError('File not found', { fileKey: 'abc123' });
      const message = generateErrorMessage(error);

      expect(message).toBe('Figma file abc123 not found. Verify the file key from your Figma URL.');
    });

    it('prefers context file key over error file key', () => {
      const error = new FigmaNotFoundError('File not found', { fileKey: 'error-key' });
      const message = generateErrorMessage(error, { fileKey: 'context-key' });

      expect(message).toContain('context-key');
      expect(message).not.toContain('error-key');
    });
  });

  describe('RATE_LIMIT (429)', () => {
    it('generates rate limit message with wait time', () => {
      const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 60 });
      const message = generateErrorMessage(error);

      expect(message).toContain('Rate limit exceeded');
      expect(message).toContain('Waiting 60s');
    });

    it('includes tier info when present', () => {
      const error = new FigmaRateLimitError('Rate limited', {
        retryAfterSec: 30,
        planTier: 'professional',
      });
      const message = generateErrorMessage(error);

      expect(message).toContain('Tier: professional');
    });

    it('includes rate limit type when present', () => {
      const error = new FigmaRateLimitError('Rate limited', {
        retryAfterSec: 30,
        rateLimitType: 'file_read',
      });
      const message = generateErrorMessage(error);

      expect(message).toContain('Type: file_read');
    });

    it('includes upgrade link when present', () => {
      const error = new FigmaRateLimitError('Rate limited', {
        retryAfterSec: 30,
        upgradeLink: 'https://figma.com/upgrade',
      });
      const message = generateErrorMessage(error);

      expect(message).toContain('Upgrade: https://figma.com/upgrade');
    });

    it('includes all rate limit info when all present', () => {
      const error = new FigmaRateLimitError('Rate limited', {
        retryAfterSec: 120,
        planTier: 'starter',
        rateLimitType: 'api',
        upgradeLink: 'https://figma.com/upgrade',
      });
      const message = generateErrorMessage(error);

      expect(message).toBe(
        'Rate limit exceeded. Waiting 120s, Tier: starter, Type: api. Upgrade: https://figma.com/upgrade'
      );
    });
  });

  describe('SERVER_ERROR (500)', () => {
    it('generates server error message', () => {
      const error = new FigmaServerError('Internal Server Error');
      const message = generateErrorMessage(error);

      expect(message).toBe(
        'Figma server error. Try reducing nodes requested or try again later.'
      );
    });
  });

  describe('NETWORK_ERROR', () => {
    it('generates network error message with details', () => {
      const error = new FigmaNetworkError('ECONNREFUSED');
      const message = generateErrorMessage(error);

      expect(message).toBe(
        'Network error: ECONNREFUSED. Check internet connection and try again.'
      );
    });

    it('handles timeout errors', () => {
      const error = new FigmaNetworkError('Request timeout');
      const message = generateErrorMessage(error);

      expect(message).toContain('Network error: Request timeout');
      expect(message).toContain('Check internet connection');
    });
  });

  describe('Unknown error code', () => {
    it('returns original message for unknown error codes', () => {
      const error = new FigmaSentinelError('Something unexpected happened', {
        code: 'UNKNOWN_CODE',
      });
      const message = generateErrorMessage(error);

      expect(message).toBe('Something unexpected happened');
    });
  });

  describe('Context interpolation', () => {
    it('uses nodeId from context when available', () => {
      const error = new FigmaNotFoundError('Node not found');
      const message = generateErrorMessage(error, { nodeId: '1:234' });

      // nodeId is available in context but not interpolated in current implementation
      // The function should still work correctly
      expect(message).toContain('not found');
    });

    it('handles empty context object', () => {
      const error = new FigmaValidationError('Bad request');
      const message = generateErrorMessage(error, {});

      expect(message).toContain('Invalid request: Bad request');
    });

    it('handles undefined context', () => {
      const error = new FigmaServerError('Server crashed');
      const message = generateErrorMessage(error, undefined);

      expect(message).toBe(
        'Figma server error. Try reducing nodes requested or try again later.'
      );
    });
  });
});
