#!/usr/bin/env node

import { Command } from 'commander';
import { syncCommand } from './commands/sync.js';
import { checkCommand } from './commands/check.js';
import { diffCommand } from './commands/diff.js';
import { initCommand } from './commands/init.js';
import { variablesCommand } from './commands/variables.js';
import { linkCommand } from './commands/link.js';

const program = new Command();

program
  .name('figma-sentinel')
  .description('Figma Sentinel - Design change tracking and automated sync')
  .version('1.0.0');

program
  .command('sync')
  .description('Sync Figma designs and detect changes')
  .option('--dry-run', 'Preview changes without writing files')
  .option('-v, --verbose', 'Enable debug-level output with API details')
  .option('--cwd <dir>', 'Set working directory')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    await syncCommand({
      dryRun: options.dryRun,
      verbose: options.verbose,
      cwd: options.cwd,
      config: options.config,
    });
  });

program
  .command('check')
  .description('Validate setup without making changes')
  .option('--cwd <dir>', 'Set working directory')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    await checkCommand({
      cwd: options.cwd,
      config: options.config,
    });
  });

program
  .command('diff <node-id>')
  .description('Debug specific node changes')
  .option('--file-key <key>', 'Figma file key (required)')
  .option('--cwd <dir>', 'Set working directory')
  .option('--config <path>', 'Path to config file')
  .action(async (nodeId, options) => {
    await diffCommand(nodeId, {
      fileKey: options.fileKey,
      cwd: options.cwd,
      config: options.config,
    });
  });

program
  .command('init')
  .description('Initialize Figma Sentinel in your project')
  .option('--cwd <dir>', 'Set working directory')
  .option('-y, --yes', 'Skip the link prompt after setup')
  .action(async (options) => {
    await initCommand({
      cwd: options.cwd,
      yes: options.yes,
    });
  });

program
  .command('variables')
  .description('Fetch and display Figma Variables (design tokens)')
  .option('--file-key <key>', 'Figma file key to fetch variables from')
  .option('--collection <name>', 'Filter by collection name')
  .option('--output <path>', 'Output JSON file path')
  .option('--cwd <dir>', 'Set working directory')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    await variablesCommand({
      fileKey: options.fileKey,
      collection: options.collection,
      output: options.output,
      cwd: options.cwd,
      config: options.config,
    });
  });

program
  .command('link [url]')
  .description('Link Figma URLs to source files by adding directives')
  .option('-f, --file <path...>', 'Target file path(s) to add directives to')
  .option('-p, --path <path...>', 'Alias for --file')
  .option('-y, --yes', 'Skip confirmations (auto-add if same key, auto-replace if different)')
  .option('--force', 'Replace existing directives without prompting')
  .option('-c, --cwd <dir>', 'Set working directory')
  .addHelpText(
    'after',
    `
Examples:
  $ figma-sentinel link https://www.figma.com/design/abc123/MyDesign?node-id=1:23 -f src/Button.tsx
  $ figma-sentinel link <url> -f file1.tsx -f file2.tsx   # Link multiple files
  $ figma-sentinel link <url> -f component.tsx --force    # Replace existing directives
  $ figma-sentinel link <url> -f component.tsx --yes      # Skip confirmation prompts
`
  )
  .action(async (url, options) => {
    await linkCommand(url, {
      file: options.file,
      path: options.path,
      yes: options.yes,
      force: options.force,
      cwd: options.cwd,
    });
  });

program.parse();
