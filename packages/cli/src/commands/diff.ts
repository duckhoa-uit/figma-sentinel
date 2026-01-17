/**
 * CLI diff command - Debug specific node changes
 *
 * Fetches a specific node from Figma and compares it with the stored spec.
 */

import ora from 'ora';
import kleur from 'kleur';
import * as path from 'path';
import {
  fetchNodes,
  loadSpec,
  createNormalizedSpec,
  diffSpecs,
  formatValue,
  formatPropertyPath,
  DEFAULT_CONFIG,
  type FigmaDirective,
  type PropertyChange,
} from '@khoavhd/figma-sentinel-core';
import { resolveConfig } from '../config.js';

export interface DiffOptions {
  fileKey?: string;
  cwd?: string;
  config?: string;
}

/**
 * Execute the diff command
 */
export async function diffCommand(
  nodeId: string,
  options: DiffOptions
): Promise<void> {
  const cwd = options.cwd || process.cwd();

  console.log(kleur.cyan('\n🔍 Figma Sentinel - Node Diff\n'));

  // Validate node ID format
  if (!nodeId || !nodeId.includes(':')) {
    console.log(kleur.red('Error: Invalid node ID format.'));
    console.log(kleur.gray('Node IDs should be in format "1:23" (e.g., "123:456")'));
    process.exit(1);
  }

  // Check for FIGMA_TOKEN
  if (!process.env.FIGMA_TOKEN) {
    console.log(kleur.red('Error: FIGMA_TOKEN environment variable is not set.'));
    console.log(kleur.yellow('\nSet your Figma access token:'));
    console.log(kleur.gray('  export FIGMA_TOKEN=your-token-here\n'));
    process.exit(1);
  }

  // Get file key
  const fileKey = options.fileKey;
  if (!fileKey) {
    console.log(
      kleur.red('Error: --file-key is required to specify the Figma file.')
    );
    console.log(kleur.yellow('\nUsage:'));
    console.log(
      kleur.gray('  figma-sentinel diff <node-id> --file-key <figma-file-key>')
    );
    console.log(kleur.gray('\nExample:'));
    console.log(kleur.gray('  figma-sentinel diff 123:456 --file-key abc123xyz\n'));
    process.exit(1);
  }

  // Load config to get specs directory
  const spinner = ora('Loading configuration...').start();
  let specsDir = DEFAULT_CONFIG.specsDir;

  try {
    const configResult = await resolveConfig(cwd, options.config);
    if (configResult.config) {
      specsDir = configResult.config.specsDir;
    }
    spinner.succeed('Configuration loaded');
  } catch {
    spinner.warn('Using default configuration');
  }

  const resolvedSpecsDir = path.resolve(cwd, specsDir);

  // Load existing spec if it exists
  spinner.start('Loading existing spec...');
  const existingSpec = loadSpec(resolvedSpecsDir, nodeId);

  if (existingSpec) {
    spinner.succeed(`Existing spec found: ${kleur.cyan(existingSpec.name)}`);
  } else {
    spinner.info('No existing spec found for this node');
  }

  // Fetch current node from Figma
  spinner.start('Fetching node from Figma...');

  const directive: FigmaDirective = {
    fileKey,
    nodeIds: [nodeId],
    sourceFile: 'cli-diff-command',
  };

  try {
    // Suppress console output from fetchNodes
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    let fetchResult;
    try {
      fetchResult = await fetchNodes([directive]);
    } catch (error) {
      console.log = originalLog;
      console.warn = originalWarn;
      spinner.fail('Failed to fetch node from Figma');
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(kleur.red(`  • ${message}`));
      process.exit(1);
    }

    console.log = originalLog;
    console.warn = originalWarn;

    const fetchedNode = fetchResult.nodes[0];
    if (!fetchedNode) {
      spinner.fail(`Node ${nodeId} not found in file ${fileKey}`);
      process.exit(1);
    }

    spinner.succeed(`Fetched node: ${kleur.cyan(fetchedNode.node.name)}`);

    // Create a normalized spec for the fetched node
    const newSpec = createNormalizedSpec(
      fetchedNode.node,
      'cli-diff-command',
      fileKey
    );

    // Display node info
    console.log('');
    console.log(kleur.bold('Node Information:'));
    console.log(`  ID:   ${kleur.cyan(nodeId)}`);
    console.log(`  Name: ${kleur.cyan(fetchedNode.node.name)}`);
    console.log(`  Type: ${kleur.cyan(fetchedNode.node.type)}`);
    console.log(`  File: ${kleur.gray(fileKey)}`);

    // Compare specs
    if (!existingSpec) {
      console.log('');
      console.log(kleur.yellow('No existing spec to compare with.'));
      console.log(kleur.gray('Run "figma-sentinel sync" to create specs first.'));
      console.log('');
      console.log(kleur.bold('Current Node Properties:'));
      displayNodeProperties(newSpec.node);
    } else {
      // Check if content hash matches
      if (existingSpec.contentHash === newSpec.contentHash) {
        console.log('');
        console.log(kleur.green('✓ No changes detected'));
        console.log(
          kleur.gray(`Content hash: ${existingSpec.contentHash}`)
        );
      } else {
        console.log('');
        console.log(kleur.yellow('⚠ Changes detected'));
        console.log('');

        // Get detailed property changes
        const changes = diffSpecs(existingSpec, newSpec);

        if (changes.length === 0) {
          console.log(kleur.gray('Content hash changed but no property differences found.'));
          console.log(kleur.gray(`Previous hash: ${existingSpec.contentHash}`));
          console.log(kleur.gray(`Current hash:  ${newSpec.contentHash}`));
        } else {
          displayPropertyChanges(changes);
        }
      }
    }

    console.log('');
    process.exit(0);
  } catch (error) {
    spinner.fail('Failed to fetch node');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(kleur.red(`\n✗ Error: ${message}\n`));
    process.exit(1);
  }
}

