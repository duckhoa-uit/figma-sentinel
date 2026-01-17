/**
 * Figma Client module unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { fetchNodes } from '../figma-client.js';
import type { FigmaDirective } from '../types.js';
import {
  FigmaNetworkError,
  FigmaAuthenticationError,
  FigmaNotFoundError,
  FigmaValidationError,
} from '../errors.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleNodeResponse = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures/sample-node.json'),
    'utf-8',
  ),
);

const originalFetch = global.fetch;

describe('fetchNodes', () => {
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

  it('fetches nodes successfully with mocked API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleNodeResponse,
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    const result = await fetchNodes(directives);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].nodeId).toBe('1:23');
    expect(result.nodes[0].node.name).toBe('Button');
    expect(result.nodes[0].sourceFiles).toContain('/src/components/Button.tsx');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.figma.com/v1/files/ABC123/nodes?ids=1%3A23'),
      expect.objectContaining({
        headers: { 'X-Figma-Token': 'test-token-123' },
      }),
    );
  });

  it('batches multiple nodes by file key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleNodeResponse,
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
      {
        sourceFile: '/src/components/Card.tsx',
        fileKey: 'ABC123',
        nodeIds: ['2:45'],
      },
    ];

    const result = await fetchNodes(directives);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/ids=1%3A23.*2%3A45|ids=2%3A45.*1%3A23/),
      expect.anything(),
    );

    expect(result.nodes).toHaveLength(2);
  });

  it('handles multiple file keys with separate API calls', async () => {
    const file1Response = {
      nodes: {
        '1:23': {
          document: {
            id: '1:23',
            name: 'Button',
            type: 'COMPONENT',
          },
        },
      },
    };

    const file2Response = {
      nodes: {
        '3:56': {
          document: {
            id: '3:56',
            name: 'Icon',
            type: 'FRAME',
          },
        },
      },
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => file1Response,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => file2Response,
      } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'FILE1',
        nodeIds: ['1:23'],
      },
      {
        sourceFile: '/src/components/Icon.tsx',
        fileKey: 'FILE2',
        nodeIds: ['3:56'],
      },
    ];

    const result = await fetchNodes(directives);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.nodes).toHaveLength(2);
  });

  it('handles rate limit response with retry', async () => {
    let callCount = 0;
    const rateLimitHeaders = new Headers({
      'Retry-After': '1',
    });
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: rateLimitHeaders,
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => sampleNodeResponse,
      } as Response;
    });

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    const result = await fetchNodes(directives);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.nodes).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited'),
    );
  }, 10000);

  it('handles rate limit max retries exceeded', async () => {
    const rateLimitHeaders = new Headers({
      'Retry-After': '1',
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: rateLimitHeaders,
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNetworkError);
    await expect(fetchNodes(directives)).rejects.toThrow('Max retries');
  }, 30000);

  it('handles network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network unavailable'));

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNetworkError);
    await expect(fetchNodes(directives)).rejects.toThrow('Network unavailable');
  });

  it('handles invalid token (403) error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaAuthenticationError);
    await expect(fetchNodes(directives)).rejects.toThrow('Access denied');
  });

  it('handles file not found (404) error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'NONEXISTENT',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNotFoundError);
    await expect(fetchNodes(directives)).rejects.toThrow('Figma file not found');
  });

  it('handles missing node in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nodes: {} }),
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaNotFoundError);
    await expect(fetchNodes(directives)).rejects.toThrow('not found in file');
  });

  it('handles invalid JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow(FigmaValidationError);
    await expect(fetchNodes(directives)).rejects.toThrow('Failed to parse');
  });

  it('throws error when FIGMA_TOKEN is missing', async () => {
    delete process.env.FIGMA_TOKEN;

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    await expect(fetchNodes(directives)).rejects.toThrow('FIGMA_TOKEN');
  });

  it('deduplicates node IDs from multiple directives', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleNodeResponse,
    } as Response);

    const directives: FigmaDirective[] = [
      {
        sourceFile: '/src/components/Button.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
      {
        sourceFile: '/src/components/ButtonVariant.tsx',
        fileKey: 'ABC123',
        nodeIds: ['1:23'],
      },
    ];

    const result = await fetchNodes(directives);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('ids=1%3A23'),
      expect.anything(),
    );
    const callUrl = (global.fetch as Mock).mock.calls[0][0];
    expect((callUrl.match(/1%3A23/g) || []).length).toBe(1);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].sourceFiles).toContain('/src/components/Button.tsx');
    expect(result.nodes[0].sourceFiles).toContain('/src/components/ButtonVariant.tsx');
  });
});
