// Figma Sentinel GitHub Action - Entry point

import * as core from '@actions/core';
import * as path from 'path';
import {
  runSentinel,
  loadConfig,
  mergeConfig,
  DEFAULT_CONFIG,
  FigmaSentinelError,
  generateErrorMessage,
} from '@khoavhd/figma-sentinel-core';
import { createOrUpdatePR, getCurrentBranch, getBaseBranch, parseLabels, parseReviewers } from './pr.js';

async function run(): Promise<void> {
  try {
    core.info('Figma Sentinel Action starting...');

      // Get inputs
    const figmaToken = core.getInput('figma-token', { required: true });
    const configPath = core.getInput('config-path');
    const dryRun = core.getBooleanInput('dry-run');
    const createPr = core.getBooleanInput('create-pr');
    const prTitle = core.getInput('pr-title') || 'chore: update Figma design specs';
    const prLabels = core.getInput('pr-labels');
    const prReviewers = core.getInput('pr-reviewers');

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

    // PR creation
    if (createPr && hasChanges && !dryRun) {
      core.info('Creating/updating PR with design changes...');
      try {
        const prResult = await createOrUpdatePR({
          title: prTitle,
          labels: parseLabels(prLabels),
          reviewers: parseReviewers(prReviewers),
          branchName: getCurrentBranch(),
          baseBranch: getBaseBranch(),
          prBodyPath: result.prBodyPath,
        });

        core.setOutput('pr-number', prResult.prNumber.toString());
        core.setOutput('pr-url', prResult.prUrl);

        if (prResult.created) {
          core.info(`Created PR #${prResult.prNumber}: ${prResult.prUrl}`);
        } else {
          core.info(`Updated PR #${prResult.prNumber}: ${prResult.prUrl}`);
        }
      } catch (error) {
        core.warning(`Failed to create/update PR: ${error}`);
        core.setOutput('pr-number', '');
        core.setOutput('pr-url', '');
      }
    } else {
      core.setOutput('pr-number', '');
      core.setOutput('pr-url', '');

      if (createPr && hasChanges && dryRun) {
        core.info('PR creation skipped (dry-run mode)');
      }
    }

    core.info('Figma Sentinel Action completed successfully');
    core.setOutput('error-count', '0');
    core.setOutput('error-details', '');
  } catch (error) {
    // Set error count (1 since fail-fast means at most 1 error)
    core.setOutput('error-count', '1');

    if (error instanceof FigmaSentinelError) {
      // Use actionable error message from generateErrorMessage
      const actionableMessage = generateErrorMessage(error);
      core.setFailed(actionableMessage);

      // Set error details as JSON
      const errorDetails = {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
        name: error.name,
      };
      core.setOutput('error-details', JSON.stringify(errorDetails));
    } else if (error instanceof Error) {
      core.setFailed(error.message);
      core.setOutput(
        'error-details',
        JSON.stringify({
          code: 'UNKNOWN_ERROR',
          message: error.message,
          name: error.name,
        })
      );
    } else {
      core.setFailed('An unexpected error occurred');
      core.setOutput(
        'error-details',
        JSON.stringify({
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
        })
      );
    }
  }
}

export { run };

run();
