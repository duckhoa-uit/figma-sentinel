/**
 * Figma Design Sentinel - JSON Normalizer
 *
 * Filters out volatile properties (position, timestamps, user info) from Figma API responses
 * to produce deterministic specs that only trigger updates for actual visual changes.
 */

import type { FigmaNode, SentinelConfig } from './types.js';

/**
 * Default properties to exclude (volatile/positional data)
 */
const DEFAULT_EXCLUDED_PROPERTIES: string[] = [
  'absoluteBoundingBox',
  'absoluteRenderBounds',
  'relativeTransform',
  'size',
  'transitionNodeID',
  'transitionDuration',
  'transitionEasing',
  'exportSettings',
  'preserveRatio',
  'layoutAlign',
  'layoutGrow',
  'layoutPositioning',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'clipsContent',
  'overflowDirection',
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'strokeMiterAngle',
  'strokeDashes',
  'strokeGeometry',
  'fillGeometry',
  'isMask',
  'isMaskOutline',
  'locked',
  'pluginData',
  'sharedPluginData',
  'reactions',
  'flowStartingPoints',
  'prototypeStartNodeID',
  'prototypeDevice',
  'scrollBehavior',
];

/**
 * Properties that should always be preserved (visual properties)
 */
const DEFAULT_PRESERVED_PROPERTIES: string[] = [
  'id',
  'name',
  'type',
  'fills',
  'strokes',
  'effects',
  'style',
  'layoutMode',
  'itemSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'constraints',
  'children',
  'cornerRadius',
  'rectangleCornerRadii',
  'opacity',
  'blendMode',
  'visible',
  'componentProperties',
  'variantProperties',
  'characters',
];

export interface NormalizerConfig {
  includeProperties?: string[];
  excludeProperties?: string[];
}

/**
 * Normalizes a Figma node by removing volatile properties and sorting keys
 * for deterministic output.
 */
export function normalizeNode(
  node: Record<string, unknown>,
  config?: NormalizerConfig
): FigmaNode {
  const excludeSet = new Set([
    ...DEFAULT_EXCLUDED_PROPERTIES,
    ...(config?.excludeProperties ?? []),
  ]);

  const includeSet = config?.includeProperties
    ? new Set(config.includeProperties)
    : null;

  return normalizeObject(node, excludeSet, includeSet) as FigmaNode;
}

/**
 * Recursively normalizes an object by:
 * 1. Filtering out excluded properties
 * 2. Sorting keys for deterministic output
 * 3. Recursively processing nested objects and arrays
 */
function normalizeObject(
  obj: unknown,
  excludeSet: Set<string>,
  includeSet: Set<string> | null
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeObject(item, excludeSet, includeSet));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    if (excludeSet.has(key)) {
      continue;
    }

    if (includeSet && !includeSet.has(key) && !DEFAULT_PRESERVED_PROPERTIES.includes(key)) {
      continue;
    }

    const value = record[key];
    if (value === undefined) {
      continue;
    }

    if (key === 'children' && Array.isArray(value)) {
      result[key] = value.map((child) =>
        normalizeObject(child, excludeSet, includeSet)
      );
    } else {
      result[key] = normalizeObject(value, excludeSet, includeSet);
    }
  }

  return result;
}

/**
 * Converts a normalized node to deterministic JSON string.
 * Uses sorted keys and consistent formatting.
 */
export function toStableJson(node: FigmaNode): string {
  return JSON.stringify(node, sortedReplacer, 2);
}

/**
 * JSON replacer that ensures keys are sorted for deterministic output.
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Creates a normalizer function with a specific configuration.
 * Useful for reusing the same config across multiple nodes.
 */
export function createNormalizer(
  config?: SentinelConfig
): (node: Record<string, unknown>) => FigmaNode {
  const normalizerConfig: NormalizerConfig = {
    includeProperties: config?.includeProperties,
    excludeProperties: config?.excludeProperties,
  };

  return (node: Record<string, unknown>) => normalizeNode(node, normalizerConfig);
}
