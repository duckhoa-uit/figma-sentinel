#!/usr/bin/env node

import { Command } from 'commander';
import { syncCommand } from './commands/sync.js';
import { checkCommand } from './commands/check.js';
import { diffCommand } from './commands/diff.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('figma-sentinel')
  .description('Figma Sentinel - Design change tracking and automated sync')
  .version('1.0.0');

program
  .command('sync')
  .description('Sync Figma designs and detect changes')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--cwd <dir>', 'Set working directory')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    await syncCommand({
      dryRun: options.dryRun,
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
  .action(async (options) => {
    await initCommand({
      cwd: options.cwd,
    });
  });

program.parse();
