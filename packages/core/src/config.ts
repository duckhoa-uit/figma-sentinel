/**
 * Figma Sentinel - Configuration Loader
 *
 * Loads configuration from figma-sentinel.config.js (CJS) or .figma-sentinelrc.json
 * with sensible defaults for React projects.
 * Uses Zod for schema validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { SentinelConfig } from './types.js';

/**
 * Default API configuration values.
 */
export const DEFAULT_API_CONFIG = {
  concurrency: 5,
  maxRetries: 3,
  maxRetryDelayMs: 3600000, // 1 hour
} as const;

/**
 * Zod schema for API configuration.
 */
export const ApiConfigSchema = z.object({
  concurrency: z
    .number()
    .min(1, 'must be at least 1')
    .max(20, 'must be at most 20')
    .default(DEFAULT_API_CONFIG.concurrency)
    .describe('Maximum concurrent API requests'),
  maxRetries: z
    .number()
    .min(0, 'must be at least 0')
    .max(10, 'must be at most 10')
    .default(DEFAULT_API_CONFIG.maxRetries)
    .describe('Maximum number of retry attempts'),
  maxRetryDelayMs: z
    .number()
    .min(0, 'must be at least 0')
    .default(DEFAULT_API_CONFIG.maxRetryDelayMs)
    .describe('Maximum delay in ms before aborting retry'),
});

/**
 * Zod schema for SentinelConfig validation.
 */
export const SentinelConfigSchema = z.object({
  filePatterns: z
    .array(z.string())
    .min(1, 'must contain at least one pattern')
    .describe('Glob patterns for files to scan for directives'),
  excludePatterns: z
    .array(z.string())
    .default([])
    .describe('Glob patterns for files to exclude'),
  specsDir: z
    .string()
    .min(1, 'must not be empty')
    .describe('Directory to store design specs'),
  exportImages: z.boolean().describe('Whether to export images'),
  imageScale: z
    .number()
    .min(0.1, 'must be at least 0.1')
    .max(4, 'must be at most 4')
    .describe('Image export scale'),
  outputFormat: z
    .enum(['json', 'markdown', 'both'])
    .describe('Output format for specs'),
  includeProperties: z
    .array(z.string())
    .optional()
    .describe('Properties to always include (allowlist)'),
  excludeProperties: z
    .array(z.string())
    .optional()
    .describe('Properties to always exclude (blocklist)'),
  api: ApiConfigSchema.optional().describe(
    'API configuration for rate limiting and concurrency'
  ),
});

/**
 * Partial configuration schema (all fields optional with defaults).
 */
export const PartialSentinelConfigSchema = SentinelConfigSchema.partial();

/**
 * Partial configuration that can be provided by user config files.
 * All properties are optional - missing values will use defaults.
 */
export type PartialSentinelConfig = z.infer<typeof PartialSentinelConfigSchema>;

/**
 * Configuration file names to search for, in priority order.
 */
const CONFIG_FILE_NAMES = [
  'figma-sentinel.config.js',
  '.figma-sentinelrc.json',
] as const;

/**
 * Default configuration values for React projects.
 */
export const DEFAULT_CONFIG: SentinelConfig = {
  filePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],
  excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
  specsDir: '.design-specs',
  exportImages: true,
  imageScale: 2,
  outputFormat: 'json',
};

/**
 * Validation error with field path and message.
 */
export interface ConfigValidationError {
  field: string;
  message: string;
}

/**
 * Result of loading configuration.
 */
export interface LoadConfigResult {
  config: SentinelConfig;
  configPath: string | null;
}

/**
 * Validates a configuration object using Zod schema.
 * Returns array of validation errors (empty if valid).
 */
export function validateConfig(
  config: Record<string, unknown>
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  // Check for unknown fields first
  const validFields = new Set<string>([
    'filePatterns',
    'excludePatterns',
    'specsDir',
    'exportImages',
    'imageScale',
    'outputFormat',
    'includeProperties',
    'excludeProperties',
    'api',
  ]);

  for (const key of Object.keys(config)) {
    if (!validFields.has(key)) {
      errors.push({
        field: key,
        message: `unknown configuration field '${key}'`,
      });
    }
  }

  // Validate known fields with Zod
  const result = SentinelConfigSchema.partial().safeParse(config);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.') || 'config',
        message: issue.message,
      });
    }
  }

  return errors;
}

/**
 * Formats validation errors into a human-readable message.
 */
export function formatValidationErrors(
  errors: ConfigValidationError[],
  configPath: string
): string {
  const lines = [`Invalid configuration in ${configPath}:`];
  for (const error of errors) {
    lines.push(`  - ${error.field}: ${error.message}`);
  }
  return lines.join('\n');
}

/**
 * Loads a JavaScript configuration file (CJS).
 */
function loadJsConfig(configPath: string): Record<string, unknown> {
  // Clear require cache to ensure fresh load
  delete require.cache[require.resolve(configPath)];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(configPath);
  // Handle default export
  return config.default || config;
}

