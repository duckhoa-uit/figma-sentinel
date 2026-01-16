/**
 * Figma Design Sentinel - Type Definitions
 *
 * Core types for the directive-driven design synchronization system.
 */

/**
 * Represents a Figma directive extracted from source code comments.
 * Example: // @figma-file: ABC123
 *          // @figma-node: 1:23
 */
export interface FigmaDirective {
  /** Path to the source file containing the directive */
  sourceFile: string;
  /** Figma file key (extracted from @figma-file directive) */
  fileKey: string;
  /** Array of node IDs referenced in the file (from @figma-node directives) */
  nodeIds: string[];
}

/**
 * Represents a Figma node from the API response.
 * This is a subset of properties we care about for design tracking.
 */
export interface FigmaNode {
  /** Node ID in format "1:23" */
  id: string;
  /** Node name from Figma */
  name: string;
  /** Node type (e.g., FRAME, COMPONENT, COMPONENT_SET, TEXT, etc.) */
  type: string;
  /** Fill styles */
  fills?: FigmaFill[];
  /** Stroke styles */
  strokes?: FigmaStroke[];
  /** Effect styles (shadows, blurs) */
  effects?: FigmaEffect[];
  /** Typography properties (for TEXT nodes) */
  style?: FigmaTextStyle;
  /** Auto-layout properties */
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Constraints */
  constraints?: FigmaConstraints;
  /** Child nodes */
  children?: FigmaNode[];
  /** Corner radius */
  cornerRadius?: number;
  /** Individual corner radii */
  rectangleCornerRadii?: [number, number, number, number];
  /** Opacity */
  opacity?: number;
  /** Blend mode */
  blendMode?: string;
  /** Visibility */
  visible?: boolean;
  /** Component properties (for variants) */
  componentProperties?: Record<string, unknown>;
  /** For COMPONENT_SET: variant grouping */
  variantProperties?: Record<string, string>;
}

export interface FigmaFill {
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE'
    | 'EMOJI';
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: FigmaVector[];
  scaleMode?: string;
  imageRef?: string;
  blendMode?: string;
}

export interface FigmaStroke {
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE';
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  blendMode?: string;
}

export interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius?: number;
  color?: FigmaColor;
  offset?: FigmaVector;
  spread?: number;
  blendMode?: string;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaGradientStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightPercentFontSize?: number;
  lineHeightUnit?: 'PIXELS' | 'FONT_SIZE_%' | 'INTRINSIC_%';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  textDecoration?: 'NONE' | 'STRIKETHROUGH' | 'UNDERLINE';
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

/**
 * Normalized spec output that contains only visual properties.
 * Volatile properties (position, timestamps) are stripped out.
 */
export interface NormalizedSpec {
  /** Unique identifier for the spec (based on node ID) */
  id: string;
  /** Node name from Figma */
  name: string;
  /** Node type */
  type: string;
  /** Source file that references this node */
  sourceFile: string;
  /** Figma file key */
  fileKey: string;
  /** Normalized node data (volatile properties removed) */
  node: FigmaNode;
  /** Content hash for change detection */
  contentHash: string;
  /** Timestamp when spec was generated */
  generatedAt: string;
  /** For component sets: array of variant specs */
  variants?: NormalizedSpec[];
}

/**
 * Entry in the design changelog.
 */
export interface ChangelogEntry {
  /** Type of change */
  type: 'added' | 'changed' | 'removed';
  /** Node ID */
  nodeId: string;
  /** Node/component name */
  name: string;
  /** Source file path */
  sourceFile: string;
  /** For 'changed' type: list of property changes */
  propertyChanges?: PropertyChange[];
  /** For component sets: variant-specific changes */
  variantChanges?: VariantChange[];
  /** Image path for the node (if exported) */
  imagePath?: string;
  /** Previous image path (for before/after comparison) */
  previousImagePath?: string;
}

export interface PropertyChange {
  /** Property path (e.g., "fills[0].color", "style.fontSize") */
  path: string;
  /** Previous value (stringified) */
  previousValue: string;
  /** New value (stringified) */
  newValue: string;
}

export interface VariantChange {
  /** Variant name/properties */
  variantName: string;
  /** Type of change for this variant */
  type: 'added' | 'changed' | 'removed';
  /** Property changes for this variant */
  propertyChanges?: PropertyChange[];
}

/**
 * Configuration options for the Figma Sentinel.
 */
export interface SentinelConfig {
  /** Glob patterns for files to scan for directives. Defaults to src tsx and jsx files. */
  filePatterns: string[];
  /** Glob patterns for files to exclude */
  excludePatterns: string[];
  /** Directory to store design specs (default: '.design-specs') */
  specsDir: string;
  /** Whether to export images (default: true) */
  exportImages: boolean;
  /** Image export scale (default: 2) */
  imageScale: number;
  /** Output format for specs: 'json', 'markdown', or 'both' (default: 'json') */
  outputFormat: 'json' | 'markdown' | 'both';
  /** Properties to always include (allowlist) */
  includeProperties?: string[];
  /** Properties to always exclude (blocklist) */
  excludeProperties?: string[];
}

/**
 * Result of change detection.
 */
export interface ChangeDetectionResult {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Array of added node IDs */
  added: string[];
  /** Array of changed node IDs */
  changed: string[];
  /** Array of removed node IDs */
  removed: string[];
}

/**
 * Result from the Figma API nodes endpoint.
 */
export interface FigmaApiNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  nodes: Record<
    string,
    {
      document: FigmaNode;
    }
  >;
}

/**
 * Result from the Figma API images endpoint.
 */
export interface FigmaApiImagesResponse {
  err: string | null;
  images: Record<string, string>;
}

/**
 * Grouped fetch request by file key for batching.
 */
export interface FetchRequest {
  fileKey: string;
  nodeIds: string[];
  /** Map of nodeId to array of sourceFile paths */
  sourceFiles: Map<string, string[]>;
}
