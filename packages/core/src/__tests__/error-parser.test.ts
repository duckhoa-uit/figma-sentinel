import { describe, it, expect } from 'vitest';
import {
  parseErrorResponse,
  parseRateLimitHeaders,
  type RateLimitHeaders,
} from '../error-parser.js';

describe('parseRateLimitHeaders', () => {
  it('extracts Retry-After header as number', () => {
    const headers = new Headers({ 'Retry-After': '60' });
    const result = parseRateLimitHeaders(headers);
    expect(result.retryAfterSec).toBe(60);
  });

  it('extracts X-Figma-Plan-Tier header', () => {
    const headers = new Headers({ 'X-Figma-Plan-Tier': 'professional' });
    const result = parseRateLimitHeaders(headers);
    expect(result.planTier).toBe('professional');
  });

  it('extracts X-Figma-Rate-Limit-Type header', () => {
    const headers = new Headers({ 'X-Figma-Rate-Limit-Type': 'api' });
    const result = parseRateLimitHeaders(headers);
    expect(result.rateLimitType).toBe('api');
  });

  it('extracts X-Figma-Upgrade-Link header', () => {
    const headers = new Headers({
      'X-Figma-Upgrade-Link': 'https://www.figma.com/pricing',
    });
    const result = parseRateLimitHeaders(headers);
    expect(result.upgradeLink).toBe('https://www.figma.com/pricing');
  });

  it('extracts all headers when present', () => {
    const headers = new Headers({
      'Retry-After': '120',
      'X-Figma-Plan-Tier': 'organization',
      'X-Figma-Rate-Limit-Type': 'file',
      'X-Figma-Upgrade-Link': 'https://figma.com/upgrade',
    });
    const result = parseRateLimitHeaders(headers);
    expect(result).toEqual<RateLimitHeaders>({
      retryAfterSec: 120,
      planTier: 'organization',
      rateLimitType: 'file',
      upgradeLink: 'https://figma.com/upgrade',
    });
  });

  it('returns empty object when no headers present', () => {
    const headers = new Headers();
    const result = parseRateLimitHeaders(headers);
    expect(result).toEqual<RateLimitHeaders>({});
  });

  it('ignores invalid Retry-After value', () => {
    const headers = new Headers({ 'Retry-After': 'invalid' });
    const result = parseRateLimitHeaders(headers);
    expect(result.retryAfterSec).toBeUndefined();
  });

  it('handles Retry-After with leading/trailing whitespace', () => {
    const headers = new Headers({ 'Retry-After': ' 30 ' });
    const result = parseRateLimitHeaders(headers);
    expect(result.retryAfterSec).toBe(30);
  });
});

describe('parseErrorResponse', () => {
  function createResponse(
    status: number,
    body: string | object,
    headers?: Record<string, string>
  ): Response {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(bodyString, {
      status,
      statusText: getStatusText(status),
      headers: headers ? new Headers(headers) : undefined,
    });
  }

  function getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return statusTexts[status] ?? 'Unknown';
  }

  describe('parsing {status, err} format', () => {
    it('extracts message from err field', async () => {
      const response = createResponse(400, { status: 400, err: 'Invalid parameters' });
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Invalid parameters');
    });

    it('handles 404 errors', async () => {
      const response = createResponse(404, { status: 404, err: 'File not found' });
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(404);
      expect(result.message).toBe('File not found');
    });

    it('handles 500 errors', async () => {
      const response = createResponse(500, { status: 500, err: 'Internal error' });
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(500);
      expect(result.message).toBe('Internal error');
    });
  });

  describe('parsing {error: true, status, message} format', () => {
    it('extracts message from message field', async () => {
      const response = createResponse(403, {
        error: true,
        status: 403,
        message: 'Access denied',
      });
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(403);
      expect(result.message).toBe('Access denied');
    });

    it('handles authentication errors', async () => {
      const response = createResponse(401, {
        error: true,
        status: 401,
        message: 'Invalid token',
      });
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(401);
      expect(result.message).toBe('Invalid token');
    });
  });

  describe('header extraction', () => {
    it('includes rate limit headers in result', async () => {
      const response = createResponse(
        429,
        { status: 429, err: 'Rate limited' },
        {
          'Retry-After': '60',
          'X-Figma-Plan-Tier': 'starter',
          'X-Figma-Rate-Limit-Type': 'api',
          'X-Figma-Upgrade-Link': 'https://figma.com/upgrade',
        }
      );
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(429);
      expect(result.message).toBe('Rate limited');
      expect(result.rateLimitHeaders).toEqual<RateLimitHeaders>({
        retryAfterSec: 60,
        planTier: 'starter',
        rateLimitType: 'api',
        upgradeLink: 'https://figma.com/upgrade',
      });
    });

    it('returns empty rateLimitHeaders when headers missing', async () => {
      const response = createResponse(400, { status: 400, err: 'Bad request' });
      const result = await parseErrorResponse(response);
      expect(result.rateLimitHeaders).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('handles empty response body', async () => {
      const response = createResponse(500, '');
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(500);
      expect(result.message).toBe('HTTP 500: Internal Server Error');
    });

    it('handles non-JSON response body', async () => {
      const response = createResponse(500, 'Gateway timeout');
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(500);
      expect(result.message).toBe('Gateway timeout');
    });

    it('handles very long non-JSON response', async () => {
      const longText = 'x'.repeat(300);
      const response = createResponse(500, longText);
      const result = await parseErrorResponse(response);
      expect(result.status).toBe(500);
      expect(result.message).toBe('HTTP 500: Internal Server Error');
    });

    it('handles unknown JSON structure with message field', async () => {
      const response = createResponse(400, {
        success: false,
        message: 'Something went wrong',
      });
      const result = await parseErrorResponse(response);
      expect(result.message).toBe('Something went wrong');
    });

    it('handles unknown JSON structure with error string field', async () => {
      const response = createResponse(400, {
        success: false,
        error: 'Custom error message',
      });
      const result = await parseErrorResponse(response);
      expect(result.message).toBe('Custom error message');
    });
  });
});
