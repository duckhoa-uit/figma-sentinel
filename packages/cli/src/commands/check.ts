/**
 * CLI check command - Validate setup without making changes
 */

import ora from 'ora';
import kleur from 'kleur';
import {
  loadConfig,
  parseDirectives,
  validateConfig,
  formatValidationErrors,
  DEFAULT_CONFIG,
} from '@khoavhd/figma-sentinel-core';
import type { SentinelConfig } from '@khoavhd/figma-sentinel-core';
import * as fs from 'fs';
import * as path from 'path';

export interface CheckOptions {
  cwd?: string;
  config?: string;
}

/**
 * Execute the check command
 */
export async function checkCommand(options: CheckOptions): Promise<void> {
  const cwd = options.cwd || process.cwd();

  console.log(kleur.cyan('\n🔍 Figma Sentinel - Setup Check\n'));

  let hasErrors = false;

  // Step 1: Check for FIGMA_TOKEN environment variable
  const tokenSpinner = ora('Checking FIGMA_TOKEN...').start();
  if (process.env.FIGMA_TOKEN) {
    tokenSpinner.succeed(kleur.green('FIGMA_TOKEN is set'));
  } else {
    tokenSpinner.warn(kleur.yellow('FIGMA_TOKEN is not set'));
    console.log(kleur.gray('  Set your Figma access token:'));
    console.log(kleur.gray('    export FIGMA_TOKEN=your-token-here'));
    hasErrors = true;
  }

  // Step 2: Check for config file existence and validity
  const configSpinner = ora('Checking configuration...').start();
  let config: SentinelConfig;
  let configPath: string | null = null;

  try {
    if (options.config) {
      // Explicit config path provided
      const resolvedPath = path.resolve(cwd, options.config);
      if (!fs.existsSync(resolvedPath)) {
        configSpinner.fail(kleur.red(`Config file not found: ${resolvedPath}`));
        hasErrors = true;
        config = DEFAULT_CONFIG;
      } else {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        let rawConfig: Record<string, unknown>;

        try {
          if (resolvedPath.endsWith('.json')) {
            rawConfig = JSON.parse(content);
          } else if (resolvedPath.endsWith('.js')) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const loaded = require(resolvedPath);
            rawConfig = loaded.default || loaded;
          } else {
            throw new Error('Unsupported config format');
          }

          const errors = validateConfig(rawConfig);
          if (errors.length > 0) {
            configSpinner.fail(kleur.red('Invalid configuration'));
            console.log(kleur.red(formatValidationErrors(errors, resolvedPath)));
            hasErrors = true;
            config = DEFAULT_CONFIG;
          } else {
            configSpinner.succeed(kleur.green(`Valid configuration found: ${resolvedPath}`));
            configPath = resolvedPath;
            config = { ...DEFAULT_CONFIG, ...rawConfig } as SentinelConfig;
          }
        } catch (parseError) {
          configSpinner.fail(kleur.red(`Failed to parse config: ${resolvedPath}`));
          console.log(kleur.red(`  ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
          hasErrors = true;
          config = DEFAULT_CONFIG;
        }
      }
    } else {
      // Search for config file
      const originalLog = console.log;
      console.log = () => {}; // Suppress loadConfig's console.log
      try {
        const result = loadConfig(cwd);
        config = result.config;
        configPath = result.configPath;
      } finally {
        console.log = originalLog;
      }

      if (configPath) {
        configSpinner.succeed(kleur.green(`Configuration found: ${configPath}`));
      } else {
        configSpinner.info(kleur.gray('No config file found, using defaults'));
      }
    }
  } catch (error) {
    configSpinner.fail(kleur.red('Failed to load configuration'));
    console.log(kleur.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
    hasErrors = true;
    config = DEFAULT_CONFIG;
  }

  // Step 3: Parse directives and report count without fetching from Figma
  const parseSpinner = ora('Scanning for directives...').start();

  try {
    const directives = await parseDirectives(
      config.filePatterns,
      config.excludePatterns,
      cwd
    );

    if (directives.length === 0) {
      parseSpinner.warn(kleur.yellow('No files with Figma directives found'));
      console.log(kleur.gray('  Add directives to your source files:'));
      console.log(kleur.gray('    // @figma-file: YOUR_FILE_KEY'));
      console.log(kleur.gray('    // @figma-node: NODE_ID'));
    } else {
      parseSpinner.succeed(kleur.green(`Found ${directives.length} file(s) with directives`));

      // Calculate total nodes
      const totalNodes = directives.reduce((sum, d) => sum + d.nodeIds.length, 0);

      // Count unique file keys
      const uniqueFileKeys = new Set(directives.map((d) => d.fileKey));

      console.log(kleur.gray('\n  Summary:'));
      console.log(`    Files with directives: ${kleur.cyan(directives.length.toString())}`);
      console.log(`    Total nodes tracked:   ${kleur.cyan(totalNodes.toString())}`);
      console.log(`    Unique Figma files:    ${kleur.cyan(uniqueFileKeys.size.toString())}`);

      // Show details for each file
      console.log(kleur.gray('\n  Files:'));
      for (const directive of directives) {
        const relativePath = path.relative(cwd, directive.sourceFile);
        console.log(`    ${kleur.cyan(relativePath)}`);
        console.log(kleur.gray(`      File key: ${directive.fileKey}`));
        console.log(kleur.gray(`      Nodes: ${directive.nodeIds.join(', ')}`));
      }
    }
  } catch (error) {
    parseSpinner.fail(kleur.red('Failed to scan for directives'));
    console.log(kleur.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
    hasErrors = true;
  }

  // Final summary
  console.log('');
  if (hasErrors) {
    console.log(kleur.yellow('⚠ Setup check completed with warnings\n'));
    process.exit(1);
  } else {
    console.log(kleur.green('✓ Setup check passed\n'));
    process.exit(0);
  }
}
