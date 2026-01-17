import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  exportVariable: vi.fn(),
}));

// Mock the core module
vi.mock('@khoavhd/figma-sentinel-core', async () => {
  const actual = await vi.importActual<typeof import('@khoavhd/figma-sentinel-core')>(
    '@khoavhd/figma-sentinel-core'
  );
  return {
    ...actual,
    runSentinel: vi.fn(),
    loadConfig: vi.fn().mockReturnValue({ config: {} }),
    mergeConfig: vi.fn().mockImplementation((c) => c),
  };
});

// Mock the pr module
vi.mock('../pr.js', () => ({
  createOrUpdatePR: vi.fn(),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  getBaseBranch: vi.fn().mockReturnValue('main'),
  parseLabels: vi.fn().mockReturnValue([]),
  parseReviewers: vi.fn().mockReturnValue([]),
}));

// Import after mocking
import * as core from '@actions/core';
import { runSentinel } from '@khoavhd/figma-sentinel-core';
import {
  FigmaSentinelError,
  FigmaAuthenticationError,
  FigmaNotFoundError,
  FigmaRateLimitError,
  FigmaServerError,
  FigmaNetworkError,
} from '@khoavhd/figma-sentinel-core';
import { run } from '../index.js';

const runSentinelMock = vi.mocked(runSentinel);
const getInputMock = vi.mocked(core.getInput);
const getBooleanInputMock = vi.mocked(core.getBooleanInput);
const setOutputMock = vi.mocked(core.setOutput);
const setFailedMock = vi.mocked(core.setFailed);

