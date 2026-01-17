/**
 * Figma Design Sentinel - Main Entry Point
 *
 * Orchestrates the full workflow: parse directives, fetch nodes,
 * normalize, detect changes, export images, and generate changelog.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  SentinelConfig,
  NormalizedSpec,
  ChangeDetectionResult,
  FigmaDirective,
} from './types.js';
import { parseDirectives } from './parser.js';
import { fetchNodes, type FetchedNode } from './figma-client.js';
import {
  createNormalizedSpec,
  loadAllSpecs,
  saveSpec,
  removeSpec,
  detectChanges,
} from './storage.js';
import {
  generateChangelogEntries,
  generateChangelogMarkdown,
  attachImagePaths,
  writeChangelog,
  generatePRBody,
} from './differ.js';
import {
  exportImagesForMultipleFiles,
  cleanupRemovedImages,
  type ImageExportResult,
} from './image-exporter.js';
import { exportSpecsAsMarkdown, removeMarkdownSpec } from './markdown-exporter.js';
import { loadConfig, type LoadConfigResult } from './config.js';

/**
 * Result of running the Sentinel workflow.
 */
export interface SentinelResult {
  success: boolean;
  hasChanges: boolean;
  changeResult?: ChangeDetectionResult;
  filesProcessed: number;
  nodesProcessed: number;
  apiCallCount: number;
  changelogPath?: string;
  prBodyPath?: string;
  errors: string[];
}

/**
 * Options for running the Sentinel workflow.
 */
export interface SentinelOptions {
  cwd?: string;
  config?: SentinelConfig;
  dryRun?: boolean;
}

/**
 * Main entry point for the Figma Design Sentinel.
 * Orchestrates the full workflow from parsing to changelog generation.
 */
