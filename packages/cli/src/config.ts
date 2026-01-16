/**
 * CLI Configuration Loader using cosmiconfig
 *
 * Provides flexible config loading for CLI commands with support for
 * multiple config file formats and package.json integration.
 */

import { cosmiconfig, type CosmiconfigResult } from 'cosmiconfig';
import {
  validateConfig,
  mergeConfig,
  DEFAULT_CONFIG,
  type SentinelConfig,
  type PartialSentinelConfig,
  type ConfigValidationError,
} from '@khoavhd/figma-sentinel-core';

/**
 * Module name for cosmiconfig - defines the search pattern
 */
const MODULE_NAME = 'figma-sentinel';

/**
 * Cached configuration result to avoid reloading within the same run
 */
let cachedResult: CachedConfigResult | null = null;
let cachedSearchPath: string | null = null;

/**
 * Result of loading configuration via CLI
 */
export interface CLIConfigResult {
  config: SentinelConfig;
  configPath: string | null;
  fromCache: boolean;
}

/**
 * Internal cached result structure
 */
interface CachedConfigResult {
  config: SentinelConfig;
  configPath: string | null;
}

/**
 * Create the cosmiconfig explorer with configured search places
 */
function createExplorer() {
  return cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      'package.json',
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.js`,
      `.${MODULE_NAME}rc.cjs`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.cjs`,
    ],
    packageProp: MODULE_NAME,
  });
}

/**
 * Load and validate configuration from a specific file path.
 *
 * @param configPath - Path to the configuration file
 * @returns Loaded and validated configuration
 * @throws Error if the file cannot be loaded or validation fails
 */
export async function loadConfigFromPath(
  configPath: string
): Promise<CLIConfigResult> {
  const explorer = createExplorer();

  let result: CosmiconfigResult;
  try {
    result = await explorer.load(configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load configuration from ${configPath}: ${message}`);
  }

  if (!result || result.isEmpty) {
    throw new Error(`Configuration file is empty: ${configPath}`);
  }

  const rawConfig = result.config as Record<string, unknown>;
  const errors = validateConfig(rawConfig);

  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors, configPath));
  }

  const mergedConfig = mergeConfig(rawConfig as PartialSentinelConfig);

  return {
    config: mergedConfig,
    configPath: result.filepath,
    fromCache: false,
  };
}

/**
 * Search for and load configuration starting from a directory.
 *
 * Searches up the directory tree for configuration files in this order:
 * - package.json with "figma-sentinel" key
 * - .figma-sentinelrc / .figma-sentinelrc.json / .figma-sentinelrc.js / .figma-sentinelrc.cjs
 * - figma-sentinel.config.js / figma-sentinel.config.cjs
 *
 * @param searchFrom - Directory to start searching from (default: process.cwd())
 * @param options - Loading options
 * @returns Loaded configuration, or defaults if no config found
 */
export async function loadCLIConfig(
  searchFrom?: string,
  options: { useCache?: boolean } = {}
): Promise<CLIConfigResult> {
  const searchPath = searchFrom ?? process.cwd();
  const useCache = options.useCache ?? true;

  // Return cached result if available and cache is enabled
  if (useCache && cachedResult && cachedSearchPath === searchPath) {
    return {
      ...cachedResult,
      fromCache: true,
    };
  }

  const explorer = createExplorer();

  let result: CosmiconfigResult;
  try {
    result = await explorer.search(searchPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to search for configuration: ${message}`);
  }

  // No config found - use defaults
  if (!result || result.isEmpty) {
    const defaultResult: CachedConfigResult = {
      config: { ...DEFAULT_CONFIG },
      configPath: null,
    };

    // Cache the result
    if (useCache) {
      cachedResult = defaultResult;
      cachedSearchPath = searchPath;
    }

    return {
      ...defaultResult,
      fromCache: false,
    };
  }

  const rawConfig = result.config as Record<string, unknown>;
  const errors = validateConfig(rawConfig);

  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors, result.filepath));
  }

  const mergedConfig = mergeConfig(rawConfig as PartialSentinelConfig);

  const configResult: CachedConfigResult = {
    config: mergedConfig,
    configPath: result.filepath,
  };

  // Cache the result
  if (useCache) {
    cachedResult = configResult;
    cachedSearchPath = searchPath;
  }

  return {
    ...configResult,
    fromCache: false,
  };
}

/**
 * Clear the cached configuration.
 * Useful for testing or when config needs to be reloaded.
 */
export function clearConfigCache(): void {
  cachedResult = null;
  cachedSearchPath = null;
}

/**
 * Load configuration with CLI-specific handling.
 *
 * If a config path is provided, loads from that specific file.
 * Otherwise, searches for configuration from the working directory.
 *
 * @param cwd - Working directory
 * @param configPath - Optional explicit config file path
 * @returns Loaded configuration
 */
export async function resolveConfig(
  cwd: string,
  configPath?: string
): Promise<CLIConfigResult> {
  if (configPath) {
    return loadConfigFromPath(configPath);
  }
  return loadCLIConfig(cwd);
}

/**
 * Format validation errors into a human-readable message.
 */
function formatValidationErrors(
  errors: ConfigValidationError[],
  configPath: string
): string {
  const lines = [`Invalid configuration in ${configPath}:`];
  for (const error of errors) {
    lines.push(`  - ${error.field}: ${error.message}`);
  }
  return lines.join('\n');
}
