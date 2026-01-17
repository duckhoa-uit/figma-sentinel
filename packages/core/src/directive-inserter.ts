/**
 * Directive Insertion
 *
 * Inserts Figma directives at the top of source files.
 * Handles various edge cases like shebangs and existing content.
 */

import { formatDirective, getCommentStyle } from './comment-style.js';
import { detectDirectives } from './directive-detector.js';

export interface InsertDirectivesOptions {
  fileKey: string;
  nodeId?: string | null;
  filePath: string;
  content: string;
  mode?: 'insert' | 'append' | 'replace';
}

export interface InsertDirectivesResult {
  content: string;
  modified: boolean;
}

/**
 * Detects the line ending style used in the content.
 * Returns '\r\n' for CRLF, '\n' for LF (default).
 */
function detectLineEnding(content: string): string {
  if (content.includes('\r\n')) {
    return '\r\n';
  }
  return '\n';
}

/**
 * Checks if the content starts with a shebang line.
 */
function hasShebang(content: string): boolean {
  return content.startsWith('#!');
}

/**
 * Splits content into shebang line and rest of content.
 */
function splitShebang(content: string): { shebang: string | null; rest: string } {
  if (!hasShebang(content)) {
    return { shebang: null, rest: content };
  }

  const lineEnding = detectLineEnding(content);
  const firstLineEnd = content.indexOf(lineEnding);

  if (firstLineEnd === -1) {
    // Content is only the shebang line
    return { shebang: content, rest: '' };
  }

  return {
    shebang: content.slice(0, firstLineEnd),
    rest: content.slice(firstLineEnd + lineEnding.length),
  };
}

/**
 * Removes existing Figma directive lines from the content.
 * Supports all comment styles.
 */
function removeExistingDirectives(content: string): string {
  const lineEnding = detectLineEnding(content);
  const lines = content.split(/\r?\n/);

  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();

    // Single-line comments: // or #
    if (trimmed.match(/^(?:\/\/|#)\s*@figma-(?:file|node):/)) {
      return false;
    }

    // Block comments: /* ... */
    if (trimmed.match(/^\/\*\s*@figma-(?:file|node):.*\*\/$/)) {
      return false;
    }

    // HTML comments: <!-- ... -->
    if (trimmed.match(/^<!--\s*@figma-(?:file|node):.*-->$/)) {
      return false;
    }

    return true;
  });

  // Remove leading empty lines that were left after removing directives
  let startIndex = 0;
  while (startIndex < filteredLines.length) {
    const line = filteredLines[startIndex];
    if (line !== undefined && line.trim() === '') {
      startIndex++;
    } else {
      break;
    }
  }

  return filteredLines.slice(startIndex).join(lineEnding);
}

/**
 * Inserts Figma directives at the top of a source file.
 *
 * @param options - Configuration for directive insertion
 * @returns Object with new content and whether it was modified
 */
export function insertDirectives(options: InsertDirectivesOptions): InsertDirectivesResult {
  const { fileKey, nodeId = null, filePath, content, mode = 'insert' } = options;

  const lineEnding = detectLineEnding(content);
  const { shebang, rest: contentAfterShebang } = splitShebang(content);

  // Detect existing directives
  const existing = detectDirectives(content);

  // Handle different modes
  if (mode === 'append') {
    // Only append a new node ID to existing directives
    if (!existing.hasFileDirective) {
      // No existing directives, fall through to insert
    } else if (nodeId && !existing.nodeIds.includes(nodeId)) {
      // Append new node ID
      const nodeDirective = formatNodeOnlyDirective(nodeId, filePath);
      const insertedContent = insertAfterExistingDirectives(content, nodeDirective, lineEnding);
      return { content: insertedContent, modified: true };
    } else {
      // Node already exists or no node to add
      return { content, modified: false };
    }
  }

  // For 'replace' mode, remove existing directives first
  let workingContent = contentAfterShebang;
  if (mode === 'replace') {
    workingContent = removeExistingDirectives(contentAfterShebang);
  } else if (mode === 'insert' && existing.hasFileDirective) {
    // Insert mode but directives already exist - don't modify
    return { content, modified: false };
  }

  // Format the new directives
  const directives = formatDirective(fileKey, nodeId, filePath);

  // Build the new content
  const parts: string[] = [];

  if (shebang) {
    parts.push(shebang);
  }

  parts.push(directives);

  // Add blank line between directives and existing content if there's content
  const trimmedWorking = workingContent.trim();
  if (trimmedWorking) {
    parts.push('');
    parts.push(trimmedWorking);
  }

  const newContent = parts.join(lineEnding) + (trimmedWorking ? lineEnding : '');

  return { content: newContent, modified: true };
}

/**
 * Formats just a @figma-node directive line for appending.
 */
function formatNodeOnlyDirective(nodeId: string, filePath: string): string {
  const style = getCommentStyle(filePath);

  const content = `@figma-node: ${nodeId}`;
  if (style.suffix) {
    return `${style.prefix} ${content} ${style.suffix}`;
  }
  return `${style.prefix} ${content}`;
}

/**
 * Inserts a new node directive after the last existing directive line.
 */
function insertAfterExistingDirectives(
  content: string,
  nodeDirective: string,
  lineEnding: string
): string {
  const lines = content.split(/\r?\n/);
  let lastDirectiveIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Check if this line is a directive
    const isDirective =
      trimmed.match(/^(?:\/\/|#)\s*@figma-(?:file|node):/) ||
      trimmed.match(/^\/\*\s*@figma-(?:file|node):.*\*\/$/) ||
      trimmed.match(/^<!--\s*@figma-(?:file|node):.*-->$/);

    if (isDirective) {
      lastDirectiveIndex = i;
    } else if (lastDirectiveIndex >= 0 && trimmed !== '') {
      // We've passed the directives and hit non-empty content
      break;
    }
  }

  if (lastDirectiveIndex === -1) {
    // No directives found, shouldn't happen in append mode
    return content;
  }

  // Insert the new directive after the last one
  lines.splice(lastDirectiveIndex + 1, 0, nodeDirective);
  return lines.join(lineEnding);
}

/**
 * Convenience function to add a node to an existing file with directives.
 *
 * @param fileKey - The Figma file key (must match existing)
 * @param nodeId - The node ID to add
 * @param filePath - Path to the target file
 * @param content - Current file content
 * @returns Updated content or null if file key doesn't match
 */
export function appendNodeDirective(
  fileKey: string,
  nodeId: string,
  filePath: string,
  content: string
): InsertDirectivesResult {
  const existing = detectDirectives(content);

  if (existing.hasFileDirective && existing.fileKey !== fileKey) {
    // File key mismatch
    return { content, modified: false };
  }

  return insertDirectives({
    fileKey,
    nodeId,
    filePath,
    content,
    mode: 'append',
  });
}

/**
 * Replaces all existing directives with new ones.
 *
 * @param fileKey - The new Figma file key
 * @param nodeId - The optional new node ID
 * @param filePath - Path to the target file
 * @param content - Current file content
 * @returns Updated content
 */
export function replaceDirectives(
  fileKey: string,
  nodeId: string | null,
  filePath: string,
  content: string
): InsertDirectivesResult {
  return insertDirectives({
    fileKey,
    nodeId,
    filePath,
    content,
    mode: 'replace',
  });
}
