/**
 * Error classes unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  FigmaSentinelError,
  FigmaRateLimitError,
  FigmaAuthenticationError,
  FigmaNotFoundError,
  FigmaServerError,
  FigmaValidationError,
  FigmaNetworkError,
} from '../errors.js';

describe('FigmaSentinelError', () => {
  it('extends Error', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
  });

  it('has correct name property', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST' });

    expect(error.name).toBe('FigmaSentinelError');
  });

  it('has code property', () => {
    const error = new FigmaSentinelError('Test error', { code: 'CUSTOM_CODE' });

    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('has message property', () => {
    const error = new FigmaSentinelError('My error message', { code: 'TEST' });

    expect(error.message).toBe('My error message');
  });

  it('defaults isRetryable to false', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST' });

    expect(error.isRetryable).toBe(false);
  });

  it('allows setting isRetryable to true', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST', isRetryable: true });

    expect(error.isRetryable).toBe(true);
  });

  it('has cause property when provided', () => {
    const originalError = new Error('Original error');
    const error = new FigmaSentinelError('Wrapped error', {
      code: 'TEST',
      cause: originalError,
    });

    expect(error.cause).toBe(originalError);
  });

  it('has undefined cause when not provided', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST' });

    expect(error.cause).toBeUndefined();
  });

  it('has stack trace', () => {
    const error = new FigmaSentinelError('Test error', { code: 'TEST' });

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });
});

describe('FigmaRateLimitError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 60 });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaRateLimitError);
  });

  it('has correct name property', () => {
    const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 60 });

    expect(error.name).toBe('FigmaRateLimitError');
  });

  it('has code RATE_LIMIT', () => {
    const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 60 });

    expect(error.code).toBe('RATE_LIMIT');
  });

  it('defaults isRetryable to true', () => {
    const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 60 });

    expect(error.isRetryable).toBe(true);
  });

  it('has retryAfterSec property', () => {
    const error = new FigmaRateLimitError('Rate limited', { retryAfterSec: 120 });

    expect(error.retryAfterSec).toBe(120);
  });

  it('has planTier property when provided', () => {
    const error = new FigmaRateLimitError('Rate limited', {
      retryAfterSec: 60,
      planTier: 'professional',
    });

    expect(error.planTier).toBe('professional');
  });

  it('has rateLimitType property when provided', () => {
    const error = new FigmaRateLimitError('Rate limited', {
      retryAfterSec: 60,
      rateLimitType: 'file_read',
    });

    expect(error.rateLimitType).toBe('file_read');
  });

  it('has upgradeLink property when provided', () => {
    const error = new FigmaRateLimitError('Rate limited', {
      retryAfterSec: 60,
      upgradeLink: 'https://figma.com/upgrade',
    });

    expect(error.upgradeLink).toBe('https://figma.com/upgrade');
  });

  it('has all rate limit properties', () => {
    const error = new FigmaRateLimitError('Rate limited', {
      retryAfterSec: 300,
      planTier: 'enterprise',
      rateLimitType: 'api_read',
      upgradeLink: 'https://figma.com/plans',
    });

    expect(error.retryAfterSec).toBe(300);
    expect(error.planTier).toBe('enterprise');
    expect(error.rateLimitType).toBe('api_read');
    expect(error.upgradeLink).toBe('https://figma.com/plans');
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('Fetch failed');
    const error = new FigmaRateLimitError('Rate limited', {
      retryAfterSec: 60,
      cause: originalError,
    });

    expect(error.cause).toBe(originalError);
  });
});

describe('FigmaAuthenticationError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaAuthenticationError('Auth failed');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaAuthenticationError);
  });

  it('has correct name property', () => {
    const error = new FigmaAuthenticationError('Auth failed');

    expect(error.name).toBe('FigmaAuthenticationError');
  });

  it('has code AUTH_ERROR', () => {
    const error = new FigmaAuthenticationError('Auth failed');

    expect(error.code).toBe('AUTH_ERROR');
  });

  it('has isRetryable false', () => {
    const error = new FigmaAuthenticationError('Auth failed');

    expect(error.isRetryable).toBe(false);
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('Invalid token');
    const error = new FigmaAuthenticationError('Auth failed', { cause: originalError });

    expect(error.cause).toBe(originalError);
  });
});

describe('FigmaNotFoundError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaNotFoundError('File not found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaNotFoundError);
  });

  it('has correct name property', () => {
    const error = new FigmaNotFoundError('File not found');

    expect(error.name).toBe('FigmaNotFoundError');
  });

  it('has code NOT_FOUND', () => {
    const error = new FigmaNotFoundError('File not found');

    expect(error.code).toBe('NOT_FOUND');
  });

  it('has isRetryable false', () => {
    const error = new FigmaNotFoundError('File not found');

    expect(error.isRetryable).toBe(false);
  });

  it('has fileKey property when provided', () => {
    const error = new FigmaNotFoundError('File not found', { fileKey: 'ABC123XYZ' });

    expect(error.fileKey).toBe('ABC123XYZ');
  });

  it('has undefined fileKey when not provided', () => {
    const error = new FigmaNotFoundError('File not found');

    expect(error.fileKey).toBeUndefined();
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('404 response');
    const error = new FigmaNotFoundError('File not found', {
      fileKey: 'XYZ',
      cause: originalError,
    });

    expect(error.cause).toBe(originalError);
    expect(error.fileKey).toBe('XYZ');
  });
});

describe('FigmaServerError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaServerError('Server error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaServerError);
  });

  it('has correct name property', () => {
    const error = new FigmaServerError('Server error');

    expect(error.name).toBe('FigmaServerError');
  });

  it('has code SERVER_ERROR', () => {
    const error = new FigmaServerError('Server error');

    expect(error.code).toBe('SERVER_ERROR');
  });

  it('has isRetryable false', () => {
    const error = new FigmaServerError('Server error');

    expect(error.isRetryable).toBe(false);
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('500 Internal Server Error');
    const error = new FigmaServerError('Server error', { cause: originalError });

    expect(error.cause).toBe(originalError);
  });
});

describe('FigmaValidationError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaValidationError('Invalid request');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaValidationError);
  });

  it('has correct name property', () => {
    const error = new FigmaValidationError('Invalid request');

    expect(error.name).toBe('FigmaValidationError');
  });

  it('has code VALIDATION_ERROR', () => {
    const error = new FigmaValidationError('Invalid request');

    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('has isRetryable false', () => {
    const error = new FigmaValidationError('Invalid request');

    expect(error.isRetryable).toBe(false);
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('Bad request');
    const error = new FigmaValidationError('Invalid request', { cause: originalError });

    expect(error.cause).toBe(originalError);
  });
});

describe('FigmaNetworkError', () => {
  it('extends FigmaSentinelError', () => {
    const error = new FigmaNetworkError('Network failed');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaSentinelError);
    expect(error).toBeInstanceOf(FigmaNetworkError);
  });

  it('has correct name property', () => {
    const error = new FigmaNetworkError('Network failed');

    expect(error.name).toBe('FigmaNetworkError');
  });

  it('has code NETWORK_ERROR', () => {
    const error = new FigmaNetworkError('Network failed');

    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('has isRetryable true (network errors are typically retryable)', () => {
    const error = new FigmaNetworkError('Network failed');

    expect(error.isRetryable).toBe(true);
  });

  it('supports error chaining with cause', () => {
    const originalError = new Error('Connection timeout');
    const error = new FigmaNetworkError('Network failed', { cause: originalError });

    expect(error.cause).toBe(originalError);
  });
});

describe('error chaining', () => {
  it('allows deep error chaining', () => {
    const rootCause = new Error('Socket hang up');
    const networkError = new FigmaNetworkError('Connection failed', { cause: rootCause });
    const sentinelError = new FigmaSentinelError('Request failed', {
      code: 'REQUEST_ERROR',
      cause: networkError,
    });

    expect(sentinelError.cause).toBe(networkError);
    expect((sentinelError.cause as FigmaNetworkError).cause).toBe(rootCause);
  });

  it('preserves error chain messages', () => {
    const original = new Error('Original cause');
    const wrapped = new FigmaServerError('Wrapped error', { cause: original });

    expect(wrapped.message).toBe('Wrapped error');
    expect((wrapped.cause as Error).message).toBe('Original cause');
  });
});