/**
 * Loads a JSON configuration file.
 */
function loadJsonConfig(configPath: string): Record<string, unknown> {
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Finds a configuration file in the given directory or its parents.
 */
function findConfigFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  // Search up to root directory
  let continueSearch = true;
  while (continueSearch) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, fileName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      continueSearch = false;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Loads configuration from a specific file path.
 * Throws an error if the file cannot be loaded or is invalid.
 */
export function loadConfigFromFile(configPath: string): SentinelConfig {
  const resolvedPath = path.resolve(configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Configuration file not found: ${resolvedPath}`);
  }

  let rawConfig: Record<string, unknown>;

  try {
    if (configPath.endsWith('.js')) {
      rawConfig = loadJsConfig(resolvedPath);
    } else if (configPath.endsWith('.json')) {
      rawConfig = loadJsonConfig(resolvedPath);
    } else {
      throw new Error(
        `Unsupported configuration file format. Use .js or .json extension.`
      );
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse configuration file ${configPath}: ${error.message}`
      );
    }
    throw error;
  }

  // Validate configuration
  const errors = validateConfig(rawConfig);
  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors, configPath));
  }

  // Merge with defaults
  return mergeConfig(rawConfig as PartialSentinelConfig);
}

/**
 * Merges a partial configuration with defaults.
 */
export function mergeConfig(partial: PartialSentinelConfig): SentinelConfig {
  return {
    filePatterns: partial.filePatterns ?? DEFAULT_CONFIG.filePatterns,
    excludePatterns: partial.excludePatterns ?? DEFAULT_CONFIG.excludePatterns,
    specsDir: partial.specsDir ?? DEFAULT_CONFIG.specsDir,
    exportImages: partial.exportImages ?? DEFAULT_CONFIG.exportImages,
    imageScale: partial.imageScale ?? DEFAULT_CONFIG.imageScale,
    outputFormat: partial.outputFormat ?? DEFAULT_CONFIG.outputFormat,
    includeProperties: partial.includeProperties,
    excludeProperties: partial.excludeProperties,
    api: partial.api
      ? {
          concurrency: partial.api.concurrency ?? DEFAULT_API_CONFIG.concurrency,
          maxRetries: partial.api.maxRetries ?? DEFAULT_API_CONFIG.maxRetries,
          maxRetryDelayMs: partial.api.maxRetryDelayMs ?? DEFAULT_API_CONFIG.maxRetryDelayMs,
        }
      : undefined,
  };
}

/**
 * Loads configuration by searching for config files.
 * Falls back to defaults if no config file is found.
 *
 * @param startDir - Directory to start searching from (default: process.cwd())
 * @returns The loaded configuration and the path to the config file (if found)
 */
export function loadConfig(startDir?: string): LoadConfigResult {
  const searchDir = startDir ?? process.cwd();
  const configPath = findConfigFile(searchDir);

  if (configPath) {
    const config = loadConfigFromFile(configPath);
    console.log(`Loaded configuration from ${configPath}`);
    return { config, configPath };
  }

  console.log('No configuration file found, using defaults');
  return { config: { ...DEFAULT_CONFIG }, configPath: null };
}

/**
 * Creates a default configuration file in the specified directory.
 * Useful for initializing a new project.
 *
 * @param dir - Directory to create the config file in
 * @param format - Format of the config file ('js' or 'json')
 * @returns Path to the created config file
 */
export function createDefaultConfigFile(
  dir: string,
  format: 'js' | 'json' = 'js'
): string {
  const resolvedDir = path.resolve(dir);

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  if (format === 'js') {
    const configPath = path.join(resolvedDir, 'figma-sentinel.config.js');
    const content = `/**
 * Figma Sentinel Configuration
 * @type {import('@khoavhd/figma-sentinel-core').SentinelConfig}
 */
module.exports = {
  // Glob patterns for files to scan for Figma directives
  filePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],

  // Glob patterns for files to exclude
  excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],

  // Directory to store design specs
  specsDir: '.design-specs',

  // Whether to export images from Figma
  exportImages: true,

  // Image export scale (1-4)
  imageScale: 2,

  // Output format: 'json', 'markdown', or 'both'
  outputFormat: 'json',

  // Optional: Properties to always include (allowlist)
  // includeProperties: ['fills', 'strokes', 'effects'],

  // Optional: Properties to always exclude (blocklist)
  // excludeProperties: ['absoluteBoundingBox'],
};
`;
    fs.writeFileSync(configPath, content, 'utf-8');
    return configPath;
  } else {
    const configPath = path.join(resolvedDir, '.figma-sentinelrc.json');
    const content = JSON.stringify(
      {
        filePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],
        excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
        specsDir: '.design-specs',
        exportImages: true,
        imageScale: 2,
        outputFormat: 'json',
      },
      null,
      2
    );
    fs.writeFileSync(configPath, content, 'utf-8');
    return configPath;
  }
}
