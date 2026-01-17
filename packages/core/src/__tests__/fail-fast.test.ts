/**
 * Fail-fast behavior unit tests
 *
 * Tests that fetchNodes stops execution immediately on first error
 * rather than collecting errors and continuing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchNodes } from '../figma-client.js';
import type { FigmaDirective } from '../types.js';
import {
  FigmaNotFoundError,
  FigmaAuthenticationError,
  FigmaServerError,
  FigmaNetworkError,
} from '../errors.js';

const originalFetch = global.fetch;

describe('fetchNodes fail-fast behavior', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token-123' };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('stops execution after first error from multiple file requests', async () => {
    let fetchCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCallCount++;
      // First request succeeds
      if (url.includes('FILE1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            nodes: {
              '1:1': {
                document: { id: '1:1', name: 'Node1', type: 'FRAME' },
              },
            },
          }),
        };
      }
      // Second request fails with 404
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
      { sourceFile: '/b.tsx', fileKey: 'FILE2', nodeIds: ['2:2'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNotFoundError);

    // Both requests started (Promise.all), but error propagates from failed one
    expect(fetchCallCount).toBe(2);
  });

  it('throws FigmaAuthenticationError on 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaAuthenticationError);
    await expect(fetchNodes(directives)).rejects.toThrow('Authentication failed');
  });

  it('throws FigmaAuthenticationError on 403 response with file key context', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'ABC123', nodeIds: ['1:1'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaAuthenticationError);
    await expect(fetchNodes(directives)).rejects.toThrow('ABC123');
  });

  it('throws FigmaNotFoundError with fileKey on 404 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'MISSING_FILE', nodeIds: ['1:1'] },
    ];

    try {
      await fetchNodes(directives);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FigmaNotFoundError);
      expect((error as FigmaNotFoundError).fileKey).toBe('MISSING_FILE');
      expect((error as FigmaNotFoundError).message).toContain('MISSING_FILE');
    }
  });

  it('throws FigmaNotFoundError with fileKey when node is missing from response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        nodes: {
          '1:1': {
            document: { id: '1:1', name: 'Node1', type: 'FRAME' },
          },
          // Node '2:2' is missing from the response
        },
      }),
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1', '2:2'] },
    ];

    try {
      await fetchNodes(directives);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FigmaNotFoundError);
      expect((error as FigmaNotFoundError).fileKey).toBe('FILE1');
      expect((error as FigmaNotFoundError).message).toContain('2:2');
      expect((error as FigmaNotFoundError).message).toContain('FILE1');
    }
  });

  it('throws FigmaServerError on 500 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaServerError);
    await expect(fetchNodes(directives)).rejects.toThrow('Figma server error');
  });

  it('throws FigmaServerError on 502 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaServerError);
    await expect(fetchNodes(directives)).rejects.toThrow('502');
  });

  it('throws FigmaNetworkError when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNetworkError);
    await expect(fetchNodes(directives)).rejects.toThrow('Connection refused');
  });

  it('first error propagates even when processing multiple files', async () => {
    const callOrder: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('FILE1')) {
        callOrder.push('FILE1');
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        };
      }
      if (url.includes('FILE2')) {
        callOrder.push('FILE2');
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        };
      }
      callOrder.push('FILE3');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          nodes: {
            '3:3': { document: { id: '3:3', name: 'Node3', type: 'FRAME' } },
          },
        }),
      };
    });

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
      { sourceFile: '/b.tsx', fileKey: 'FILE2', nodeIds: ['2:2'] },
      { sourceFile: '/c.tsx', fileKey: 'FILE3', nodeIds: ['3:3'] },
    ];

    // Promise.all will reject with one of the errors (order not guaranteed)
    await expect(fetchNodes(directives)).rejects.toThrow();

    // All requests were initiated (due to Promise.all), but the first rejection propagates
    expect(callOrder.length).toBe(3);
  });

  it('error includes cause chain when network error wraps original error', async () => {
    const originalError = new Error('DNS resolution failed');
    global.fetch = vi.fn().mockRejectedValue(originalError);

    const directives: FigmaDirective[] = [
      { sourceFile: '/a.tsx', fileKey: 'FILE1', nodeIds: ['1:1'] },
    ];

    try {
      await fetchNodes(directives);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FigmaNetworkError);
      expect((error as FigmaNetworkError).cause).toBe(originalError);
    }
  });
});
