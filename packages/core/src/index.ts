// Figma Sentinel Core - Entry point

export const VERSION = '1.0.0';

// Type exports
export type {
  FigmaDirective,
  FigmaNode,
  FigmaFill,
  FigmaStroke,
  FigmaEffect,
  FigmaColor,
  FigmaGradientStop,
  FigmaVector,
  FigmaTextStyle,
  FigmaConstraints,
  NormalizedSpec,
  ChangelogEntry,
  PropertyChange,
  VariantChange,
  SentinelConfig,
  ChangeDetectionResult,
  FigmaApiNodesResponse,
  FigmaApiImagesResponse,
  FetchRequest,
} from './types.js';

// Normalizer exports
export {
  normalizeNode,
  toStableJson,
  createNormalizer,
  type NormalizerConfig,
} from './normalizer.js';

// Parser exports
export { parseFile, parseDirectives, parseDirectivesSync } from './parser.js';
