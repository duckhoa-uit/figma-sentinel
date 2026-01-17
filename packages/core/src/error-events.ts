/**
 * Event emitter for error and retry events in Figma Sentinel.
 *
 * Provides a typed event system for monitoring errors, retries, rate limits,
 * and completion status. Enables future notification integrations.
 */

import { EventEmitter } from 'events';
import type { FigmaSentinelError } from './errors.js';
import type { RateLimitHeaders } from './error-parser.js';

/**
 * Event payload for 'error' events
 */
export interface ErrorEventPayload {
  type: 'error';
  error: FigmaSentinelError;
  context?: {
    fileKey?: string;
    nodeId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for 'retry' events
 */
export interface RetryEventPayload {
  type: 'retry';
  details: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    url?: string;
  };
  context?: {
    fileKey?: string;
    nodeId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for 'rateLimited' events
 */
export interface RateLimitedEventPayload {
  type: 'rateLimited';
  details: {
    retryAfterSec: number;
    headers: RateLimitHeaders;
  };
  context?: {
    fileKey?: string;
    nodeId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for 'completed' events
 */
export interface CompletedEventPayload {
  type: 'completed';
  details: {
    successCount: number;
    failureCount: number;
    durationMs: number;
  };
  timestamp: Date;
}

/**
 * All event payload types
 */
export type ErrorEventPayloadTypes =
  | ErrorEventPayload
  | RetryEventPayload
  | RateLimitedEventPayload
  | CompletedEventPayload;

/**
 * Event names and their payload types
 */
export interface ErrorEventMap {
  error: [ErrorEventPayload];
  retry: [RetryEventPayload];
  rateLimited: [RateLimitedEventPayload];
  completed: [CompletedEventPayload];
}

/**
 * Typed event emitter for error and status events.
 * Extends Node.js EventEmitter with type-safe event handling.
 */
export class ErrorEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Emit an 'error' event
   */
  emitError(
    error: FigmaSentinelError,
    context?: { fileKey?: string; nodeId?: string }
  ): boolean {
    const payload: ErrorEventPayload = {
      type: 'error',
      error,
      context,
      timestamp: new Date(),
    };
    return this.emit('error', payload);
  }

  /**
   * Emit a 'retry' event
   */
  emitRetry(
    details: {
      attempt: number;
      maxRetries: number;
      delayMs: number;
      url?: string;
    },
    context?: { fileKey?: string; nodeId?: string }
  ): boolean {
    const payload: RetryEventPayload = {
      type: 'retry',
      details,
      context,
      timestamp: new Date(),
    };
    return this.emit('retry', payload);
  }

  /**
   * Emit a 'rateLimited' event
   */
  emitRateLimited(
    details: {
      retryAfterSec: number;
      headers: RateLimitHeaders;
    },
    context?: { fileKey?: string; nodeId?: string }
  ): boolean {
    const payload: RateLimitedEventPayload = {
      type: 'rateLimited',
      details,
      context,
      timestamp: new Date(),
    };
    return this.emit('rateLimited', payload);
  }

  /**
   * Emit a 'completed' event
   */
  emitCompleted(details: {
    successCount: number;
    failureCount: number;
    durationMs: number;
  }): boolean {
    const payload: CompletedEventPayload = {
      type: 'completed',
      details,
      timestamp: new Date(),
    };
    return this.emit('completed', payload);
  }

  /**
   * Type-safe listener for 'error' events
   */
  onError(listener: (payload: ErrorEventPayload) => void): this {
    return this.on('error', listener);
  }

  /**
   * Type-safe listener for 'retry' events
   */
  onRetry(listener: (payload: RetryEventPayload) => void): this {
    return this.on('retry', listener);
  }

  /**
   * Type-safe listener for 'rateLimited' events
   */
  onRateLimited(listener: (payload: RateLimitedEventPayload) => void): this {
    return this.on('rateLimited', listener);
  }

  /**
   * Type-safe listener for 'completed' events
   */
  onCompleted(listener: (payload: CompletedEventPayload) => void): this {
    return this.on('completed', listener);
  }
}

/**
 * Factory function to create a new ErrorEventEmitter instance
 */
export function createEventEmitter(): ErrorEventEmitter {
  return new ErrorEventEmitter();
}
