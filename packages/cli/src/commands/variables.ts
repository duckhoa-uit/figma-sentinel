/**
 * CLI command: figma-sentinel variables
 *
 * Fetches and displays Figma Variables (design tokens) from a Figma file.
 */

import ora from 'ora';
import kleur from 'kleur';
import * as path from 'path';
import * as fs from 'fs';
import {
  parseVariablesDirectivesSync,
  fetchVariablesForDirectives,
  normalizeVariableCollection,
  formatVariableValue,
  type FigmaVariablesDirective,
  type NormalizedVariableCollectionSpec,
} from '@khoavhd/figma-sentinel-core';
import { resolveConfig } from '../config.js';

interface VariablesOptions {
  fileKey?: string;
  collection?: string;
  output?: string;
  cwd?: string;
  config?: string;
}

export async function variablesCommand(options: VariablesOptions): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Load config
  let config;
  try {
    const result = await resolveConfig(cwd, options.config);
    config = result.config;
  } catch (error) {
    console.error(kleur.red('Failed to load config:'), error);
    process.exit(1);
  }

  // Check for FIGMA_TOKEN
  if (!process.env.FIGMA_TOKEN) {
    console.error(
      kleur.red('Error: FIGMA_TOKEN environment variable is required.'),
    );
    console.error(
      kleur.dim('Set it with: export FIGMA_TOKEN=your_figma_token'),
    );
    process.exit(1);
  }

  let directives: FigmaVariablesDirective[] = [];

  // If --file-key is provided, create a synthetic directive
  if (options.fileKey) {
    directives.push({
      sourceFile: 'cli-argument',
      fileKey: options.fileKey,
      collectionNames: options.collection ? [options.collection] : [],
    });
  } else {
    // Parse directives from source files
    const spinner = ora('Scanning for @figma-variables directives...').start();
    try {
      directives = parseVariablesDirectivesSync(
        config.filePatterns,
        config.excludePatterns,
        cwd,
      );
      spinner.succeed(
        `Found ${kleur.cyan(String(directives.length))} file(s) with @figma-variables directives`,
      );
    } catch (error) {
      spinner.fail('Failed to scan for directives');
      console.error(error);
      process.exit(1);
    }
  }

  if (directives.length === 0) {
    console.log(kleur.yellow('\nNo @figma-variables directives found.'));
    console.log(kleur.dim('\nTo track variables, add directives to your source files:'));
    console.log(kleur.dim('  // @figma-file: YOUR_FILE_KEY'));
    console.log(kleur.dim('  // @figma-variables: *'));
    console.log(kleur.dim('  // @figma-variables: Colors, Spacing'));
    console.log(kleur.dim('\nOr use --file-key to specify a Figma file directly:'));
    console.log(kleur.dim('  figma-sentinel variables --file-key ABC123'));
    return;
  }

  // Fetch variables from Figma
  const fetchSpinner = ora('Fetching variables from Figma...').start();
  try {
    const result = await fetchVariablesForDirectives(directives);

    if (result.errors.length > 0) {
      fetchSpinner.warn(
        `Fetched with ${kleur.yellow(String(result.errors.length))} error(s)`,
      );
      for (const error of result.errors) {
        console.error(kleur.red(`  Error: ${error.message}`));
      }
    } else {
      fetchSpinner.succeed(
        `Fetched ${kleur.cyan(String(result.collections.length))} collection(s) with ${kleur.cyan(String(result.variables.length))} variable(s)`,
      );
    }

    if (result.collections.length === 0) {
      console.log(kleur.yellow('\nNo variable collections found.'));
      console.log(
        kleur.dim(
          'Note: The Figma Variables API requires Figma Enterprise plan.',
        ),
      );
      return;
    }

    // Normalize collections for display and optional output
    const normalizedCollections: NormalizedVariableCollectionSpec[] = [];

    for (const collection of result.collections) {
      const collectionVariables = result.variables.filter(
        v => v.variableCollectionId === collection.id,
      );
      const directive = directives.find(d =>
        d.collectionNames.length === 0 ||
        d.collectionNames.includes(collection.name),
      );
      const sourceFile = directive?.sourceFile || 'unknown';
      const fileKey = directive?.fileKey || 'unknown';

      const normalized = normalizeVariableCollection(
        collection,
        collectionVariables,
        fileKey,
        sourceFile,
      );
      normalizedCollections.push(normalized);
    }

    // Display results
    console.log('');
    for (const collection of normalizedCollections) {
      console.log(kleur.bold().cyan(`📦 ${collection.name}`));
      console.log(kleur.dim(`   Modes: ${collection.modes.join(', ')}`));
      console.log(kleur.dim(`   Default: ${collection.defaultMode}`));
      console.log('');

      for (const variable of collection.variables) {
        console.log(`   ${kleur.bold(variable.name)} ${kleur.dim(`(${variable.type})`)}`);
        if (variable.description) {
          console.log(`   ${kleur.dim(variable.description)}`);
        }
        for (const [mode, value] of Object.entries(variable.valuesByMode)) {
          const formattedValue = formatVariableValue(value);
          const modeLabel = mode === collection.defaultMode ? kleur.cyan(mode) : kleur.dim(mode);
          console.log(`     ${modeLabel}: ${formattedValue}`);
        }
        console.log('');
      }
    }

    // Output to file if specified
    if (options.output) {
      const outputPath = path.resolve(cwd, options.output);
      const outputData = JSON.stringify(normalizedCollections, null, 2);
      fs.writeFileSync(outputPath, outputData);
      console.log(kleur.green(`✓ Wrote ${normalizedCollections.length} collection(s) to ${options.output}`));
    }
  } catch (error) {
    fetchSpinner.fail('Failed to fetch variables');
    console.error(error);
    process.exit(1);
  }
}
