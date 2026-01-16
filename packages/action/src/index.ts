// Figma Sentinel GitHub Action - Entry point
// Full implementation will be added in US-020

import * as core from '@actions/core';

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
    
    // Placeholder outputs - will be set by actual implementation in US-020
    core.setOutput('has-changes', 'false');
    core.setOutput('changelog-path', '');
    core.setOutput('pr-number', '');
    core.setOutput('pr-url', '');
    
    core.info('Figma Sentinel Action completed');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
