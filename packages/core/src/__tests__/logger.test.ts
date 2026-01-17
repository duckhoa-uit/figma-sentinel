import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLogger, LogLevel } from '../logger.js';

describe('ConsoleLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('default log level (info)', () => {
    it('should not call console.log for debug messages', () => {
      const logger = new ConsoleLogger();
      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should call console.log for info messages with [INFO] prefix', () => {
      const logger = new ConsoleLogger();
      logger.info('info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] info message');
    });

    it('should call console.warn for warn messages with [WARN] prefix', () => {
      const logger = new ConsoleLogger();
      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message');
    });

    it('should call console.error for error messages with [ERROR] prefix', () => {
      const logger = new ConsoleLogger();
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });
  });

  describe('debug log level', () => {
    it('should call console.log for debug messages with [DEBUG] prefix', () => {
      const logger = new ConsoleLogger('debug');
      logger.debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] debug message');
    });

    it('should call console.log for info messages', () => {
      const logger = new ConsoleLogger('debug');
      logger.info('info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] info message');
    });

    it('should call console.warn for warn messages', () => {
      const logger = new ConsoleLogger('debug');
      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message');
    });

    it('should call console.error for error messages', () => {
      const logger = new ConsoleLogger('debug');
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });
  });

  describe('warn log level', () => {
    it('should not call console.log for debug messages', () => {
      const logger = new ConsoleLogger('warn');
      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not call console.log for info messages', () => {
      const logger = new ConsoleLogger('warn');
      logger.info('info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should call console.warn for warn messages', () => {
      const logger = new ConsoleLogger('warn');
      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message');
    });

    it('should call console.error for error messages', () => {
      const logger = new ConsoleLogger('warn');
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });
  });

  describe('error log level', () => {
    it('should not call console.log for debug messages', () => {
      const logger = new ConsoleLogger('error');
      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not call console.log for info messages', () => {
      const logger = new ConsoleLogger('error');
      logger.info('info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not call console.warn for warn messages', () => {
      const logger = new ConsoleLogger('error');
      logger.warn('warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should call console.error for error messages', () => {
      const logger = new ConsoleLogger('error');
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });
  });

  describe('additional arguments', () => {
    it('should pass additional arguments to console.log for debug', () => {
      const logger = new ConsoleLogger('debug');
      const obj = { key: 'value' };
      logger.debug('debug message', obj, 123);
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] debug message', obj, 123);
    });

    it('should pass additional arguments to console.log for info', () => {
      const logger = new ConsoleLogger();
      const obj = { key: 'value' };
      logger.info('info message', obj, 'extra');
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] info message', obj, 'extra');
    });

    it('should pass additional arguments to console.warn', () => {
      const logger = new ConsoleLogger();
      const arr = [1, 2, 3];
      logger.warn('warn message', arr);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message', arr);
    });

    it('should pass additional arguments to console.error', () => {
      const logger = new ConsoleLogger();
      const err = new Error('test error');
      logger.error('error message', err);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message', err);
    });
  });

  describe('log level filtering hierarchy', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

    it.each(levels)('with %s level, should log all levels at or above it', (level) => {
      const logger = new ConsoleLogger(level);
      const levelIndex = levels.indexOf(level);

      // Call all log methods
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      // debug and info use console.log
      const expectedDebugCalls = levelIndex <= 0 ? 1 : 0;
      const expectedInfoCalls = levelIndex <= 1 ? 1 : 0;

      // Count calls (debug=0, info=1 both use console.log)
      const expectedLogCalls = expectedDebugCalls + expectedInfoCalls;
      expect(consoleLogSpy).toHaveBeenCalledTimes(expectedLogCalls);

      // warn uses console.warn
      const expectedWarnCalls = levelIndex <= 2 ? 1 : 0;
      expect(consoleWarnSpy).toHaveBeenCalledTimes(expectedWarnCalls);

      // error uses console.error (always called since error is highest level)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
