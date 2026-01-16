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

// Figma Client exports
export {
  fetchNodes,
  type FetchedNode,
  type FetchResult,
  type FetchError,
} from './figma-client.js';

// Storage exports
export {
  createNormalizedSpec,
  saveSpec,
  loadSpec,
  loadAllSpecs,
  detectChanges,
  saveAndDetectChanges,
  removeSpec,
  sanitizeNodeId,
  getSpecFilePath,
  computeContentHash,
  getPreviousSpec,
  type SaveAndDetectInput,
} from './storage.js';

// Differ exports
export {
  generateChangelogEntries,
  generateChangelogMarkdown,
  generatePRBody,
  diffSpecs,
  diffVariants,
  formatValue,
  formatColor,
  formatPropertyPath,
  getRelativeImagePath,
  getRelativePreviousImagePath,
  attachImagePaths,
  writeChangelog,
  generateChangelog,
} from './differ.js';

// Image Exporter exports
export {
  exportImages,
  exportImagesForMultipleFiles,
  cleanupRemovedImages,
  getImagePath,
  getPreviousImagePath,
  type ExportedImage,
  type ImageExportResult,
  type ImageExportError,
  type ExportImagesInput,
} from './image-exporter.js';
