import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorEventEmitter,
  createEventEmitter,
  ErrorEventPayload,
  RetryEventPayload,
  RateLimitedEventPayload,
  CompletedEventPayload,
} from '../error-events.js';
import { FigmaSentinelError, FigmaRateLimitError } from '../errors.js';

describe('ErrorEventEmitter', () => {
  let emitter: ErrorEventEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T12:00:00.000Z'));
    emitter = new ErrorEventEmitter();
  });

  afterEach(() => {
    vi.useRealTimers();
    emitter.removeAllListeners();
  });

  describe('error event', () => {
    it('emits error event with correct payload', () => {
      const listener = vi.fn<[ErrorEventPayload], void>();
      emitter.onError(listener);

      const error = new FigmaSentinelError('Test error', 'TEST_ERROR');
      emitter.emitError(error);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload.type).toBe('error');
      expect(payload.error).toBe(error);
      expect(payload.context).toBeUndefined();
      expect(payload.timestamp).toEqual(new Date('2026-01-17T12:00:00.000Z'));
    });

    it('emits error event with context (fileKey, nodeId)', () => {
      const listener = vi.fn<[ErrorEventPayload], void>();
      emitter.onError(listener);

      const error = new FigmaSentinelError('Test error', 'TEST_ERROR');
      const context = { fileKey: 'abc123', nodeId: '1:2' };
      emitter.emitError(error, context);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload.context).toEqual(context);
    });

    it('returns true when listeners exist', () => {
      emitter.onError(() => {});
      const error = new FigmaSentinelError('Test error', 'TEST_ERROR');
      expect(emitter.emitError(error)).toBe(true);
    });
  });

  describe('retry event', () => {
    it('emits retry event with correct payload', () => {
      const listener = vi.fn<[RetryEventPayload], void>();
      emitter.onRetry(listener);

      const details = {
        attempt: 2,
        maxRetries: 3,
        delayMs: 5000,
        url: 'https://api.figma.com/v1/files/abc123',
      };
      emitter.emitRetry(details);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload.type).toBe('retry');
      expect(payload.details).toEqual(details);
      expect(payload.context).toBeUndefined();
      expect(payload.timestamp).toEqual(new Date('2026-01-17T12:00:00.000Z'));
    });

    it('emits retry event with retry count and delay', () => {
      const listener = vi.fn<[RetryEventPayload], void>();
      emitter.onRetry(listener);

      emitter.emitRetry({
        attempt: 1,
        maxRetries: 5,
        delayMs: 1000,
      });

      const payload = listener.mock.calls[0][0];
      expect(payload.details.attempt).toBe(1);
      expect(payload.details.maxRetries).toBe(5);
      expect(payload.details.delayMs).toBe(1000);
    });

    it('emits retry event with context', () => {
      const listener = vi.fn<[RetryEventPayload], void>();
      emitter.onRetry(listener);

      const context = { fileKey: 'xyz789' };
      emitter.emitRetry(
        { attempt: 1, maxRetries: 3, delayMs: 2000 },
        context
      );

      const payload = listener.mock.calls[0][0];
      expect(payload.context).toEqual(context);
    });
  });

  describe('rateLimited event', () => {
    it('emits rateLimited event with correct payload', () => {
      const listener = vi.fn<[RateLimitedEventPayload], void>();
      emitter.onRateLimited(listener);

      const details = {
        retryAfterSec: 60,
        headers: {
          retryAfterSec: 60,
          planTier: 'professional',
          rateLimitType: 'file',
          upgradeLink: 'https://figma.com/upgrade',
        },
      };
      emitter.emitRateLimited(details);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload.type).toBe('rateLimited');
      expect(payload.details).toEqual(details);
      expect(payload.context).toBeUndefined();
      expect(payload.timestamp).toEqual(new Date('2026-01-17T12:00:00.000Z'));
    });

    it('emits rateLimited event with headers info', () => {
      const listener = vi.fn<[RateLimitedEventPayload], void>();
      emitter.onRateLimited(listener);

      const headers = {
        retryAfterSec: 120,
        planTier: 'starter',
        rateLimitType: 'global',
      };
      emitter.emitRateLimited({ retryAfterSec: 120, headers });

      const payload = listener.mock.calls[0][0];
      expect(payload.details.headers.planTier).toBe('starter');
      expect(payload.details.headers.rateLimitType).toBe('global');
    });

    it('emits rateLimited event with context', () => {
      const listener = vi.fn<[RateLimitedEventPayload], void>();
      emitter.onRateLimited(listener);

      const context = { fileKey: 'file123', nodeId: '10:20' };
      emitter.emitRateLimited(
        { retryAfterSec: 30, headers: { retryAfterSec: 30 } },
        context
      );

      const payload = listener.mock.calls[0][0];
      expect(payload.context).toEqual(context);
    });
  });

  describe('completed event', () => {
    it('emits completed event with correct payload', () => {
      const listener = vi.fn<[CompletedEventPayload], void>();
      emitter.onCompleted(listener);

      const details = {
        successCount: 10,
        failureCount: 2,
        durationMs: 5000,
      };
      emitter.emitCompleted(details);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload.type).toBe('completed');
      expect(payload.details).toEqual(details);
      expect(payload.timestamp).toEqual(new Date('2026-01-17T12:00:00.000Z'));
    });

    it('emits completed event with success/failure counts', () => {
      const listener = vi.fn<[CompletedEventPayload], void>();
      emitter.onCompleted(listener);

      emitter.emitCompleted({
        successCount: 100,
        failureCount: 0,
        durationMs: 12000,
      });

      const payload = listener.mock.calls[0][0];
      expect(payload.details.successCount).toBe(100);
      expect(payload.details.failureCount).toBe(0);
      expect(payload.details.durationMs).toBe(12000);
    });
  });

  describe('multiple listeners', () => {
    it('notifies all registered listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.onError(listener1);
      emitter.onError(listener2);

      const error = new FigmaSentinelError('Test', 'TEST');
      emitter.emitError(error);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('allows different event types to have independent listeners', () => {
      const errorListener = vi.fn();
      const retryListener = vi.fn();
      const rateLimitedListener = vi.fn();
      const completedListener = vi.fn();

      emitter.onError(errorListener);
      emitter.onRetry(retryListener);
      emitter.onRateLimited(rateLimitedListener);
      emitter.onCompleted(completedListener);

      emitter.emitRetry({ attempt: 1, maxRetries: 3, delayMs: 1000 });

      expect(errorListener).not.toHaveBeenCalled();
      expect(retryListener).toHaveBeenCalledTimes(1);
      expect(rateLimitedListener).not.toHaveBeenCalled();
      expect(completedListener).not.toHaveBeenCalled();
    });
  });

  describe('createEventEmitter factory', () => {
    it('creates a new ErrorEventEmitter instance', () => {
      const created = createEventEmitter();
      expect(created).toBeInstanceOf(ErrorEventEmitter);
    });

    it('creates independent instances', () => {
      const emitter1 = createEventEmitter();
      const emitter2 = createEventEmitter();

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter1.onError(listener1);
      emitter2.onError(listener2);

      const error = new FigmaSentinelError('Test', 'TEST');
      emitter1.emitError(error);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('type safety', () => {
    it('preserves error instance in error event payload', () => {
      const listener = vi.fn<[ErrorEventPayload], void>();
      emitter.onError(listener);

      const error = new FigmaRateLimitError('Rate limited', {
        retryAfterSec: 60,
        planTier: 'starter',
      });
      emitter.emitError(error);

      const payload = listener.mock.calls[0][0];
      expect(payload.error).toBeInstanceOf(FigmaRateLimitError);
      expect((payload.error as FigmaRateLimitError).retryAfterSec).toBe(60);
    });
  });
});
