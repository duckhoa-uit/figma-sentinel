/**
 * Figma API Client
 *
 * Fetches specific Figma nodes referenced in code with batching and rate limiting.
 */

import type {
  FigmaDirective,
  FigmaApiNodesResponse,
  FigmaNode,
  FetchRequest,
} from './types.js';

const FIGMA_API_BASE = 'https://api.figma.com';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface FetchedNode {
  nodeId: string;
  node: FigmaNode;
  sourceFiles: string[];
}

export interface FetchResult {
  nodes: FetchedNode[];
  errors: FetchError[];
}

export interface FetchError {
  nodeId: string;
  message: string;
}

function getToken(): string {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    throw new Error(
      'FIGMA_TOKEN environment variable is required. Set it with your Figma personal access token.',
    );
  }
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  token: string,
  retryCount = 0,
): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (response.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(
        `Figma API rate limit exceeded. Max retries (${MAX_RETRIES}) reached.`,
      );
    }
    const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
    console.warn(
      `Rate limited by Figma API. Retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    );
    await sleep(backoffMs);
    return fetchWithRetry(url, token, retryCount + 1);
  }

  return response;
}

function groupDirectivesByFileKey(directives: FigmaDirective[]): FetchRequest[] {
  const groups = new Map<string, FetchRequest>();

  for (const directive of directives) {
    let request = groups.get(directive.fileKey);

    if (!request) {
      request = {
        fileKey: directive.fileKey,
        nodeIds: [],
        sourceFiles: new Map<string, string[]>(),
      };
      groups.set(directive.fileKey, request);
    }

    for (const nodeId of directive.nodeIds) {
      if (!request.nodeIds.includes(nodeId)) {
        request.nodeIds.push(nodeId);
      }
      const sources = request.sourceFiles.get(nodeId) || [];
      if (!sources.includes(directive.sourceFile)) {
        sources.push(directive.sourceFile);
        request.sourceFiles.set(nodeId, sources);
      }
    }
  }

  return Array.from(groups.values());
}

async function fetchNodesForFileKey(
  request: FetchRequest,
  token: string,
): Promise<FetchResult> {
  const { fileKey, nodeIds, sourceFiles } = request;
  const nodes: FetchedNode[] = [];
  const errors: FetchError[] = [];

  const idsParam = nodeIds.join(',');
  const url = `${FIGMA_API_BASE}/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`;

  let response: Response;
  try {
    response = await fetchWithRetry(url, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    for (const nodeId of nodeIds) {
      errors.push({ nodeId, message });
    }
    return { nodes, errors };
  }

  if (!response.ok) {
    let errorMessage = `Figma API error: ${response.status} ${response.statusText}`;
    if (response.status === 403) {
      errorMessage =
        'Invalid or expired FIGMA_TOKEN. Please check your token has access to this file.';
    } else if (response.status === 404) {
      errorMessage = `Figma file not found: ${fileKey}. Check the file key is correct.`;
    }
    for (const nodeId of nodeIds) {
      errors.push({ nodeId, message: errorMessage });
    }
    return { nodes, errors };
  }

  let data: FigmaApiNodesResponse;
  try {
    data = (await response.json()) as FigmaApiNodesResponse;
  } catch {
    for (const nodeId of nodeIds) {
      errors.push({ nodeId, message: 'Failed to parse Figma API response' });
    }
    return { nodes, errors };
  }

  for (const nodeId of nodeIds) {
    const nodeData = data.nodes[nodeId];
    if (nodeData && nodeData.document) {
      nodes.push({
        nodeId,
        node: nodeData.document,
        sourceFiles: sourceFiles.get(nodeId) || [],
      });
    } else {
      errors.push({
        nodeId,
        message: `Node ${nodeId} not found in file ${fileKey}`,
      });
    }
  }

  return { nodes, errors };
}

export async function fetchNodes(directives: FigmaDirective[]): Promise<FetchResult> {
  const token = getToken();
  const requests = groupDirectivesByFileKey(directives);
  const allNodes: FetchedNode[] = [];
  const allErrors: FetchError[] = [];

  console.log(
    `Fetching ${directives.reduce((sum, d) => sum + d.nodeIds.length, 0)} nodes from ${requests.length} Figma file(s)`,
  );

  for (const request of requests) {
    const result = await fetchNodesForFileKey(request, token);
    allNodes.push(...result.nodes);
    allErrors.push(...result.errors);
  }

  if (allErrors.length > 0) {
    console.warn(`Encountered ${allErrors.length} error(s) while fetching nodes:`);
    for (const error of allErrors) {
      console.warn(`  - ${error.nodeId}: ${error.message}`);
    }
  }

  console.log(`Successfully fetched ${allNodes.length} node(s)`);

  return {
    nodes: allNodes,
    errors: allErrors,
  };
}