export async function runSentinel(
  options: SentinelOptions = {}
): Promise<SentinelResult> {
  const cwd = options.cwd || process.cwd();
  const errors: string[] = [];
  let apiCallCount = 0;

  console.log('Figma Design Sentinel starting...');
  console.log(`Working directory: ${cwd}`);

  // Step 1: Load configuration
  let config: SentinelConfig;
  if (options.config) {
    config = options.config;
    console.log('Using provided configuration');
  } else {
    try {
      const { config: loadedConfig, configPath }: LoadConfigResult = loadConfig(cwd);
      config = loadedConfig;
      if (configPath) {
        console.log(`Using config from: ${configPath}`);
      } else {
        console.log('No configuration file found, using defaults');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load configuration';
      return {
        success: false,
        hasChanges: false,
        filesProcessed: 0,
        nodesProcessed: 0,
        apiCallCount: 0,
        errors: [message],
      };
    }
  }

  const specsDir = path.resolve(cwd, config.specsDir);

  // Step 2: Parse directives from source files
  console.log(`Scanning for Figma directives in: ${config.filePatterns.join(', ')}`);
  let directives: FigmaDirective[];
  try {
    directives = await parseDirectives(
      config.filePatterns,
      config.excludePatterns,
      cwd
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to parse directives';
    return {
      success: false,
      hasChanges: false,
      filesProcessed: 0,
      nodesProcessed: 0,
      apiCallCount: 0,
      errors: [message],
    };
  }

  const filesProcessed = directives.length;
  const totalNodes = directives.reduce((sum, d) => sum + d.nodeIds.length, 0);

  console.log(
    `Found ${filesProcessed} file(s) with directives, ${totalNodes} node(s) to process`
  );

  if (directives.length === 0) {
    console.log('No Figma directives found. Nothing to do.');
    return {
      success: true,
      hasChanges: false,
      filesProcessed: 0,
      nodesProcessed: 0,
      apiCallCount: 0,
      errors: [],
    };
  }

  // Step 3: Fetch nodes from Figma API
  let fetchedNodes: FetchedNode[];
  try {
    const fetchResult = await fetchNodes(directives);
    fetchedNodes = fetchResult.nodes;
    apiCallCount = new Set(directives.map((d) => d.fileKey)).size;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch nodes from Figma';
    return {
      success: false,
      hasChanges: false,
      filesProcessed,
      nodesProcessed: 0,
      apiCallCount,
      errors: [message],
    };
  }

  if (fetchedNodes.length === 0) {
    console.log('No nodes fetched successfully. Check errors above.');
    return {
      success: false,
      hasChanges: false,
      filesProcessed,
      nodesProcessed: 0,
      apiCallCount,
      errors: errors.length > 0 ? errors : ['No nodes fetched from Figma API'],
    };
  }

  // Step 4: Create normalized specs
  console.log(`Normalizing ${fetchedNodes.length} node(s)...`);
  const newSpecs = new Map<string, NormalizedSpec>();
  const nodeToFileKey = new Map<string, string>();

  for (const fetched of fetchedNodes) {
    const sourceFile = fetched.sourceFiles[0] || '';
    const fileKey =
      directives.find((d) => d.nodeIds.includes(fetched.nodeId))?.fileKey || '';

    const spec = createNormalizedSpec(fetched.node, sourceFile, fileKey, config);
    newSpecs.set(spec.id, spec);
    nodeToFileKey.set(spec.id, fileKey);
  }

  // Step 5: Detect changes
  console.log('Detecting changes...');
  const changeResult = detectChanges(specsDir, Array.from(newSpecs.values()));

  if (!changeResult.hasChanges) {
    console.log('No design changes detected.');
    return {
      success: true,
      hasChanges: false,
      changeResult,
      filesProcessed,
      nodesProcessed: fetchedNodes.length,
      apiCallCount,
      errors,
    };
  }

  console.log('Changes detected:');
  console.log(`  - Added: ${changeResult.added.length}`);
  console.log(`  - Changed: ${changeResult.changed.length}`);
  console.log(`  - Removed: ${changeResult.removed.length}`);

  // Step 6: Load old specs BEFORE saving (needed for changelog diff)
  const oldSpecs = loadAllSpecs(specsDir);

  if (options.dryRun) {
    console.log('Dry run mode - not saving changes.');
    return {
      success: true,
      hasChanges: true,
      changeResult,
      filesProcessed,
      nodesProcessed: fetchedNodes.length,
      apiCallCount,
      errors,
    };
  }

  // Step 7: Save new/updated specs
  console.log('Saving specs...');
  for (const spec of newSpecs.values()) {
    saveSpec(specsDir, spec);
  }

  // Remove specs for removed nodes
  for (const nodeId of changeResult.removed) {
    removeSpec(specsDir, nodeId);
  }

  // Step 8: Export images (if enabled)
  let imageExportResult: ImageExportResult = { images: [], errors: [] };
  if (config.exportImages) {
    console.log('Exporting images...');

    const imageInputs = [...changeResult.added, ...changeResult.changed]
      .map((nodeId) => ({
        fileKey: nodeToFileKey.get(nodeId) || '',
        nodeId,
      }))
      .filter((input) => input.fileKey);

    try {
      imageExportResult = await exportImagesForMultipleFiles(
        imageInputs,
        changeResult,
        config
      );
      apiCallCount += new Set(imageInputs.map((i) => i.fileKey)).size;

      if (imageExportResult.errors.length > 0) {
        for (const error of imageExportResult.errors) {
          errors.push(`Image export ${error.nodeId}: ${error.message}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to export images';
      errors.push(message);
    }

    // Cleanup images for removed nodes
    if (changeResult.removed.length > 0) {
      cleanupRemovedImages(specsDir, changeResult.removed);
    }
  }

  // Step 9: Export Markdown specs (if configured)
  if (config.outputFormat === 'markdown' || config.outputFormat === 'both') {
    console.log('Exporting Markdown specs...');
    const specsToExport = Array.from(newSpecs.values()).filter(
      (spec) =>
        changeResult.added.includes(spec.id) ||
        changeResult.changed.includes(spec.id)
    );

    // Use resolved specsDir path for markdown export
    const configWithAbsolutePath = { ...config, specsDir };
    const markdownResult = exportSpecsAsMarkdown(
      specsToExport,
      configWithAbsolutePath
    );
    console.log(`Exported ${markdownResult.exported.length} Markdown spec(s)`);

    // Remove Markdown specs for removed nodes
    for (const nodeId of changeResult.removed) {
      removeMarkdownSpec(specsDir, nodeId);
    }
  }

  // Step 10: Generate changelog (using old specs loaded before saving)
  console.log('Generating changelog...');
  let entries = generateChangelogEntries(specsDir, changeResult, newSpecs, oldSpecs);

  if (config.exportImages && imageExportResult.images.length > 0) {
    entries = attachImagePaths(entries, imageExportResult);
  }

  const changelog = generateChangelogMarkdown(entries, {
    includeImages: config.exportImages,
  });

  const changelogPath = path.join(specsDir, 'DESIGN_CHANGELOG.md');
  writeChangelog(specsDir, changelog);

  // Step 11: Generate PR body
  const prBody = generatePRBody(entries);
  const prBodyPath = path.join(specsDir, 'PR_BODY.md');
  fs.writeFileSync(prBodyPath, prBody, 'utf-8');

  console.log('');
  console.log('='.repeat(60));
  console.log('Figma Design Sentinel completed successfully!');
  console.log(`  Files processed: ${filesProcessed}`);
  console.log(`  Nodes processed: ${fetchedNodes.length}`);
  console.log(`  API calls made: ${apiCallCount}`);
  console.log(`  Changelog: ${changelogPath}`);
  console.log(`  PR Body: ${prBodyPath}`);
  console.log('='.repeat(60));

  return {
    success: true,
    hasChanges: true,
    changeResult,
    filesProcessed,
    nodesProcessed: fetchedNodes.length,
    apiCallCount,
    changelogPath,
    prBodyPath,
    errors,
  };
}
