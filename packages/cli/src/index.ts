#!/usr/bin/env node

import { Command } from 'commander';

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
  .action(() => {
    console.log('sync command - to be implemented in US-014');
  });

program
  .command('check')
  .description('Validate setup without making changes')
  .action(() => {
    console.log('check command - to be implemented in US-015');
  });

program
  .command('diff <node-id>')
  .description('Debug specific node changes')
  .option('--file-key <key>', 'Figma file key')
  .action(() => {
    console.log('diff command - to be implemented in US-016');
  });

program
  .command('init')
  .description('Initialize Figma Sentinel in your project')
  .action(() => {
    console.log('init command - to be implemented in US-017');
  });

program.parse();
