/**
 * CLI sync command - Sync Figma designs and detect changes
 */

import ora from 'ora';
import kleur from 'kleur';
import { runSentinel, ConsoleLogger } from '@khoavhd/figma-sentinel-core';
import type { SentinelResult, SentinelConfig, LogLevel } from '@khoavhd/figma-sentinel-core';
import { resolveConfig } from '../config.js';

export interface SyncOptions {
  dryRun?: boolean;
  cwd?: string;
  config?: string;
  verbose?: boolean;
}

/**
 * Execute the sync command
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
  const cwd = options.cwd || process.cwd();

  console.log(kleur.cyan('\n🔍 Figma Sentinel - Design Sync\n'));

  const scanSpinner = ora('Scanning for directives...').start();

  try {
    // Check for FIGMA_TOKEN
    if (!process.env.FIGMA_TOKEN) {
      scanSpinner.fail(kleur.red('FIGMA_TOKEN environment variable is not set'));
      console.log(kleur.yellow('\nSet your Figma access token:'));
      console.log(kleur.gray('  export FIGMA_TOKEN=your-token-here\n'));
      process.exit(1);
    }

    // Run the sentinel workflow with progress updates
    const result = await runSentinelWithSpinners(cwd, options, scanSpinner);

    // Handle result
    if (!result.success) {
      console.log(kleur.red('\n✗ Sync failed with errors:'));
      for (const error of result.errors) {
        console.log(kleur.red(`  • ${error}`));
      }
      process.exit(1);
    }

    // Success output
    console.log(kleur.green('\n✓ Sync completed successfully!\n'));
    console.log(kleur.gray('Summary:'));
    console.log(`  Files processed: ${kleur.cyan(result.filesProcessed.toString())}`);
    console.log(`  Nodes processed: ${kleur.cyan(result.nodesProcessed.toString())}`);
    console.log(`  API calls made:  ${kleur.cyan(result.apiCallCount.toString())}`);

    if (result.hasChanges) {
      console.log(kleur.yellow('\nChanges detected:'));
      if (result.changeResult) {
        console.log(`  Added:   ${kleur.green(result.changeResult.added.length.toString())}`);
        console.log(`  Changed: ${kleur.yellow(result.changeResult.changed.length.toString())}`);
        console.log(`  Removed: ${kleur.red(result.changeResult.removed.length.toString())}`);
      }
      if (result.changelogPath) {
        console.log(kleur.gray(`\nChangelog: ${result.changelogPath}`));
      }
      if (result.prBodyPath) {
        console.log(kleur.gray(`PR Body:   ${result.prBodyPath}`));
      }
    } else {
      console.log(kleur.gray('\nNo design changes detected.'));
    }

    if (options.dryRun) {
      console.log(kleur.yellow('\n⚠ Dry run mode - no files were written.\n'));
    }

    // Report warnings if any
    if (result.errors.length > 0) {
      console.log(kleur.yellow('\nWarnings:'));
      for (const error of result.errors) {
        console.log(kleur.yellow(`  ⚠ ${error}`));
      }
    }

    process.exit(0);
  } catch (error) {
    scanSpinner.fail(kleur.red('Sync failed'));
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(kleur.red(`\n✗ Error: ${message}\n`));
    process.exit(1);
  }
}

/**
 * Run sentinel with spinner updates for each phase
 */
async function runSentinelWithSpinners(
  cwd: string,
  options: SyncOptions,
  scanSpinner: ReturnType<typeof ora>
): Promise<SentinelResult> {
  // Set log level based on verbose flag
  const logLevel: LogLevel = options.verbose ? 'debug' : 'info';
  const logger = new ConsoleLogger(logLevel);

  // In verbose mode, output debug info without suppressing logs
  if (options.verbose) {
    logger.debug('Verbose mode enabled');
    logger.debug(`Working directory: ${cwd}`);
    if (options.config) {
      logger.debug(`Config path: ${options.config}`);
    }
    if (options.dryRun) {
      logger.debug('Dry run mode: enabled');
    }
  }

  // Suppress default console output from runSentinel (unless verbose)
  const originalLog = console.log;
  const logMessages: string[] = [];

  if (!options.verbose) {
    console.log = (...args: unknown[]) => {
      logMessages.push(args.map(String).join(' '));
    };
  } else {
    console.log = (...args: unknown[]) => {
      const msg = args.map(String).join(' ');
      logMessages.push(msg);
      // In verbose mode, output all messages with debug prefix
      logger.debug(msg);
    };
  }

  try {
    // Parse sentinel output phases
    let phase = 'scan';
    const checkProgress = () => {
      const lastMessages = logMessages.slice(-5);
      for (const msg of lastMessages) {
        if (msg.includes('Fetching') || msg.includes('fetching')) {
          if (phase === 'scan') {
            scanSpinner.succeed('Scanning for directives... done');
            scanSpinner.text = 'Fetching from Figma...';
            scanSpinner.start();
            phase = 'fetch';
          }
        }
        if (msg.includes('Detecting changes') || msg.includes('Normalizing')) {
          if (phase === 'fetch') {
            scanSpinner.succeed('Fetching from Figma... done');
            scanSpinner.text = 'Detecting changes...';
            scanSpinner.start();
            phase = 'detect';
          }
        }
        if (msg.includes('Saving specs') || msg.includes('completed')) {
          if (phase === 'detect') {
            scanSpinner.succeed('Detecting changes... done');
            phase = 'done';
          }
        }
      }
    };

    // Create interval to check progress
    const progressInterval = setInterval(checkProgress, 100);

    // Load config using cosmiconfig
    const startTime = Date.now();
    const configResult = await resolveConfig(cwd, options.config);
    const config: SentinelConfig = configResult.config;

    if (configResult.configPath) {
      logMessages.push(`Loaded configuration from ${configResult.configPath}`);
      if (options.verbose) {
        logger.debug(`Config loaded in ${Date.now() - startTime}ms`);
        logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);
      }
    }

    const fetchStartTime = Date.now();
    if (options.verbose) {
      logger.debug('Starting sentinel workflow...');
    }

    const result = await runSentinel({
      cwd,
      dryRun: options.dryRun,
      config,
    });

    if (options.verbose) {
      logger.debug(`Sentinel workflow completed in ${Date.now() - fetchStartTime}ms`);
      logger.debug(`API calls made: ${result.apiCallCount}`);
      logger.debug(`Files processed: ${result.filesProcessed}`);
      logger.debug(`Nodes processed: ${result.nodesProcessed}`);
    }

    clearInterval(progressInterval);
    checkProgress(); // Final check

    // Ensure spinner is stopped
    if (phase !== 'done') {
      scanSpinner.succeed('Processing complete');
    }

    return result;
  } finally {
    console.log = originalLog;
  }
}
