/**
 * Directive Detection
 *
 * Detects existing Figma directives in source files.
 * Supports detection in various comment styles.
 */

export interface DetectedDirectives {
  hasFileDirective: boolean;
  fileKey: string | null;
  nodeIds: string[];
}

/**
 * Regex patterns to match @figma-file directives in different comment styles:
 * - Single-line: // @figma-file: key or # @figma-file: key
 * - Block: /* @figma-file: key (with optional whitespace)
 * - HTML: HTML comment style (with optional whitespace)
 */
const FIGMA_FILE_PATTERNS = [
  // Single-line comments: // or #
  /(?:\/\/|#)\s*@figma-file:\s*([^\s]+)/,
  // Block comments: /* ... */
  /\/\*\s*@figma-file:\s*([^\s*]+)\s*\*\//,
  // HTML comments
  /<!\s*--\s*@figma-file:\s*([^\s-]+)\s*--\s*>/,
];

/**
 * Regex patterns to match @figma-node directives in different comment styles
 */
const FIGMA_NODE_PATTERNS = [
  // Single-line comments: // or #
  /(?:\/\/|#)\s*@figma-node:\s*([^\s]+)/g,
  // Block comments: /* ... */
  /\/\*\s*@figma-node:\s*([^\s*]+)\s*\*\//g,
  // HTML comments
  /<!\s*--\s*@figma-node:\s*([^\s-]+)\s*--\s*>/g,
];

/**
 * Detects existing Figma directives in source file content.
 *
 * @param content - The source file content to scan
 * @returns Object containing detected directive information
 */
export function detectDirectives(content: string): DetectedDirectives {
  let fileKey: string | null = null;

  // Look for @figma-file directive
  for (const pattern of FIGMA_FILE_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      fileKey = match[1];
      break;
    }
  }

  // Collect all @figma-node directives
  const nodeIds: string[] = [];
  for (const pattern of FIGMA_NODE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const nodeId = match[1];
      if (nodeId && !nodeIds.includes(nodeId)) {
        nodeIds.push(nodeId);
      }
    }
  }

  return {
    hasFileDirective: fileKey !== null,
    fileKey,
    nodeIds,
  };
}
