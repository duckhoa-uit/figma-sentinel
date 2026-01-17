/**
 * CLI init command - Initialize Figma Sentinel in your project
 */

import prompts from 'prompts';
import ora from 'ora';
import kleur from 'kleur';
import * as fs from 'fs';
import * as path from 'path';
import {
  promptForUrl,
  promptForFile,
  processFile,
  LinkOptions,
  LinkResult,
} from './link.js';

export interface InitOptions {
  cwd?: string;
  yes?: boolean;
}

interface InitAnswers {
  format: 'js' | 'json' | 'package.json';
  specsDir: string;
  filePatterns: string;
  exportImages: boolean;
  imageScale: number;
}

/**
 * Generate JS config file content
 */
function generateJsConfig(answers: InitAnswers): string {
  const patterns = answers.filePatterns.split(',').map((p: string) => p.trim());
  return `/**
 * Figma Sentinel Configuration
 * @type {import('@khoavhd/figma-sentinel-core').SentinelConfig}
 */
module.exports = {
  // Glob patterns for files to scan for Figma directives
  filePatterns: ${JSON.stringify(patterns)},

  // Glob patterns for files to exclude
  excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],

  // Directory to store design specs
  specsDir: '${answers.specsDir}',

  // Whether to export images from Figma
  exportImages: ${answers.exportImages},

  // Image export scale (1-4)
  imageScale: ${answers.imageScale},

  // Output format: 'json', 'markdown', or 'both'
  outputFormat: 'json',

  // Optional: Properties to always include (allowlist)
  // includeProperties: ['fills', 'strokes', 'effects'],

  // Optional: Properties to always exclude (blocklist)
  // excludeProperties: ['absoluteBoundingBox'],
};
`;
}

/**
 * Generate JSON config file content
 */
function generateJsonConfig(answers: InitAnswers): string {
  const patterns = answers.filePatterns.split(',').map((p: string) => p.trim());
  return JSON.stringify(
    {
      filePatterns: patterns,
      excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
      specsDir: answers.specsDir,
      exportImages: answers.exportImages,
      imageScale: answers.imageScale,
      outputFormat: 'json',
    },
    null,
    2
  );
}

/**
 * Prompt user to link a Figma file after init
 */
async function promptToLinkFile(cwd: string): Promise<void> {
  console.log('');

  const { wantToLink } = await prompts({
    type: 'confirm',
    name: 'wantToLink',
    message: 'Would you like to link a Figma file now?',
    initial: false,
  });

  if (!wantToLink) {
    return;
  }

  // Prompt for URL
  const parsedUrl = await promptForUrl();
  if (!parsedUrl) {
    console.log(kleur.yellow('  Linking cancelled.'));
    return;
  }

  const { fileKey, nodeId } = parsedUrl;

  // Warn if no node ID
  if (!nodeId) {
    console.log(
      kleur.yellow('⚠ Warning: URL has no node ID. File will be linked but not tracked for changes.')
    );
  }

  // Prompt for file
  const filePath = await promptForFile(cwd);
  if (!filePath) {
    console.log(kleur.yellow('  Linking cancelled.'));
    return;
  }

  // Process the file
  const result: LinkResult = { success: 0, failed: 0, skipped: 0, warnings: 0 };
  const linkOptions: LinkOptions = {};

  await processFile(filePath, fileKey, nodeId, linkOptions, result);

  if (result.success > 0) {
    console.log(kleur.green('  File linked successfully!'));
  }
}

