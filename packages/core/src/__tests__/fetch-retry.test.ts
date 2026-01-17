/**
 * Fetch retry logic unit tests
 *
 * Tests the fetchWithRetry behavior with Retry-After header support,
 * exponential backoff fallback, and max delay abort.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchNodes } from '../figma-client.js';
import type { FigmaDirective } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleNodeResponse = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/sample-node.json'), 'utf-8')
);

const originalFetch = global.fetch;

describe('fetchWithRetry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token-123' };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const testDirectives: FigmaDirective[] = [
    {
      sourceFile: '/src/components/Button.tsx',
      fileKey: 'ABC123',
      nodeIds: ['1:23'],
    },
  ];

  describe('Retry-After header support', () => {
    it('uses Retry-After header value for wait time', async () => {
      let callCount = 0;
      const retryAfterSeconds = 5;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({
              'Retry-After': String(retryAfterSeconds),
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);

      // Advance time by Retry-After value (5 seconds = 5000ms)
      await vi.advanceTimersByTimeAsync(retryAfterSeconds * 1000);

      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${retryAfterSeconds * 1000}ms`)
      );
    });

    it('parses Retry-After header with all rate limit headers', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({
              'Retry-After': '2',
              'X-Figma-Plan-Tier': 'starter',
              'X-Figma-Rate-Limit-Type': 'burst',
              'X-Figma-Upgrade-Link': 'https://figma.com/upgrade',
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);
      await vi.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('exponential backoff fallback', () => {
    it('falls back to exponential backoff when Retry-After header is missing', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers(), // No Retry-After header
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);

      // Initial backoff is 1000ms (INITIAL_BACKOFF_MS * 2^0)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1000ms'));
    });

    it('uses increasing backoff times for consecutive retries', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers(), // No Retry-After header
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);

      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // Second retry: 2000ms (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('max retry delay abort', () => {
    it('aborts when Retry-After exceeds max delay (1 hour)', async () => {
      const tooLongRetryAfter = 4000; // 4000 seconds > 3600 seconds (1 hour)

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'Retry-After': String(tooLongRetryAfter),
          'X-Figma-Upgrade-Link': 'https://figma.com/upgrade',
        }),
      } as Response);

      const result = await fetchNodes(testDirectives);

      // Should only call once and abort (not retry)
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.nodes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('exceeds maximum');
      expect(result.errors[0].message).toContain('upgrade');
    });

    it('throws FigmaRateLimitError with rate limit info when aborting', async () => {
      const tooLongRetryAfter = 7200; // 2 hours

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'Retry-After': String(tooLongRetryAfter),
          'X-Figma-Plan-Tier': 'starter',
          'X-Figma-Rate-Limit-Type': 'daily',
          'X-Figma-Upgrade-Link': 'https://figma.com/upgrade',
        }),
      } as Response);

      const result = await fetchNodes(testDirectives);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('7200s');
      expect(result.errors[0].message).toContain('3600s');
    });

    it('proceeds with retry when Retry-After is within max delay', async () => {
      let callCount = 0;
      const validRetryAfter = 30; // 30 seconds, well within 1 hour limit

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({
              'Retry-After': String(validRetryAfter),
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);
      await vi.advanceTimersByTimeAsync(validRetryAfter * 1000);
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('max retries behavior', () => {
    it('gives up after MAX_RETRIES attempts with Retry-After', async () => {
      const retryAfterSec = 1;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'Retry-After': String(retryAfterSec),
        }),
      } as Response);

      const resultPromise = fetchNodes(testDirectives);

      // Advance through all retry attempts (MAX_RETRIES = 3)
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(retryAfterSec * 1000);
      }

      const result = await resultPromise;

      // 1 initial call + 3 retries = 4 total calls
      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(result.nodes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Max retries');
    });

    it('gives up after MAX_RETRIES attempts with exponential backoff', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(), // No Retry-After, uses exponential backoff
      } as Response);

      const resultPromise = fetchNodes(testDirectives);

      // Advance through all retry attempts with exponential backoff
      // Retry 1: 1000ms, Retry 2: 2000ms, Retry 3: 4000ms
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(result.nodes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Max retries');
    });
  });

  describe('retry success scenarios', () => {
    it('succeeds after first retry with Retry-After', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({
              'Retry-After': '3',
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);
      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].nodeId).toBe('1:23');
    });

    it('succeeds after multiple retries', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({
              'Retry-After': '1',
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleNodeResponse,
        } as Response;
      });

      const resultPromise = fetchNodes(testDirectives);
      await vi.advanceTimersByTimeAsync(1000); // First retry
      await vi.advanceTimersByTimeAsync(1000); // Second retry
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result.nodes).toHaveLength(1);
    });
  });
});
