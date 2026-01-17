/**
 * Figma URL Parser
 *
 * Parses Figma design URLs and extracts file keys and node IDs.
 */

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string | null;
}

/**
 * Error thrown when a Figma URL is invalid or unsupported.
 */
export class FigmaUrlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigmaUrlParseError';
  }
}

/**
 * Parses a Figma URL and extracts the file key and optional node ID.
 *
 * Supported URL formats:
 * - https://www.figma.com/design/<fileKey>/<fileName>?node-id=<nodeId>
 * - https://www.figma.com/file/<fileKey>/<fileName>?node-id=<nodeId>
 *
 * @param url - The Figma URL to parse
 * @returns The parsed file key and node ID
 * @throws FigmaUrlParseError if the URL is invalid or unsupported
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new FigmaUrlParseError(`Invalid URL format: ${url}`);
  }

  // Validate hostname
  if (!['figma.com', 'www.figma.com'].includes(parsedUrl.hostname)) {
    throw new FigmaUrlParseError(
      `Not a Figma URL. Expected figma.com hostname, got: ${parsedUrl.hostname}`
    );
  }

  // Parse the pathname: /<type>/<fileKey>/<fileName>
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

  if (pathParts.length < 2) {
    throw new FigmaUrlParseError(
      `Invalid Figma URL path. Expected /<type>/<fileKey>/..., got: ${parsedUrl.pathname}`
    );
  }

  const [urlType, fileKey] = pathParts;

  // Check for unsupported URL types
  if (urlType === 'board') {
    throw new FigmaUrlParseError(
      'FigJam board URLs are not supported. Please use a Figma design file URL.'
    );
  }

  if (urlType === 'proto') {
    throw new FigmaUrlParseError(
      'Prototype URLs are not supported. Please use a Figma design file URL.'
    );
  }

  // Validate URL type
  if (urlType !== 'design' && urlType !== 'file') {
    throw new FigmaUrlParseError(
      `Unsupported Figma URL type: "${urlType}". Expected "design" or "file".`
    );
  }

  // Validate file key
  if (!fileKey || fileKey.length === 0) {
    throw new FigmaUrlParseError('Missing file key in Figma URL.');
  }

  // Extract node ID from query parameter
  const nodeIdParam = parsedUrl.searchParams.get('node-id');
  let nodeId: string | null = null;

  if (nodeIdParam) {
    // URL-decode the node ID (e.g., "1%3A23" → "1:23")
    nodeId = decodeURIComponent(nodeIdParam);
  }

  return {
    fileKey,
    nodeId,
  };
}
