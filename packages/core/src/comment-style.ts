/**
 * Comment Style Detection
 *
 * Determines the correct comment syntax for different file types
 * and formats Figma directives accordingly.
 */

import * as path from 'path';

export interface CommentStyle {
  type: 'single-line' | 'block' | 'html';
  prefix: string;
  suffix?: string;
}

/**
 * File extensions that use C-style single-line comments (//):
 * .ts, .tsx, .js, .jsx, .swift, .kt, .go, .rs
 *
 * These are the default, so we only need to check other comment styles explicitly.
 */

/**
 * File extensions that use hash comments (#)
 */
const HASH_COMMENT_EXTENSIONS = new Set(['.py', '.rb', '.sh', '.yaml', '.yml']);

/**
 * File extensions that use CSS block comments
 */
const CSS_COMMENT_EXTENSIONS = new Set(['.css', '.scss', '.less']);

/**
 * File extensions that use HTML comments
 */
const HTML_COMMENT_EXTENSIONS = new Set(['.html', '.vue', '.svelte']);

/**
 * Gets the comment style for a given file path based on its extension.
 *
 * @param filePath - The path to the file
 * @returns The comment style for the file type
 */
export function getCommentStyle(filePath: string): CommentStyle {
  const ext = path.extname(filePath).toLowerCase();

  if (HASH_COMMENT_EXTENSIONS.has(ext)) {
    return { type: 'single-line', prefix: '#' };
  }

  if (CSS_COMMENT_EXTENSIONS.has(ext)) {
    return { type: 'block', prefix: '/*', suffix: '*/' };
  }

  if (HTML_COMMENT_EXTENSIONS.has(ext)) {
    return { type: 'html', prefix: '<!--', suffix: '-->' };
  }

  // Default to C-style comments (also covers SLASH_COMMENT_EXTENSIONS)
  return { type: 'single-line', prefix: '//' };
}

/**
 * Formats a Figma directive with the correct comment style for the file type.
 *
 * @param fileKey - The Figma file key
 * @param nodeId - The optional node ID
 * @param filePath - The path to the target file
 * @returns Formatted directive string(s)
 */
export function formatDirective(
  fileKey: string,
  nodeId: string | null,
  filePath: string
): string {
  const style = getCommentStyle(filePath);

  const formatLine = (content: string): string => {
    if (style.suffix) {
      return `${style.prefix} ${content} ${style.suffix}`;
    }
    return `${style.prefix} ${content}`;
  };

  const lines: string[] = [];

  lines.push(formatLine(`@figma-file: ${fileKey}`));

  if (nodeId) {
    lines.push(formatLine(`@figma-node: ${nodeId}`));
  }

  return lines.join('\n');
}
