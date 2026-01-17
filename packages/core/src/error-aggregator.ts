/**
 * Error aggregation for collecting and summarizing errors during execution.
 */

import { FigmaSentinelError } from './errors.js';

/**
 * Context information for an error.
 */
export interface ErrorContext {
  fileKey?: string;
  nodeId?: string;
}

/**
 * An error entry with its context.
 */
export interface AggregatedError {
  error: FigmaSentinelError;
  context: ErrorContext;
  timestamp: Date;
}

/**
 * Summary of errors grouped by error type.
 */
export interface ErrorTypeSummary {
  code: string;
  count: number;
  errors: AggregatedError[];
}

/**
 * Summary of errors grouped by file key.
 */
export interface FileKeySummary {
  fileKey: string;
  count: number;
  errors: AggregatedError[];
}

/**
 * Complete summary of all aggregated errors.
 */
export interface ErrorSummary {
  byErrorType: ErrorTypeSummary[];
  byFileKey: FileKeySummary[];
  totalErrors: number;
}

/**
 * Collects errors and provides summary/grouping functionality.
 */
export class ErrorAggregator {
  private errors: AggregatedError[] = [];
  private successCount = 0;

  /**
   * Add an error with optional context.
   */
  addError(error: FigmaSentinelError, context: ErrorContext = {}): void {
    this.errors.push({
      error,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Record a successful operation.
   */
  addSuccess(): void {
    this.successCount++;
  }

  /**
   * Get all collected errors.
   */
  getErrors(): AggregatedError[] {
    return [...this.errors];
  }

  /**
   * Get the number of successful operations.
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Get the number of failed operations (errors).
   */
  getFailureCount(): number {
    return this.errors.length;
  }

  /**
   * Get a summary of errors grouped by error type and file key.
   */
  getSummary(): ErrorSummary {
    const byErrorType = this.groupByErrorType();
    const byFileKey = this.groupByFileKey();

    return {
      byErrorType,
      byFileKey,
      totalErrors: this.errors.length,
    };
  }

  /**
   * Clear all collected errors and reset counters.
   */
  reset(): void {
    this.errors = [];
    this.successCount = 0;
  }

  private groupByErrorType(): ErrorTypeSummary[] {
    const groups = new Map<string, AggregatedError[]>();

    for (const entry of this.errors) {
      const code = entry.error.code;
      const existing = groups.get(code);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(code, [entry]);
      }
    }

    return Array.from(groups.entries()).map(([code, errors]) => ({
      code,
      count: errors.length,
      errors,
    }));
  }

  private groupByFileKey(): FileKeySummary[] {
    const groups = new Map<string, AggregatedError[]>();

    for (const entry of this.errors) {
      const fileKey = entry.context.fileKey ?? 'unknown';
      const existing = groups.get(fileKey);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(fileKey, [entry]);
      }
    }

    return Array.from(groups.entries()).map(([fileKey, errors]) => ({
      fileKey,
      count: errors.length,
      errors,
    }));
  }
}
