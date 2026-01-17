import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorAggregator,
  FigmaSentinelError,
  FigmaRateLimitError,
  FigmaNotFoundError,
  FigmaAuthenticationError,
} from '../index.js';

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    aggregator = new ErrorAggregator();
  });

  describe('addError', () => {
    it('should add an error without context', () => {
      const error = new FigmaSentinelError('Test error', { code: 'TEST_ERROR' });
      aggregator.addError(error);

      const errors = aggregator.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe(error);
      expect(errors[0].context).toEqual({});
      expect(errors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should add an error with context', () => {
      const error = new FigmaSentinelError('Test error', { code: 'TEST_ERROR' });
      const context = { fileKey: 'abc123', nodeId: '1:2' };
      aggregator.addError(error, context);

      const errors = aggregator.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].context).toEqual(context);
    });

    it('should add multiple errors', () => {
      const error1 = new FigmaSentinelError('Error 1', { code: 'ERROR_1' });
      const error2 = new FigmaSentinelError('Error 2', { code: 'ERROR_2' });
      const error3 = new FigmaSentinelError('Error 3', { code: 'ERROR_3' });

      aggregator.addError(error1);
      aggregator.addError(error2);
      aggregator.addError(error3);

      expect(aggregator.getErrors()).toHaveLength(3);
      expect(aggregator.getFailureCount()).toBe(3);
    });
  });

  describe('addSuccess', () => {
    it('should increment success count', () => {
      expect(aggregator.getSuccessCount()).toBe(0);

      aggregator.addSuccess();
      expect(aggregator.getSuccessCount()).toBe(1);

      aggregator.addSuccess();
      aggregator.addSuccess();
      expect(aggregator.getSuccessCount()).toBe(3);
    });
  });

  describe('getErrors', () => {
    it('should return empty array when no errors', () => {
      expect(aggregator.getErrors()).toEqual([]);
    });

    it('should return a copy of errors array', () => {
      const error = new FigmaSentinelError('Test error', { code: 'TEST' });
      aggregator.addError(error);

      const errors1 = aggregator.getErrors();
      const errors2 = aggregator.getErrors();

      expect(errors1).not.toBe(errors2);
      expect(errors1).toEqual(errors2);
    });
  });

  describe('getSuccessCount and getFailureCount', () => {
    it('should return correct counts', () => {
      aggregator.addSuccess();
      aggregator.addSuccess();
      aggregator.addError(new FigmaSentinelError('Error', { code: 'ERR' }));

      expect(aggregator.getSuccessCount()).toBe(2);
      expect(aggregator.getFailureCount()).toBe(1);
    });
  });

  describe('getSummary', () => {
    describe('grouping by error type', () => {
      it('should group errors by error code', () => {
        aggregator.addError(new FigmaRateLimitError('Rate limit', { retryAfterSec: 60 }));
        aggregator.addError(new FigmaRateLimitError('Rate limit 2', { retryAfterSec: 30 }));
        aggregator.addError(new FigmaNotFoundError('Not found'));
        aggregator.addError(new FigmaAuthenticationError('Auth failed'));

        const summary = aggregator.getSummary();

        expect(summary.totalErrors).toBe(4);
        expect(summary.byErrorType).toHaveLength(3);

        const rateLimitSummary = summary.byErrorType.find((s) => s.code === 'RATE_LIMIT');
        expect(rateLimitSummary?.count).toBe(2);

        const notFoundSummary = summary.byErrorType.find((s) => s.code === 'NOT_FOUND');
        expect(notFoundSummary?.count).toBe(1);

        const authSummary = summary.byErrorType.find((s) => s.code === 'AUTH_ERROR');
        expect(authSummary?.count).toBe(1);
      });

      it('should include errors in each type summary', () => {
        const error1 = new FigmaRateLimitError('Rate limit 1', { retryAfterSec: 60 });
        const error2 = new FigmaRateLimitError('Rate limit 2', { retryAfterSec: 30 });

        aggregator.addError(error1, { fileKey: 'file1' });
        aggregator.addError(error2, { fileKey: 'file2' });

        const summary = aggregator.getSummary();
        const rateLimitSummary = summary.byErrorType.find((s) => s.code === 'RATE_LIMIT');

        expect(rateLimitSummary?.errors).toHaveLength(2);
        expect(rateLimitSummary?.errors[0].error).toBe(error1);
        expect(rateLimitSummary?.errors[1].error).toBe(error2);
      });
    });

    describe('grouping by file key', () => {
      it('should group errors by file key', () => {
        aggregator.addError(new FigmaNotFoundError('Error 1'), { fileKey: 'file1' });
        aggregator.addError(new FigmaNotFoundError('Error 2'), { fileKey: 'file1' });
        aggregator.addError(new FigmaNotFoundError('Error 3'), { fileKey: 'file2' });
        aggregator.addError(new FigmaAuthenticationError('Error 4'), { fileKey: 'file2' });

        const summary = aggregator.getSummary();

        expect(summary.byFileKey).toHaveLength(2);

        const file1Summary = summary.byFileKey.find((s) => s.fileKey === 'file1');
        expect(file1Summary?.count).toBe(2);

        const file2Summary = summary.byFileKey.find((s) => s.fileKey === 'file2');
        expect(file2Summary?.count).toBe(2);
      });

      it('should use "unknown" for errors without file key', () => {
        aggregator.addError(new FigmaSentinelError('Error', { code: 'ERR' }));
        aggregator.addError(new FigmaSentinelError('Error 2', { code: 'ERR' }), {});

        const summary = aggregator.getSummary();
        const unknownSummary = summary.byFileKey.find((s) => s.fileKey === 'unknown');

        expect(unknownSummary?.count).toBe(2);
      });

      it('should include errors in each file key summary', () => {
        const error1 = new FigmaNotFoundError('Error 1', { fileKey: 'abc' });
        const error2 = new FigmaAuthenticationError('Error 2');

        aggregator.addError(error1, { fileKey: 'file1', nodeId: '1:2' });
        aggregator.addError(error2, { fileKey: 'file1', nodeId: '3:4' });

        const summary = aggregator.getSummary();
        const file1Summary = summary.byFileKey.find((s) => s.fileKey === 'file1');

        expect(file1Summary?.errors).toHaveLength(2);
        expect(file1Summary?.errors[0].error).toBe(error1);
        expect(file1Summary?.errors[0].context.nodeId).toBe('1:2');
        expect(file1Summary?.errors[1].error).toBe(error2);
        expect(file1Summary?.errors[1].context.nodeId).toBe('3:4');
      });
    });

    it('should return empty summary when no errors', () => {
      const summary = aggregator.getSummary();

      expect(summary.totalErrors).toBe(0);
      expect(summary.byErrorType).toEqual([]);
      expect(summary.byFileKey).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should clear all errors', () => {
      aggregator.addError(new FigmaSentinelError('Error', { code: 'ERR' }));
      aggregator.addSuccess();
      aggregator.addSuccess();

      expect(aggregator.getErrors()).toHaveLength(1);
      expect(aggregator.getSuccessCount()).toBe(2);

      aggregator.reset();

      expect(aggregator.getErrors()).toEqual([]);
      expect(aggregator.getFailureCount()).toBe(0);
      expect(aggregator.getSuccessCount()).toBe(0);
    });
  });
});
