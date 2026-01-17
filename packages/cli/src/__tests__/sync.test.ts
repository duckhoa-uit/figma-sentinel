import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncCommand } from '../commands/sync.js';

// Mock the core module
vi.mock('@khoavhd/figma-sentinel-core', async () => {
  const actual = await vi.importActual<typeof import('@khoavhd/figma-sentinel-core')>(
    '@khoavhd/figma-sentinel-core'
  );
  return {
    ...actual,
    runSentinel: vi.fn(),
  };
});

// Mock resolveConfig
vi.mock('../config.js', () => ({
  resolveConfig: vi.fn().mockResolvedValue({
    config: { figmaToken: 'test-token' },
    configPath: null,
  }),
}));

// Import after mocking
import { runSentinel } from '@khoavhd/figma-sentinel-core';
import {
  FigmaSentinelError,
  FigmaAuthenticationError,
  FigmaNotFoundError,
  FigmaRateLimitError,
  FigmaServerError,
  FigmaNetworkError,
} from '@khoavhd/figma-sentinel-core';

const runSentinelMock = vi.mocked(runSentinel);

describe('syncCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.FIGMA_TOKEN = 'test-token';

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    runSentinelMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('exits with code 1 when runSentinel throws FigmaAuthenticationError', async () => {
      const authError = new FigmaAuthenticationError('401 Unauthorized');
      runSentinelMock.mockRejectedValueOnce(authError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Authentication failed');
    });

    it('exits with code 1 when runSentinel throws FigmaNotFoundError', async () => {
      const notFoundError = new FigmaNotFoundError('File not found', { fileKey: 'abc123' });
      runSentinelMock.mockRejectedValueOnce(notFoundError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('not found');
    });

    it('exits with code 1 when runSentinel throws FigmaRateLimitError', async () => {
      const rateLimitError = new FigmaRateLimitError('Rate limit exceeded', {
        retryAfterSec: 60,
        planTier: 'starter',
        rateLimitType: 'file_read',
      });
      runSentinelMock.mockRejectedValueOnce(rateLimitError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Rate limit exceeded');
    });

    it('exits with code 1 when runSentinel throws FigmaServerError', async () => {
      const serverError = new FigmaServerError('Internal server error');
      runSentinelMock.mockRejectedValueOnce(serverError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Figma server error');
    });

    it('exits with code 1 when runSentinel throws FigmaNetworkError', async () => {
      const networkError = new FigmaNetworkError('Connection timeout');
      runSentinelMock.mockRejectedValueOnce(networkError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Network error');
    });

    it('exits with code 1 when runSentinel throws generic FigmaSentinelError', async () => {
      const genericError = new FigmaSentinelError('Something went wrong', {
        code: 'UNKNOWN_ERROR',
      });
      runSentinelMock.mockRejectedValueOnce(genericError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when runSentinel throws non-Figma Error', async () => {
      const genericError = new Error('Something unexpected happened');
      runSentinelMock.mockRejectedValueOnce(genericError);

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Something unexpected happened');
    });

    it('exits with code 1 when FIGMA_TOKEN is not set', async () => {
      delete process.env.FIGMA_TOKEN;

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('FIGMA_TOKEN');
    });
  });

  describe('success output', () => {
    it('exits with code 0 when runSentinel succeeds', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 5,
        nodesProcessed: 10,
        apiCallCount: 3,
        errors: [],
      });

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(0);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Sync completed successfully');
    });

    it('shows changes summary when hasChanges is true', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: true,
        filesProcessed: 2,
        nodesProcessed: 4,
        apiCallCount: 2,
        errors: [],
        changeResult: {
          added: [{ id: '1', name: 'New' }],
          changed: [{ id: '2', name: 'Updated' }],
          removed: [],
        },
      });

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(0);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Changes detected');
    });
  });

  describe('--verbose flag', () => {
    it('runs successfully with verbose mode enabled', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 1,
        nodesProcessed: 1,
        apiCallCount: 1,
        errors: [],
      });

      await expect(syncCommand({ cwd: '/custom/path', verbose: true })).rejects.toThrow(
        'process.exit called'
      );

      // Verify verbose mode runs and outputs debug info including the cwd
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('/custom/path');
    });
  });

  describe('dry run mode', () => {
    it('shows dry run warning when dryRun is true', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 1,
        nodesProcessed: 1,
        apiCallCount: 1,
        errors: [],
      });

      await expect(syncCommand({ cwd: process.cwd(), dryRun: true })).rejects.toThrow(
        'process.exit called'
      );

      expect(exitSpy).toHaveBeenCalledWith(0);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Dry run mode');
    });
  });

  describe('result with errors (warnings)', () => {
    it('shows warnings when result has errors but success is true', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 1,
        nodesProcessed: 1,
        apiCallCount: 1,
        errors: ['Some warning message'],
      });

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(0);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Warnings');
      expect(allLogCalls).toContain('Some warning message');
    });

    it('exits with code 1 when result success is false', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: false,
        hasChanges: false,
        filesProcessed: 0,
        nodesProcessed: 0,
        apiCallCount: 0,
        errors: ['Failed to process files'],
      });

      await expect(syncCommand({ cwd: process.cwd() })).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allLogCalls = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(allLogCalls).toContain('Failed to process files');
    });
  });
});
