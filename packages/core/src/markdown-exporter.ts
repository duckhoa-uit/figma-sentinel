/**
 * Figma Design Sentinel - Markdown Exporter
 *
 * Generates LLM-optimized Markdown specs from Figma nodes.
 * Optionally uses figma-extractor binary if available for enhanced output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import type { NormalizedSpec, FigmaNode, FigmaColor, SentinelConfig } from './types.js';
import { sanitizeNodeId } from './storage.js';

/**
 * Checks if figma-extractor binary is available in PATH.
 */
export function isFigmaExtractorAvailable(): boolean {
  try {
    const result = spawnSync('which', ['figma-extractor'], { encoding: 'utf-8' });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    // On Windows, try 'where' instead
    try {
      const result = spawnSync('where', ['figma-extractor'], { encoding: 'utf-8' });
      return result.status === 0 && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Gets the path for a markdown spec file.
 */
export function getMarkdownFilePath(specsDir: string, nodeId: string): string {
  return path.join(specsDir, `${sanitizeNodeId(nodeId)}.md`);
}

/**
 * Converts a Figma color to hex string.
 */
function colorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Extracts color information from fills array.
 */
function extractColors(fills: FigmaNode['fills']): string[] {
  if (!fills || !Array.isArray(fills)) {
    return [];
  }

  const colors: string[] = [];
  for (const fill of fills) {
    if (fill.visible === false) continue;
    if (fill.type === 'SOLID' && fill.color) {
      const hex = colorToHex(fill.color);
      const opacity = fill.opacity !== undefined ? ` (${Math.round(fill.opacity * 100)}%)` : '';
      colors.push(`${hex}${opacity}`);
    } else if (fill.type.startsWith('GRADIENT_') && fill.gradientStops) {
      const stops = fill.gradientStops.map((s) => colorToHex(s.color)).join(' → ');
      colors.push(`Gradient: ${stops}`);
    }
  }
  return colors;
}

/**
 * Extracts typography information from text style.
 */
function extractTypography(style: FigmaNode['style']): string | null {
  if (!style) return null;

  const parts: string[] = [];

  if (style.fontFamily) {
    parts.push(`Font: ${style.fontFamily}`);
  }
  if (style.fontSize) {
    parts.push(`Size: ${style.fontSize}px`);
  }
  if (style.fontWeight) {
    parts.push(`Weight: ${style.fontWeight}`);
  }
  if (style.lineHeightPx) {
    parts.push(`Line Height: ${style.lineHeightPx}px`);
  }
  if (style.letterSpacing) {
    parts.push(`Letter Spacing: ${style.letterSpacing}px`);
  }
  if (style.textAlignHorizontal) {
    parts.push(`Align: ${style.textAlignHorizontal.toLowerCase()}`);
  }
  if (style.textCase && style.textCase !== 'ORIGINAL') {
    parts.push(`Case: ${style.textCase.toLowerCase()}`);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Extracts layout rules from node.
 */
function extractLayoutRules(node: FigmaNode): string[] {
  const rules: string[] = [];

  if (node.layoutMode && node.layoutMode !== 'NONE') {
    rules.push(`Layout: ${node.layoutMode.toLowerCase()}`);
  }

  if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
    rules.push(`Gap: ${node.itemSpacing}px`);
  }

  const padding: string[] = [];
  if (node.paddingTop) padding.push(`top: ${node.paddingTop}px`);
  if (node.paddingRight) padding.push(`right: ${node.paddingRight}px`);
  if (node.paddingBottom) padding.push(`bottom: ${node.paddingBottom}px`);
  if (node.paddingLeft) padding.push(`left: ${node.paddingLeft}px`);

  if (padding.length > 0) {
    if (
      node.paddingTop === node.paddingBottom &&
      node.paddingLeft === node.paddingRight &&
      node.paddingTop === node.paddingLeft
    ) {
      rules.push(`Padding: ${node.paddingTop}px`);
    } else {
      rules.push(`Padding: ${padding.join(', ')}`);
    }
  }

  return rules;
}

/**
 * Extracts corner radius info.
 */
function extractCornerRadius(node: FigmaNode): string | null {
  if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    if (tl === tr && tr === br && br === bl) {
      return tl > 0 ? `${tl}px` : null;
    }
    return `${tl}px ${tr}px ${br}px ${bl}px`;
  }
  if (node.cornerRadius && node.cornerRadius > 0) {
    return `${node.cornerRadius}px`;
  }
  return null;
}

/**
 * Extracts effects (shadows, blurs).
 */
function extractEffects(effects: FigmaNode['effects']): string[] {
  if (!effects || !Array.isArray(effects)) {
    return [];
  }

  return effects
    .filter((e) => e.visible !== false)
    .map((e) => {
      const parts: string[] = [e.type.replace(/_/g, ' ').toLowerCase()];
      if (e.radius) parts.push(`radius: ${e.radius}px`);
      if (e.color) parts.push(`color: ${colorToHex(e.color)}`);
      if (e.offset) parts.push(`offset: (${e.offset.x}, ${e.offset.y})`);
      if (e.spread) parts.push(`spread: ${e.spread}px`);
      return parts.join(', ');
    });
}

/**
 * Generates Markdown content for a single node.
 */
function generateNodeMarkdown(node: FigmaNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  const heading = depth === 0 ? '##' : '###';
  lines.push(`${indent}${heading} ${node.name} (${node.type})`);
  lines.push('');

  const colors = extractColors(node.fills);
  if (colors.length > 0) {
    lines.push(`${indent}**Colors:** ${colors.join(', ')}`);
  }

  const typography = extractTypography(node.style);
  if (typography) {
    lines.push(`${indent}**Typography:** ${typography}`);
  }

  const layoutRules = extractLayoutRules(node);
  if (layoutRules.length > 0) {
    lines.push(`${indent}**Layout:** ${layoutRules.join(' | ')}`);
  }

  const cornerRadius = extractCornerRadius(node);
  if (cornerRadius) {
    lines.push(`${indent}**Corner Radius:** ${cornerRadius}`);
  }

  const effects = extractEffects(node.effects);
  if (effects.length > 0) {
    lines.push(`${indent}**Effects:** ${effects.join('; ')}`);
  }

  if (node.opacity !== undefined && node.opacity < 1) {
    lines.push(`${indent}**Opacity:** ${Math.round(node.opacity * 100)}%`);
  }

  if (node.visible === false) {
    lines.push(`${indent}**Visibility:** hidden`);
  }

  if (node.children && node.children.length > 0) {
    lines.push('');
    lines.push(`${indent}**Children:** ${node.children.length} element(s)`);
    for (const child of node.children) {
      lines.push('');
      lines.push(generateNodeMarkdown(child, depth + 1));
    }
  }

  return lines.join('\n');
}

/**
 * Generates LLM-optimized Markdown from a NormalizedSpec.
 */
export function generateMarkdownFromSpec(spec: NormalizedSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.name}`);
  lines.push('');
  lines.push(`> Component type: ${spec.type}`);
  lines.push(`> Source file: \`${spec.sourceFile}\``);
  lines.push(`> Figma file: ${spec.fileKey}`);
  lines.push(`> Node ID: ${spec.id}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push(generateNodeMarkdown(spec.node));

  if (spec.variants && spec.variants.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Variants');
    lines.push('');

    for (const variant of spec.variants) {
      lines.push(`### ${variant.name}`);
      lines.push('');
      lines.push(generateNodeMarkdown(variant.node, 0));
      lines.push('');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated at: ${spec.generatedAt}*`);

  return lines.join('\n');
}

/**
 * Attempts to generate enhanced Markdown using figma-extractor binary.
 * Returns null if binary is not available or fails.
 */
export function generateMarkdownWithExtractor(
  fileKey: string,
  nodeId: string
): string | null {
  if (!isFigmaExtractorAvailable()) {
    return null;
  }

  try {
    const result = execSync(`figma-extractor extract --file ${fileKey} --node ${nodeId} --format markdown`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    return result;
  } catch (error) {
    console.warn(`Warning: figma-extractor failed for node ${nodeId}:`, error);
    return null;
  }
}

/**
 * Saves a Markdown spec file.
 */
export function saveMarkdownSpec(specsDir: string, spec: NormalizedSpec, content: string): void {
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const filePath = getMarkdownFilePath(specsDir, spec.id);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Exports a spec as Markdown.
 * Uses figma-extractor if available, otherwise falls back to built-in generation.
 */
export function exportSpecAsMarkdown(
  spec: NormalizedSpec,
  specsDir: string,
  useFigmaExtractor: boolean = true
): { success: boolean; usedExtractor: boolean } {
  let content: string | null = null;
  let usedExtractor = false;

  if (useFigmaExtractor) {
    content = generateMarkdownWithExtractor(spec.fileKey, spec.id);
    usedExtractor = content !== null;
  }

  if (!content) {
    content = generateMarkdownFromSpec(spec);
  }

  saveMarkdownSpec(specsDir, spec, content);

  return { success: true, usedExtractor };
}

export interface MarkdownExportResult {
  exported: string[];
  usedExtractor: boolean;
  extractorAvailable: boolean;
}

/**
 * Main function to export multiple specs as Markdown.
 * Checks for figma-extractor availability once and reports status.
 */
export function exportSpecsAsMarkdown(
  specs: NormalizedSpec[],
  config: SentinelConfig
): MarkdownExportResult {
  const outputFormat = config.outputFormat;

  if (outputFormat !== 'markdown' && outputFormat !== 'both') {
    return {
      exported: [],
      usedExtractor: false,
      extractorAvailable: false,
    };
  }

  const extractorAvailable = isFigmaExtractorAvailable();

  if (!extractorAvailable) {
    console.info(
      'Info: figma-extractor binary not found in PATH. Using built-in Markdown generation. ' +
        'Install figma-extractor for enhanced output: https://github.com/nicholasjng/figma-extractor'
    );
  }

  const exported: string[] = [];
  let anyUsedExtractor = false;

  for (const spec of specs) {
    const result = exportSpecAsMarkdown(spec, config.specsDir, extractorAvailable);
    exported.push(spec.id);
    if (result.usedExtractor) {
      anyUsedExtractor = true;
    }
  }

  return {
    exported,
    usedExtractor: anyUsedExtractor,
    extractorAvailable,
  };
}

/**
 * Removes a Markdown spec file.
 */
export function removeMarkdownSpec(specsDir: string, nodeId: string): boolean {
  const filePath = getMarkdownFilePath(specsDir, nodeId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    console.warn(`Warning: Failed to remove markdown spec: ${filePath}`);
    return false;
  }
}
