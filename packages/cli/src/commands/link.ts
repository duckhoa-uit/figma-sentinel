/**
 * CLI link command - Link Figma URLs to source files
 */

import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import kleur from 'kleur';
import prompts from 'prompts';
import {
  parseFigmaUrl,
  detectDirectives,
  insertDirectives,
} from '@khoavhd/figma-sentinel-core';

export interface LinkOptions {
  file?: string | string[];
  path?: string | string[];
  yes?: boolean;
  force?: boolean;
  cwd?: string;
}

export interface LinkResult {
  success: number;
  failed: number;
  skipped: number;
  warnings: number;
}

/**
 * Prompt for a valid Figma URL, re-prompting on invalid input
 */
export async function promptForUrl(): Promise<{ fileKey: string; nodeId: string | null } | null> {
  let isValid = false;

  while (!isValid) {
    const response = await prompts({
      type: 'text',
      name: 'url',
      message: 'Enter Figma URL:',
    });

    // User cancelled (Ctrl+C)
    if (!response.url) {
      return null;
    }

    try {
      const parsed = parseFigmaUrl(response.url);
      isValid = true;
      return parsed;
    } catch (error) {
      console.log(
        kleur.red(`  Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
      console.log(kleur.gray('  Please try again.\n'));
    }
  }

  return null;
}

/**
 * Prompt for a valid file path, re-prompting if file doesn't exist
 */
export async function promptForFile(cwd: string): Promise<string | null> {
  let isValid = false;

  while (!isValid) {
    const response = await prompts({
      type: 'text',
      name: 'file',
      message: 'Enter file path:',
    });

    // User cancelled (Ctrl+C)
    if (!response.file) {
      return null;
    }

    const absolutePath = path.isAbsolute(response.file)
      ? response.file
      : path.resolve(cwd, response.file);

    if (fs.existsSync(absolutePath)) {
      isValid = true;
      return absolutePath;
    }

    console.log(kleur.red(`  File not found: ${absolutePath}`));
    console.log(kleur.gray('  Please try again.\n'));
  }

  return null;
}

/**
 * Run interactive mode: prompt for URL and file(s), with option to link multiple files
 */
async function runInteractiveMode(
  initialUrl: { fileKey: string; nodeId: string | null } | null,
  cwd: string,
  options: LinkOptions
): Promise<void> {
  // Get URL if not provided
  let parsedUrl = initialUrl;
  if (!parsedUrl) {
    parsedUrl = await promptForUrl();
    if (!parsedUrl) {
      console.log(kleur.yellow('\nCancelled.'));
      return;
    }
  }

  const { fileKey, nodeId } = parsedUrl;

  // Warn if no node ID
  if (!nodeId) {
    console.log(
      kleur.yellow('\n⚠ Warning: URL has no node ID. File will be linked but not tracked for changes.')
    );
  }

  const result: LinkResult = { success: 0, failed: 0, skipped: 0, warnings: 0 };
  let continueLoop = true;

  while (continueLoop) {
    // Prompt for file path
    const filePath = await promptForFile(cwd);
    if (!filePath) {
      console.log(kleur.yellow('\nCancelled.'));
      break;
    }

    // Process the file
    await processFile(filePath, fileKey, nodeId, options, result);

    // Ask if user wants to link another file
    const response = await prompts({
      type: 'confirm',
      name: 'another',
      message: 'Link another file?',
      initial: false,
    });

    // User cancelled or said no
    if (!response.another) {
      continueLoop = false;
    }
  }

  // Show summary if multiple files were processed
  const totalProcessed = result.success + result.failed + result.skipped;
  if (totalProcessed > 1) {
    showSummary(result);
  }
}

/**
 * Show summary of link operations
 */
function showSummary(result: LinkResult): void {
  console.log(kleur.gray('\n─────────────────────────────────'));
  console.log(kleur.bold('Summary:'));
  console.log(kleur.green(`  ✔ Success: ${result.success}`));
  if (result.failed > 0) {
    console.log(kleur.red(`  ✖ Failed: ${result.failed}`));
  }
  if (result.skipped > 0) {
    console.log(kleur.yellow(`  ⊘ Skipped: ${result.skipped}`));
  }
  if (result.warnings > 0) {
    console.log(kleur.yellow(`  ⚠ Warnings: ${result.warnings}`));
  }
}

/**
 * Execute the link command
 */
export async function linkCommand(
  url: string | undefined,
  options: LinkOptions
): Promise<void> {
  const cwd = options.cwd || process.cwd();

  // Collect target files from --file and --path options (they are aliases)
  const targetFiles: string[] = [];
  if (options.file) {
    const files = Array.isArray(options.file) ? options.file : [options.file];
    targetFiles.push(...files);
  }
  if (options.path) {
    const paths = Array.isArray(options.path) ? options.path : [options.path];
    targetFiles.push(...paths);
  }

  // If no URL or no files provided, enter interactive mode
  if (!url || targetFiles.length === 0) {
    // Try to parse URL if provided (for partial interactive mode)
    let parsedUrl: { fileKey: string; nodeId: string | null } | null = null;
    if (url) {
      try {
        parsedUrl = parseFigmaUrl(url);
        console.log(
          kleur.green(`✔ Parsed Figma URL: file=${parsedUrl.fileKey}, node=${parsedUrl.nodeId || 'none'}`)
        );
      } catch (error) {
        console.log(
          kleur.red(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
        );
        parsedUrl = null;
      }
    }

    await runInteractiveMode(parsedUrl, cwd, options);
    return;
  }

  // Parse the Figma URL
  let fileKey: string;
  let nodeId: string | null;

  const spinner = ora('Parsing Figma URL...').start();
  try {
    const parsed = parseFigmaUrl(url);
    fileKey = parsed.fileKey;
    nodeId = parsed.nodeId;
    spinner.succeed(kleur.green(`Parsed Figma URL: file=${fileKey}, node=${nodeId || 'none'}`));
  } catch (error) {
    spinner.fail(kleur.red('Invalid Figma URL'));
    console.error(
      kleur.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
    process.exit(1);
  }

  // Warn if no node ID
  if (!nodeId) {
    console.log(
      kleur.yellow('\n⚠ Warning: URL has no node ID. File will be linked but not tracked for changes.')
    );
  }

  // Process each file
  const result: LinkResult = { success: 0, failed: 0, skipped: 0, warnings: 0 };

  for (const targetFile of targetFiles) {
    const absolutePath = path.isAbsolute(targetFile)
      ? targetFile
      : path.resolve(cwd, targetFile);

    await processFile(absolutePath, fileKey, nodeId, options, result);
  }

  // Show summary for batch operations
  if (targetFiles.length > 1) {
    showSummary(result);
  }
}

/**
 * Process a single file for linking
 */
export async function processFile(
  filePath: string,
  fileKey: string,
  nodeId: string | null,
  options: LinkOptions,
  result: LinkResult
): Promise<void> {
  const fileName = path.basename(filePath);
  const spinner = ora(`Processing ${fileName}...`).start();

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    spinner.fail(kleur.red(`File not found: ${filePath}`));
    result.failed++;
    return;
  }

  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Detect existing directives
    const existing = detectDirectives(content);

    // Handle existing directives
    if (existing.hasFileDirective) {
      spinner.stop();
      const resolution = await resolveConflict(
        fileName,
        fileKey,
        nodeId,
        existing,
        options
      );

      if (resolution === 'cancel') {
        console.log(kleur.yellow(`  ⊘ Skipped ${fileName}`));
        result.skipped++;
        return;
      }

      if (resolution === 'skip-duplicate') {
        console.log(kleur.cyan(`  ℹ ${fileName} already has node ${nodeId}`));
        result.skipped++;
        return;
      }

      const mode = resolution === 'add' ? 'append' : 'replace';
      const insertResult = insertDirectives({
        fileKey,
        nodeId,
        filePath,
        content,
        mode,
      });
      fs.writeFileSync(filePath, insertResult.content, 'utf-8');

      if (resolution === 'add') {
        console.log(
          kleur.green(`  ✔ Added node ${nodeId} to ${fileName}`)
        );
      } else {
        console.log(
          kleur.green(`  ✔ Replaced directives in ${fileName} → ${fileKey}${nodeId ? ` (node: ${nodeId})` : ''}`)
        );
      }
      result.success++;
      return;
    }

    // Insert new directives
    const insertResult = insertDirectives({
      fileKey,
      nodeId,
      filePath,
      content,
      mode: 'insert',
    });
    fs.writeFileSync(filePath, insertResult.content, 'utf-8');

    spinner.succeed(
      kleur.green(`✔ Linked ${fileName} to ${fileKey}${nodeId ? ` (node: ${nodeId})` : ''}`)
    );
    result.success++;

    if (!nodeId) {
      result.warnings++;
    }
  } catch (error) {
    spinner.fail(kleur.red(`Failed to process ${fileName}`));
    console.error(
      kleur.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
    result.failed++;
  }
}

type ConflictResolution = 'add' | 'replace' | 'cancel' | 'skip-duplicate';

interface DetectedDirectives {
  hasFileDirective: boolean;
  fileKey: string | null;
  nodeIds: string[];
}

/**
 * Resolve conflict when file already has directives
 */
async function resolveConflict(
  fileName: string,
  newFileKey: string,
  newNodeId: string | null,
  existing: DetectedDirectives,
  options: LinkOptions
): Promise<ConflictResolution> {
  const sameFileKey = existing.fileKey === newFileKey;

  // Check for duplicate node ID
  if (sameFileKey && newNodeId && existing.nodeIds.includes(newNodeId)) {
    return 'skip-duplicate';
  }

  // --force flag: always replace without prompt
  if (options.force) {
    return 'replace';
  }

  // --yes flag: auto-add if same key, auto-replace if different
  if (options.yes) {
    if (sameFileKey) {
      return 'add';
    }
    return 'replace';
  }

  // Interactive prompt
  console.log(kleur.yellow(`\n  File ${fileName} already has directives:`));
  console.log(kleur.gray(`    @figma-file: ${existing.fileKey}`));
  if (existing.nodeIds.length > 0) {
    console.log(kleur.gray(`    @figma-node: ${existing.nodeIds.join(', ')}`));
  }

  if (!sameFileKey) {
    console.log(
      kleur.yellow(`\n  ⚠ New file key (${newFileKey}) differs from existing (${existing.fileKey})`)
    );
  }

  const choices: Array<{ title: string; value: ConflictResolution }> = [];

  if (sameFileKey && newNodeId) {
    choices.push({
      title: `Add node to existing (append @figma-node: ${newNodeId})`,
      value: 'add',
    });
  }

  choices.push(
    { title: 'Replace all directives', value: 'replace' },
    { title: 'Cancel (skip this file)', value: 'cancel' }
  );

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices,
  });

  // User cancelled (Ctrl+C)
  if (!response.action) {
    return 'cancel';
  }

  return response.action;
}
