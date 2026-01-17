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
export { parseFile, parseDirectives, parseDirectivesSync, parseVariablesFile, parseVariablesDirectives, parseVariablesDirectivesSync } from './parser.js';

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

// Markdown Exporter exports
export {
  exportSpecsAsMarkdown,
  generateMarkdownFromSpec,
  isFigmaExtractorAvailable,
  getMarkdownFilePath,
  generateMarkdownWithExtractor,
  saveMarkdownSpec,
  exportSpecAsMarkdown,
  removeMarkdownSpec,
  type MarkdownExportResult,
} from './markdown-exporter.js';

// Sentinel orchestrator exports
export {
  runSentinel,
  type SentinelResult,
  type SentinelOptions,
} from './sentinel.js';

// Config exports
export {
  DEFAULT_CONFIG,
  validateConfig,
  loadConfig,
  loadConfigFromFile,
  mergeConfig,
  createDefaultConfigFile,
  formatValidationErrors,
  SentinelConfigSchema,
  PartialSentinelConfigSchema,
  type PartialSentinelConfig,
  type ConfigValidationError,
  type LoadConfigResult,
} from './config.js';

// URL Parser exports
export {
  parseFigmaUrl,
  FigmaUrlParseError,
  type ParsedFigmaUrl,
} from './url-parser.js';

// Variables Client exports
export {
  fetchVariables,
  fetchVariablesForDirectives,
  normalizeVariable,
  normalizeVariableCollection,
  detectVariableChanges,
  generateVariableChangelogEntries,
  formatVariableValue,
  generateVariableChangelogMarkdown,
  type VariableResolvedType,
  type VariableScope,
  type VariableAlias,
  type VariableCodeSyntax,
  type VariableValue,
  type FigmaVariable,
  type VariableMode,
  type FigmaVariableCollection,
  type FigmaVariablesApiResponse,
  type FigmaVariablesDirective,
  type FetchVariablesResult,
  type FetchVariablesError,
  type NormalizedVariableSpec,
  type NormalizedVariableCollectionSpec,
  type VariableChangeDetectionResult,
  type VariableChangelogEntry,
} from './variables-client.js';
