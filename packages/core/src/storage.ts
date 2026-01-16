/**
 * Figma Design Sentinel - Spec Storage & Change Detection
 *
 * Persists normalized specs to disk and detects changes via content hash comparison.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  NormalizedSpec,
  ChangeDetectionResult,
  FigmaNode,
  SentinelConfig,
} from './types.js';
import { normalizeNode, toStableJson } from './normalizer.js';

const DEFAULT_SPECS_DIR = '.design-specs';

/**
 * Sanitizes a node ID for use as a filename.
 * Replaces colons with dashes (e.g., "1:23" -> "1-23").
 */
export function sanitizeNodeId(nodeId: string): string {
  return nodeId.replace(/:/g, '-');
}

/**
 * Gets the full path for a spec file.
 */
export function getSpecFilePath(specsDir: string, nodeId: string): string {
  return path.join(specsDir, `${sanitizeNodeId(nodeId)}.json`);
}

/**
 * Computes a content hash for change detection.
 * Uses SHA-256 truncated to 16 chars for readability.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Loads an existing spec from disk.
 * Returns null if the spec doesn't exist.
 */
export function loadSpec(specsDir: string, nodeId: string): NormalizedSpec | null {
  const filePath = getSpecFilePath(specsDir, nodeId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as NormalizedSpec;
  } catch {
    console.warn(`Warning: Failed to read spec file: ${filePath}`);
    return null;
  }
}

/**
 * Loads all existing specs from the specs directory.
 * Returns a Map of nodeId -> NormalizedSpec.
 */
export function loadAllSpecs(specsDir: string): Map<string, NormalizedSpec> {
  const specs = new Map<string, NormalizedSpec>();

  if (!fs.existsSync(specsDir)) {
    return specs;
  }

  const files = fs.readdirSync(specsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(specsDir, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const spec = JSON.parse(content) as NormalizedSpec;
      if (spec.id) {
        specs.set(spec.id, spec);
      }
    } catch {
      console.warn(`Warning: Failed to read spec file: ${filePath}`);
    }
  }

  return specs;
}

/**
 * Creates a normalized spec from a Figma node.
 * For COMPONENT_SET nodes, includes variant children in the spec.
 */
export function createNormalizedSpec(
  node: FigmaNode,
  sourceFile: string,
  fileKey: string,
  config?: SentinelConfig
): NormalizedSpec {
  const normalizedNode = normalizeNode(
    node as unknown as Record<string, unknown>,
    {
      includeProperties: config?.includeProperties,
      excludeProperties: config?.excludeProperties,
    }
  );

  const stableJson = toStableJson(normalizedNode);

  // For COMPONENT_SET, extract variants and create variant specs
  let variants: NormalizedSpec[] | undefined;
  if (node.type === 'COMPONENT_SET' && node.children && node.children.length > 0) {
    variants = node.children.map((variantNode) => {
      const normalizedVariant = normalizeNode(
        variantNode as unknown as Record<string, unknown>,
        {
          includeProperties: config?.includeProperties,
          excludeProperties: config?.excludeProperties,
        }
      );
      const variantJson = toStableJson(normalizedVariant);
      const variantHash = computeContentHash(variantJson);

      return {
        id: variantNode.id,
        name: variantNode.name,
        type: variantNode.type,
        sourceFile,
        fileKey,
        node: normalizedVariant,
        contentHash: variantHash,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  // Compute hash including variants for change detection
  const contentToHash = variants
    ? stableJson + variants.map(v => v.contentHash).join('')
    : stableJson;
  const contentHash = computeContentHash(contentToHash);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    sourceFile,
    fileKey,
    node: normalizedNode,
    contentHash,
    generatedAt: new Date().toISOString(),
    variants,
  };
}

/**
 * Saves a spec to disk.
 */
export function saveSpec(specsDir: string, spec: NormalizedSpec): void {
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const filePath = getSpecFilePath(specsDir, spec.id);
  const content = JSON.stringify(spec, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Removes a spec file from disk.
 */
export function removeSpec(specsDir: string, nodeId: string): boolean {
  const filePath = getSpecFilePath(specsDir, nodeId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    console.warn(`Warning: Failed to remove spec file: ${filePath}`);
    return false;
  }
}

export interface SaveAndDetectInput {
  node: FigmaNode;
  sourceFile: string;
  fileKey: string;
}

/**
 * Detects changes between current specs and new nodes.
 * Returns the change detection result without modifying files.
 */
export function detectChanges(
  specsDir: string,
  newSpecs: NormalizedSpec[]
): ChangeDetectionResult {
  const existingSpecs = loadAllSpecs(specsDir);
  const newSpecIds = new Set(newSpecs.map((s) => s.id));

  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const spec of newSpecs) {
    const existing = existingSpecs.get(spec.id);

    if (!existing) {
      added.push(spec.id);
    } else if (existing.contentHash !== spec.contentHash) {
      changed.push(spec.id);
    }
  }

  for (const [nodeId] of existingSpecs) {
    if (!newSpecIds.has(nodeId)) {
      removed.push(nodeId);
    }
  }

  return {
    hasChanges: added.length > 0 || changed.length > 0 || removed.length > 0,
    added,
    changed,
    removed,
  };
}

/**
 * Saves specs and returns change detection result.
 * This is the main entry point for spec storage with change detection.
 */
export function saveAndDetectChanges(
  specsDir: string,
  inputs: SaveAndDetectInput[],
  config?: SentinelConfig
): ChangeDetectionResult {
  const resolvedDir = specsDir || DEFAULT_SPECS_DIR;
  const newSpecs = inputs.map((input) =>
    createNormalizedSpec(input.node, input.sourceFile, input.fileKey, config)
  );

  const result = detectChanges(resolvedDir, newSpecs);

  for (const spec of newSpecs) {
    saveSpec(resolvedDir, spec);
  }

  for (const nodeId of result.removed) {
    removeSpec(resolvedDir, nodeId);
  }

  return result;
}

/**
 * Gets the previous spec for a node (for comparison).
 */
export function getPreviousSpec(
  specsDir: string,
  nodeId: string
): NormalizedSpec | null {
  return loadSpec(specsDir, nodeId);
}
