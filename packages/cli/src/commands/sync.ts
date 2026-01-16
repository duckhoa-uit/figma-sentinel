/**
 * CLI sync command - Sync Figma designs and detect changes
 */

import ora from 'ora';
import kleur from 'kleur';
import { runSentinel } from '@khoavhd/figma-sentinel-core';
import type { SentinelResult, SentinelConfig } from '@khoavhd/figma-sentinel-core';

export interface SyncOptions {
  dryRun?: boolean;
  cwd?: string;
  config?: string;
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
  // Suppress default console output from runSentinel
  const originalLog = console.log;
  const logMessages: string[] = [];
  console.log = (...args: unknown[]) => {
    logMessages.push(args.map(String).join(' '));
  };

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

    // Load config if path specified
    let config: SentinelConfig | undefined;
    if (options.config) {
      // Config path is handled by runSentinel via cwd-relative search
      // If explicit config path provided, we need to handle it
      // For now, we rely on cosmiconfig which will be implemented in US-018
    }

    const result = await runSentinel({
      cwd,
      dryRun: options.dryRun,
      config,
    });

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
