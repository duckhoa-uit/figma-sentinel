import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateConfig,
  mergeConfig,
  createDefaultConfigFile,
  loadConfigFromFile,
  loadConfig,
  formatValidationErrors,
  DEFAULT_CONFIG,
  SentinelConfigSchema,
  type ConfigValidationError,
} from '../config.js';

describe('config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_CONFIG.filePatterns).toEqual([
        'src/**/*.tsx',
        'src/**/*.jsx',
      ]);
      expect(DEFAULT_CONFIG.excludePatterns).toEqual([
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
      ]);
      expect(DEFAULT_CONFIG.specsDir).toBe('.design-specs');
      expect(DEFAULT_CONFIG.exportImages).toBe(true);
      expect(DEFAULT_CONFIG.imageScale).toBe(2);
      expect(DEFAULT_CONFIG.outputFormat).toBe('json');
    });
  });

  describe('SentinelConfigSchema', () => {
    it('validates a complete valid config', () => {
      const config = {
        filePatterns: ['src/**/*.tsx'],
        excludePatterns: ['**/*.test.*'],
        specsDir: '.specs',
        exportImages: false,
        imageScale: 1,
        outputFormat: 'markdown' as const,
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('rejects empty filePatterns array', () => {
      const config = {
        filePatterns: [],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'json' as const,
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects imageScale below 0.1', () => {
      const config = {
        filePatterns: ['*.tsx'],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 0.05,
        outputFormat: 'json' as const,
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects imageScale above 4', () => {
      const config = {
        filePatterns: ['*.tsx'],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 5,
        outputFormat: 'json' as const,
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects invalid outputFormat', () => {
      const config = {
        filePatterns: ['*.tsx'],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'invalid',
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('accepts outputFormat both', () => {
      const config = {
        filePatterns: ['*.tsx'],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'both' as const,
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('accepts optional includeProperties', () => {
      const config = {
        filePatterns: ['*.tsx'],
        excludePatterns: [],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'json' as const,
        includeProperties: ['fills', 'strokes'],
      };

      const result = SentinelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('returns empty array for valid config', () => {
      const config = {
        filePatterns: ['src/**/*.tsx'],
        specsDir: '.specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'json',
      };

      const errors = validateConfig(config);
      expect(errors).toEqual([]);
    });

    it('returns error for invalid filePatterns type', () => {
      const config = {
        filePatterns: 'not-an-array',
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'filePatterns')).toBe(true);
    });

    it('returns error for empty specsDir', () => {
      const config = {
        specsDir: '',
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'specsDir')).toBe(true);
    });

    it('returns error for invalid imageScale', () => {
      const config = {
        imageScale: 10,
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'imageScale')).toBe(true);
    });

    it('returns error for unknown field', () => {
      const config = {
        unknownField: 'value',
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'unknownField')).toBe(true);
    });

    it('returns multiple errors for multiple issues', () => {
      const config = {
        filePatterns: 'invalid',
        imageScale: 100,
        unknownField: 'value',
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it('validates includeProperties as array of strings', () => {
      const validConfig = {
        includeProperties: ['fills', 'strokes'],
      };

      expect(validateConfig(validConfig)).toEqual([]);

      const invalidConfig = {
        includeProperties: 'not-array',
      };

      const errors = validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'includeProperties')).toBe(true);
    });

    it('validates excludeProperties as array of strings', () => {
      const validConfig = {
        excludeProperties: ['position'],
      };

      expect(validateConfig(validConfig)).toEqual([]);

      const invalidConfig = {
        excludeProperties: 'not-array',
      };

      const errors = validateConfig(invalidConfig);
      expect(errors.some((e) => e.field === 'excludeProperties')).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('formats errors with config path', () => {
      const errors: ConfigValidationError[] = [
        { field: 'imageScale', message: 'must be between 0.1 and 4' },
        { field: 'unknownField', message: "unknown configuration field 'unknownField'" },
      ];

      const formatted = formatValidationErrors(errors, '/path/to/config.js');
      expect(formatted).toContain('Invalid configuration in /path/to/config.js:');
      expect(formatted).toContain('imageScale: must be between 0.1 and 4');
      expect(formatted).toContain("unknownField: unknown configuration field 'unknownField'");
    });
  });

  describe('mergeConfig', () => {
    it('uses defaults for empty partial config', () => {
      const result = mergeConfig({});
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('overrides defaults with provided values', () => {
      const partial = {
        specsDir: '.custom-specs',
        exportImages: false,
        imageScale: 3,
      };

      const result = mergeConfig(partial);
      expect(result.specsDir).toBe('.custom-specs');
      expect(result.exportImages).toBe(false);
      expect(result.imageScale).toBe(3);
      expect(result.filePatterns).toEqual(DEFAULT_CONFIG.filePatterns);
    });

    it('preserves optional properties when provided', () => {
      const partial = {
        includeProperties: ['fills'],
        excludeProperties: ['position'],
      };

      const result = mergeConfig(partial);
      expect(result.includeProperties).toEqual(['fills']);
      expect(result.excludeProperties).toEqual(['position']);
    });

    it('does not add optional properties when not provided', () => {
      const result = mergeConfig({});
      expect(result.includeProperties).toBeUndefined();
      expect(result.excludeProperties).toBeUndefined();
    });
  });

  describe('createDefaultConfigFile', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync('/tmp/config-test-');
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates a JavaScript config file', () => {
      const configPath = createDefaultConfigFile(tempDir, 'js');

      expect(configPath).toBe(path.join(tempDir, 'figma-sentinel.config.js'));
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('module.exports');
      expect(content).toContain('filePatterns');
      expect(content).toContain('specsDir');
    });

    it('creates a JSON config file', () => {
      const configPath = createDefaultConfigFile(tempDir, 'json');

      expect(configPath).toBe(path.join(tempDir, '.figma-sentinelrc.json'));
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.filePatterns).toEqual(['src/**/*.tsx', 'src/**/*.jsx']);
      expect(parsed.specsDir).toBe('.design-specs');
    });

    it('creates directory if it does not exist', () => {
      const newDir = path.join(tempDir, 'nested', 'dir');
      const configPath = createDefaultConfigFile(newDir, 'js');

      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('defaults to js format', () => {
      const configPath = createDefaultConfigFile(tempDir);
      expect(configPath.endsWith('.js')).toBe(true);
    });
  });

  describe('loadConfigFromFile', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync('/tmp/config-test-');
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('loads a valid JSON config file', () => {
      const configPath = path.join(tempDir, 'test.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          specsDir: '.custom-specs',
          imageScale: 3,
        })
      );

      const config = loadConfigFromFile(configPath);
      expect(config.specsDir).toBe('.custom-specs');
      expect(config.imageScale).toBe(3);
      expect(config.filePatterns).toEqual(DEFAULT_CONFIG.filePatterns);
    });

    it('throws for non-existent file', () => {
      expect(() => loadConfigFromFile('/non/existent/path.json')).toThrow(
        /Configuration file not found/
      );
    });

    it('throws for invalid JSON syntax', () => {
      const configPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(configPath, '{ invalid json }');

      expect(() => loadConfigFromFile(configPath)).toThrow(/Failed to parse/);
    });

    it('throws for invalid config values', () => {
      const configPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          imageScale: 100,
        })
      );

      expect(() => loadConfigFromFile(configPath)).toThrow(/Invalid configuration/);
    });

    it('throws for unknown config fields', () => {
      const configPath = path.join(tempDir, 'unknown.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          unknownField: 'value',
        })
      );

      expect(() => loadConfigFromFile(configPath)).toThrow(/unknown configuration field/);
    });

    it('throws for unsupported file extension', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      fs.writeFileSync(configPath, 'specsDir: .specs');

      expect(() => loadConfigFromFile(configPath)).toThrow(/Unsupported configuration file format/);
    });
  });

  describe('loadConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync('/tmp/config-test-');
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    it('returns defaults when no config file found', () => {
      const result = loadConfig(tempDir);
      expect(result.config).toEqual(DEFAULT_CONFIG);
      expect(result.configPath).toBeNull();
    });

    it('loads config from figma-sentinel.config.js', () => {
      const configPath = path.join(tempDir, 'figma-sentinel.config.js');
      fs.writeFileSync(
        configPath,
        `module.exports = { specsDir: '.js-specs' };`
      );

      const result = loadConfig(tempDir);
      expect(result.config.specsDir).toBe('.js-specs');
      expect(result.configPath).toBe(configPath);
    });

    it('loads config from .figma-sentinelrc.json', () => {
      const configPath = path.join(tempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ specsDir: '.json-specs' })
      );

      const result = loadConfig(tempDir);
      expect(result.config.specsDir).toBe('.json-specs');
      expect(result.configPath).toBe(configPath);
    });

    it('prefers .js config over .json when both exist', () => {
      const jsPath = path.join(tempDir, 'figma-sentinel.config.js');
      const jsonPath = path.join(tempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(jsPath, `module.exports = { specsDir: '.js-specs' };`);
      fs.writeFileSync(jsonPath, JSON.stringify({ specsDir: '.json-specs' }));

      const result = loadConfig(tempDir);
      expect(result.config.specsDir).toBe('.js-specs');
    });

    it('searches parent directories for config', () => {
      const subDir = path.join(tempDir, 'sub', 'dir');
      fs.mkdirSync(subDir, { recursive: true });

      const configPath = path.join(tempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ specsDir: '.parent-specs' })
      );

      const result = loadConfig(subDir);
      expect(result.config.specsDir).toBe('.parent-specs');
      expect(result.configPath).toBe(configPath);
    });

    it('defaults to process.cwd() when no startDir provided', () => {
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = loadConfig();
        expect(result.config).toEqual(DEFAULT_CONFIG);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
