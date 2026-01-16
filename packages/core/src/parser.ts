/**
 * Figma Design Sentinel - Directive Parser
 *
 * Extracts @figma-file and @figma-node directives from source files.
 */

import * as fs from 'fs';
import fg from 'fast-glob';
import type { FigmaDirective } from './types.js';

/**
 * Regex patterns for extracting Figma directives from comments.
 * Supports both // and /* style comments.
 */
const FIGMA_FILE_REGEX = /\/\/\s*@figma-file:\s*([^\s\n]+)|\/\*\s*@figma-file:\s*([^\s*]+)/g;
const FIGMA_NODE_REGEX = /\/\/\s*@figma-node:\s*([^\s\n]+)|\/\*\s*@figma-node:\s*([^\s*]+)/g;

/**
 * Default file patterns to search for directives.
 */
const DEFAULT_FILE_PATTERNS = ['src/**/*.tsx', 'src/**/*.jsx'];

/**
 * Parses a single file and extracts Figma directives.
 * @param filePath - Absolute path to the file
 * @returns FigmaDirective object if valid directives found, null otherwise
 */
export function parseFile(filePath: string): FigmaDirective | null {
  let content: string;

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`[figma-sentinel] Warning: Could not read file ${filePath}`);
    return null;
  }

  const fileKeys: string[] = [];
  const nodeIds: string[] = [];

  let match: RegExpExecArray | null;

  FIGMA_FILE_REGEX.lastIndex = 0;
  while ((match = FIGMA_FILE_REGEX.exec(content)) !== null) {
    const fileKey = match[1] || match[2];
    if (fileKey && !fileKeys.includes(fileKey)) {
      fileKeys.push(fileKey);
    }
  }

  FIGMA_NODE_REGEX.lastIndex = 0;
  while ((match = FIGMA_NODE_REGEX.exec(content)) !== null) {
    const nodeId = match[1] || match[2];
    if (nodeId && !nodeIds.includes(nodeId)) {
      nodeIds.push(nodeId);
    }
  }

  if (fileKeys.length === 0 && nodeIds.length === 0) {
    return null;
  }

  if (fileKeys.length === 0 && nodeIds.length > 0) {
    console.warn(
      `[figma-sentinel] Warning: ${filePath} has @figma-node directive(s) but no @figma-file directive. Skipping.`
    );
    return null;
  }

  if (fileKeys.length > 1) {
    console.warn(
      `[figma-sentinel] Warning: ${filePath} has multiple @figma-file directives. Using first one: ${fileKeys[0]}`
    );
  }

  if (nodeIds.length === 0) {
    console.warn(
      `[figma-sentinel] Warning: ${filePath} has @figma-file directive but no @figma-node directives. Skipping.`
    );
    return null;
  }

  return {
    sourceFile: filePath,
    fileKey: fileKeys[0]!,
    nodeIds,
  };
}

/**
 * Parses all files matching the given patterns and extracts Figma directives.
 * @param patterns - Glob patterns for files to search (default: src tsx and jsx files)
 * @param excludePatterns - Glob patterns for files to exclude
 * @param cwd - Current working directory for glob resolution (default: process.cwd())
 * @returns Array of FigmaDirective objects
 */
export async function parseDirectives(
  patterns: string[] = DEFAULT_FILE_PATTERNS,
  excludePatterns: string[] = [],
  cwd: string = process.cwd()
): Promise<FigmaDirective[]> {
  const directives: FigmaDirective[] = [];

  for (const pattern of patterns) {
    const files = await fg(pattern, {
      cwd,
      ignore: excludePatterns,
      absolute: true,
      onlyFiles: true,
    });

    for (const file of files) {
      const directive = parseFile(file);
      if (directive) {
        directives.push(directive);
      }
    }
  }

  return directives;
}

/**
 * Synchronous version of parseDirectives for simpler use cases.
 * @param patterns - Glob patterns for files to search
 * @param excludePatterns - Glob patterns for files to exclude
 * @param cwd - Current working directory for glob resolution
 * @returns Array of FigmaDirective objects
 */
export function parseDirectivesSync(
  patterns: string[] = DEFAULT_FILE_PATTERNS,
  excludePatterns: string[] = [],
  cwd: string = process.cwd()
): FigmaDirective[] {
  const directives: FigmaDirective[] = [];

  for (const pattern of patterns) {
    const files = fg.sync(pattern, {
      cwd,
      ignore: excludePatterns,
      absolute: true,
      onlyFiles: true,
    });

    for (const file of files) {
      const directive = parseFile(file);
      if (directive) {
        directives.push(directive);
      }
    }
  }

  return directives;
}