/**
 * Execute the init command
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = options.cwd || process.cwd();

  console.log(kleur.cyan('\n🚀 Figma Sentinel - Project Setup\n'));

  // Check if config already exists
  const existingConfigs = [
    'figma-sentinel.config.js',
    '.figma-sentinelrc.json',
  ];
  const existingConfig = existingConfigs.find((name) =>
    fs.existsSync(path.join(cwd, name))
  );

  if (existingConfig) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Configuration file ${existingConfig} already exists. Overwrite?`,
      initial: false,
    });

    if (!overwrite) {
      console.log(kleur.yellow('\nSetup cancelled.\n'));
      return;
    }
  }

  // Interactive prompts
  const answers = await prompts<keyof InitAnswers>([
    {
      type: 'select',
      name: 'format',
      message: 'Configuration format:',
      choices: [
        {
          title: 'JavaScript (figma-sentinel.config.js)',
          value: 'js',
          description: 'Recommended for most projects',
        },
        {
          title: 'JSON (.figma-sentinelrc.json)',
          value: 'json',
          description: 'Simple JSON configuration',
        },
        {
          title: 'package.json',
          value: 'package.json',
          description: 'Add to existing package.json',
        },
      ],
      initial: 0,
    },
    {
      type: 'text',
      name: 'specsDir',
      message: 'Directory to store design specs:',
      initial: '.design-specs',
    },
    {
      type: 'text',
      name: 'filePatterns',
      message: 'File patterns to scan (comma-separated):',
      initial: 'src/**/*.tsx, src/**/*.jsx',
    },
    {
      type: 'confirm',
      name: 'exportImages',
      message: 'Export images from Figma?',
      initial: true,
    },
    {
      type: 'number',
      name: 'imageScale',
      message: 'Image export scale (1-4):',
      initial: 2,
      min: 1,
      max: 4,
    },
  ]);

  // User cancelled prompts
  if (!answers.format) {
    console.log(kleur.yellow('\nSetup cancelled.\n'));
    return;
  }

  const spinner = ora('Creating configuration...').start();

  try {
    let configPath: string;

    if (answers.format === 'js') {
      configPath = path.join(cwd, 'figma-sentinel.config.js');
      const content = generateJsConfig(answers);
      fs.writeFileSync(configPath, content, 'utf-8');
    } else if (answers.format === 'json') {
      configPath = path.join(cwd, '.figma-sentinelrc.json');
      const content = generateJsonConfig(answers);
      fs.writeFileSync(configPath, content, 'utf-8');
    } else {
      // package.json
      configPath = path.join(cwd, 'package.json');
      const pkgPath = path.join(cwd, 'package.json');

      if (!fs.existsSync(pkgPath)) {
        spinner.fail(kleur.red('package.json not found'));
        process.exit(1);
      }

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const patterns = answers.filePatterns.split(',').map((p: string) => p.trim());

      pkg['figma-sentinel'] = {
        filePatterns: patterns,
        excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
        specsDir: answers.specsDir,
        exportImages: answers.exportImages,
        imageScale: answers.imageScale,
        outputFormat: 'json',
      };

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    }

    spinner.succeed(kleur.green(`Configuration created: ${path.relative(cwd, configPath) || configPath}`));

    // Offer to link a Figma file (skip with --yes flag)
    if (!options.yes) {
      await promptToLinkFile(cwd);
    }

    // Display next steps
    console.log(kleur.gray('\n  Next steps:\n'));
    console.log(kleur.gray('  1. Set your Figma access token:'));
    console.log(kleur.cyan('     export FIGMA_TOKEN=your-token-here\n'));

    console.log(kleur.gray('  2. Add directives to your source files:'));
    console.log(kleur.cyan('     // @figma-file: YOUR_FILE_KEY'));
    console.log(kleur.cyan('     // @figma-node: NODE_ID\n'));

    console.log(kleur.gray('  3. Run the sync command:'));
    console.log(kleur.cyan('     npx figma-sentinel sync\n'));

    // Display example directive syntax
    console.log(kleur.gray('  Example directive in a component file:\n'));
    console.log(kleur.dim('     // Button.tsx'));
    console.log(kleur.dim('     // @figma-file: abc123XYZ'));
    console.log(kleur.dim('     // @figma-node: 1:23'));
    console.log(kleur.dim('     export function Button() { ... }\n'));
  } catch (error) {
    spinner.fail(kleur.red('Failed to create configuration'));
    console.log(
      kleur.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
    process.exit(1);
  }
}