describe('GitHub Action index', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GITHUB_WORKSPACE = '/test/workspace';

    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    getInputMock.mockImplementation((name: string) => {
      if (name === 'figma-token') return 'test-token';
      if (name === 'config-path') return '';
      if (name === 'pr-title') return '';
      if (name === 'pr-labels') return '';
      if (name === 'pr-reviewers') return '';
      return '';
    });
    getBooleanInputMock.mockImplementation((name: string) => {
      if (name === 'dry-run') return false;
      if (name === 'create-pr') return false;
      return false;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('sets error-count to 1 when FigmaAuthenticationError is thrown', async () => {
      const authError = new FigmaAuthenticationError('401 Unauthorized');
      runSentinelMock.mockRejectedValueOnce(authError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
    });

    it('sets error-details with JSON for FigmaAuthenticationError', async () => {
      const authError = new FigmaAuthenticationError('401 Unauthorized');
      runSentinelMock.mockRejectedValueOnce(authError);

      await run();

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('AUTH_ERROR');
      expect(errorDetails.isRetryable).toBe(false);
    });

    it('calls setFailed with actionable message for FigmaAuthenticationError', async () => {
      const authError = new FigmaAuthenticationError('401 Unauthorized');
      runSentinelMock.mockRejectedValueOnce(authError);

      await run();

      expect(setFailedMock).toHaveBeenCalled();
      const message = setFailedMock.mock.calls[0][0] as string;
      expect(message).toContain('Authentication failed');
      expect(message).toContain('FIGMA_TOKEN');
    });

    it('sets error-count to 1 when FigmaNotFoundError is thrown', async () => {
      const notFoundError = new FigmaNotFoundError('File not found', { fileKey: 'abc123' });
      runSentinelMock.mockRejectedValueOnce(notFoundError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
    });

    it('sets error-details with JSON for FigmaNotFoundError', async () => {
      const notFoundError = new FigmaNotFoundError('File not found', { fileKey: 'abc123' });
      runSentinelMock.mockRejectedValueOnce(notFoundError);

      await run();

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('NOT_FOUND');
    });

    it('calls setFailed with actionable message for FigmaRateLimitError', async () => {
      const rateLimitError = new FigmaRateLimitError('Rate limit exceeded', {
        retryAfterSec: 60,
        planTier: 'starter',
        rateLimitType: 'file_read',
        upgradeLink: 'https://figma.com/upgrade',
      });
      runSentinelMock.mockRejectedValueOnce(rateLimitError);

      await run();

      expect(setFailedMock).toHaveBeenCalled();
      const message = setFailedMock.mock.calls[0][0] as string;
      expect(message).toContain('Rate limit exceeded');
    });

    it('sets error-details with isRetryable true for FigmaRateLimitError', async () => {
      const rateLimitError = new FigmaRateLimitError('Rate limit exceeded', {
        retryAfterSec: 60,
      });
      runSentinelMock.mockRejectedValueOnce(rateLimitError);

      await run();

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('RATE_LIMIT');
      expect(errorDetails.isRetryable).toBe(true);
    });

    it('sets error-count to 1 when FigmaServerError is thrown', async () => {
      const serverError = new FigmaServerError('Internal server error');
      runSentinelMock.mockRejectedValueOnce(serverError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
    });

    it('calls setFailed with actionable message for FigmaServerError', async () => {
      const serverError = new FigmaServerError('Internal server error');
      runSentinelMock.mockRejectedValueOnce(serverError);

      await run();

      expect(setFailedMock).toHaveBeenCalled();
      const message = setFailedMock.mock.calls[0][0] as string;
      expect(message).toContain('Figma server error');
    });

    it('sets error-count to 1 when FigmaNetworkError is thrown', async () => {
      const networkError = new FigmaNetworkError('Connection timeout');
      runSentinelMock.mockRejectedValueOnce(networkError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
    });

    it('sets error-details with isRetryable true for FigmaNetworkError', async () => {
      const networkError = new FigmaNetworkError('Connection timeout');
      runSentinelMock.mockRejectedValueOnce(networkError);

      await run();

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('NETWORK_ERROR');
      expect(errorDetails.isRetryable).toBe(true);
    });

    it('sets error-details for generic FigmaSentinelError', async () => {
      const genericError = new FigmaSentinelError('Something went wrong', {
        code: 'CUSTOM_ERROR',
      });
      runSentinelMock.mockRejectedValueOnce(genericError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('CUSTOM_ERROR');
    });

    it('handles non-FigmaSentinelError with UNKNOWN_ERROR code', async () => {
      const genericError = new Error('Something unexpected happened');
      runSentinelMock.mockRejectedValueOnce(genericError);

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
      expect(setFailedMock).toHaveBeenCalledWith('Something unexpected happened');

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('UNKNOWN_ERROR');
    });

    it('handles non-Error thrown value', async () => {
      runSentinelMock.mockRejectedValueOnce('string error');

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '1');
      expect(setFailedMock).toHaveBeenCalledWith('An unexpected error occurred');

      const errorDetailsCall = setOutputMock.mock.calls.find(
        (call) => call[0] === 'error-details'
      );
      expect(errorDetailsCall).toBeDefined();
      const errorDetails = JSON.parse(errorDetailsCall![1] as string);
      expect(errorDetails.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('success output', () => {
    it('sets error-count to 0 on success', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 5,
        nodesProcessed: 10,
        apiCallCount: 3,
        errors: [],
      });

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('error-count', '0');
      expect(setOutputMock).toHaveBeenCalledWith('error-details', '');
    });

    it('sets has-changes output correctly', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: true,
        filesProcessed: 2,
        nodesProcessed: 4,
        apiCallCount: 2,
        errors: [],
        changeResult: {
          added: [{ id: '1', name: 'New' }],
          changed: [],
          removed: [],
        },
      });

      await run();

      expect(setOutputMock).toHaveBeenCalledWith('has-changes', 'true');
    });

    it('does not call setFailed on success', async () => {
      runSentinelMock.mockResolvedValueOnce({
        success: true,
        hasChanges: false,
        filesProcessed: 1,
        nodesProcessed: 1,
        apiCallCount: 1,
        errors: [],
      });

      await run();

      expect(setFailedMock).not.toHaveBeenCalled();
    });
  });
});