/**
 * Display property changes in a formatted table
 */
function displayPropertyChanges(changes: PropertyChange[]): void {
  console.log(kleur.bold('Property Changes:'));
  console.log('');

  // Find max width for property path column
  const maxPathWidth = Math.min(
    40,
    Math.max(...changes.map((c) => formatPropertyPath(c.path).length))
  );

  for (const change of changes) {
    const formattedPath = formatPropertyPath(change.path);
    const paddedPath = formattedPath.padEnd(maxPathWidth);

    console.log(`  ${kleur.cyan(paddedPath)}`);
    console.log(`    ${kleur.red('- ' + truncateValue(change.previousValue, 60))}`);
    console.log(`    ${kleur.green('+ ' + truncateValue(change.newValue, 60))}`);
    console.log('');
  }

  console.log(kleur.gray(`Total: ${changes.length} property change(s)`));
}

/**
 * Display node properties in a formatted way
 */
function displayNodeProperties(node: unknown): void {
  console.log('');

  const nodeObj = node as Record<string, unknown>;

  const displayProperty = (key: string, value: unknown, indent: number = 2) => {
    const spaces = ' '.repeat(indent);
    const formattedValue = formatValue(value);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${spaces}${kleur.cyan(key)}:`);
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        displayProperty(subKey, subValue, indent + 2);
      }
    } else if (Array.isArray(value) && value.length > 0) {
      console.log(`${spaces}${kleur.cyan(key)}: [${value.length} items]`);
    } else {
      console.log(`${spaces}${kleur.cyan(key)}: ${kleur.gray(truncateValue(formattedValue, 50))}`);
    }
  };

  // Display key properties
  const keyProps = ['type', 'name', 'width', 'height', 'fills', 'strokes', 'effects', 'style'];

  for (const key of keyProps) {
    if (key in nodeObj) {
      displayProperty(key, nodeObj[key]);
    }
  }

  // Show count of other properties
  const otherProps = Object.keys(nodeObj).filter((k) => !keyProps.includes(k));
  if (otherProps.length > 0) {
    console.log(`  ${kleur.gray(`... and ${otherProps.length} more properties`)}`);
  }
}

/**
 * Truncate a value string for display
 */
function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - 3) + '...';
}
