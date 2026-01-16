// Figma Sentinel GitHub Action - Entry point

import * as core from '@actions/core';
import * as path from 'path';
import { runSentinel, loadConfig, mergeConfig, DEFAULT_CONFIG } from '@khoavhd/figma-sentinel-core';

async function run(): Promise<void> {
  try {
    core.info('Figma Sentinel Action starting...');

    // Get inputs
    const figmaToken = core.getInput('figma-token', { required: true });
    const configPath = core.getInput('config-path');
    const dryRun = core.getBooleanInput('dry-run');
    const createPr = core.getBooleanInput('create-pr');
    const prTitle = core.getInput('pr-title');
    const prLabels = core.getInput('pr-labels');

    core.debug(`Config path: ${configPath}`);
    core.debug(`Dry run: ${dryRun}`);
    core.debug(`Create PR: ${createPr}`);
    core.debug(`PR title: ${prTitle}`);
    core.debug(`PR labels: ${prLabels}`);

    // Set FIGMA_TOKEN environment variable for the core library
    core.exportVariable('FIGMA_TOKEN', figmaToken);
    process.env.FIGMA_TOKEN = figmaToken;

    // Get the workspace directory (GitHub Actions sets GITHUB_WORKSPACE)
    const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
    core.debug(`Working directory: ${cwd}`);

    // Load configuration
    let config = DEFAULT_CONFIG;
    if (configPath) {
      const fullConfigPath = path.resolve(cwd, configPath);
      core.info(`Loading config from: ${fullConfigPath}`);
      try {
        const result = loadConfig(fullConfigPath);
        config = mergeConfig(result.config);
      } catch (error) {
        core.warning(`Failed to load config from ${configPath}: ${error}`);
        core.info('Using default configuration');
      }
    } else {
      // Try to load config from default locations
      try {
        const result = loadConfig(cwd);
        if (result.config) {
          config = mergeConfig(result.config);
          core.info('Loaded configuration from project');
        }
      } catch {
        core.debug('No configuration file found, using defaults');
      }
    }

    // Run Figma Sentinel
    core.info('Running Figma Sentinel...');
    const result = await runSentinel({
      cwd,
      config,
      dryRun,
    });

    // Get change result (default to empty if undefined)
    const changeResult = result.changeResult ?? {
      hasChanges: false,
      added: [],
      changed: [],
      removed: [],
    };

    // Determine if there were changes
    const hasChanges =
      changeResult.added.length > 0 ||
      changeResult.changed.length > 0 ||
      changeResult.removed.length > 0;

    // Set outputs
    core.setOutput('has-changes', hasChanges.toString());
    core.setOutput('changelog-path', result.changelogPath || '');

    // Log summary
    if (hasChanges) {
      core.info(`Changes detected:`);
      core.info(`  - Added: ${changeResult.added.length}`);
      core.info(`  - Changed: ${changeResult.changed.length}`);
      core.info(`  - Removed: ${changeResult.removed.length}`);

      if (result.changelogPath) {
        core.info(`Changelog written to: ${result.changelogPath}`);
      }
      if (result.prBodyPath) {
        core.info(`PR body written to: ${result.prBodyPath}`);
      }
    } else {
      core.info('No design changes detected');
    }

    // PR creation will be handled in US-021
    // For now, set empty PR outputs
    core.setOutput('pr-number', '');
    core.setOutput('pr-url', '');

    // Store PR configuration in outputs for potential use by subsequent steps
    if (createPr && hasChanges) {
      core.info('PR creation requested - will be handled in next action step');
      core.debug(`PR Title: ${prTitle}`);
      core.debug(`PR Labels: ${prLabels}`);
    }

    core.info('Figma Sentinel Action completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
