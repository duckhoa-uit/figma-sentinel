/**
 * Figma Design Sentinel - Changelog Generator
 *
 * Generates human-readable changelogs from design spec differences.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  NormalizedSpec,
  ChangelogEntry,
  PropertyChange,
  VariantChange,
  ChangeDetectionResult,
  FigmaColor,
} from './types.js';
import { loadAllSpecs, sanitizeNodeId } from './storage.js';
import type { ExportedImage, ImageExportResult } from './image-exporter.js';

/**
 * Generates changelog entries from a change detection result.
 * @param specsDir - Directory containing specs (used for loading if oldSpecs not provided)
 * @param result - Change detection result with added/changed/removed node IDs
 * @param newSpecs - Map of new specs
 * @param oldSpecs - Optional map of old specs (if not provided, loads from disk)
 */
export function generateChangelogEntries(
  specsDir: string,
  result: ChangeDetectionResult,
  newSpecs: Map<string, NormalizedSpec>,
  oldSpecs?: Map<string, NormalizedSpec>
): ChangelogEntry[] {
  const existingSpecs = oldSpecs ?? loadAllSpecs(specsDir);
  const entries: ChangelogEntry[] = [];

  for (const nodeId of result.added) {
    const spec = newSpecs.get(nodeId);
    if (spec) {
      entries.push({
        type: 'added',
        nodeId,
        name: spec.name,
        sourceFile: spec.sourceFile,
      });
    }
  }

  for (const nodeId of result.changed) {
    const oldSpec = existingSpecs.get(nodeId);
    const newSpec = newSpecs.get(nodeId);
    if (oldSpec && newSpec) {
      const propertyChanges = diffSpecs(oldSpec, newSpec);

      // Get variant-specific changes for COMPONENT_SET nodes
      let variantChanges: VariantChange[] | undefined;
      if (newSpec.type === 'COMPONENT_SET' && (oldSpec.variants || newSpec.variants)) {
        variantChanges = diffVariants(oldSpec, newSpec);
      }

      entries.push({
        type: 'changed',
        nodeId,
        name: newSpec.name,
        sourceFile: newSpec.sourceFile,
        propertyChanges,
        variantChanges,
      });
    }
  }

  for (const nodeId of result.removed) {
    const spec = existingSpecs.get(nodeId);
    if (spec) {
      entries.push({
        type: 'removed',
        nodeId,
        name: spec.name,
        sourceFile: spec.sourceFile,
      });
    }
  }

  return entries;
}

/**
 * Diffs two specs and returns a list of property changes.
 */
export function diffSpecs(
  oldSpec: NormalizedSpec,
  newSpec: NormalizedSpec
): PropertyChange[] {
  const changes: PropertyChange[] = [];
  diffObjects(oldSpec.node, newSpec.node, '', changes);
  return changes;
}

/**
 * Diffs variants between two specs and returns variant-specific changes.
 */
export function diffVariants(
  oldSpec: NormalizedSpec,
  newSpec: NormalizedSpec
): VariantChange[] {
  const variantChanges: VariantChange[] = [];
  const oldVariants = new Map<string, NormalizedSpec>();
  const newVariants = new Map<string, NormalizedSpec>();

  if (oldSpec.variants) {
    for (const v of oldSpec.variants) {
      oldVariants.set(v.id, v);
    }
  }

  if (newSpec.variants) {
    for (const v of newSpec.variants) {
      newVariants.set(v.id, v);
    }
  }

  // Check for added and changed variants
  for (const [variantId, newVariant] of newVariants) {
    const oldVariant = oldVariants.get(variantId);
    if (!oldVariant) {
      variantChanges.push({
        variantName: newVariant.name,
        type: 'added',
      });
    } else if (oldVariant.contentHash !== newVariant.contentHash) {
      const propChanges: PropertyChange[] = [];
      diffObjects(oldVariant.node, newVariant.node, '', propChanges);
      variantChanges.push({
        variantName: newVariant.name,
        type: 'changed',
        propertyChanges: propChanges,
      });
    }
  }

  // Check for removed variants
  for (const [variantId, oldVariant] of oldVariants) {
    if (!newVariants.has(variantId)) {
      variantChanges.push({
        variantName: oldVariant.name,
        type: 'removed',
      });
    }
  }

  return variantChanges;
}

/**
 * Recursively diffs two objects and collects property changes.
 */
function diffObjects(
  oldObj: unknown,
  newObj: unknown,
  basePath: string,
  changes: PropertyChange[]
): void {
  if (oldObj === newObj) {
    return;
  }

  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      changes.push({
        path: basePath || 'value',
        previousValue: 'undefined',
        newValue: formatValue(newObj),
      });
    }
    return;
  }

  if (newObj === null || newObj === undefined) {
    changes.push({
      path: basePath || 'value',
      previousValue: formatValue(oldObj),
      newValue: 'undefined',
    });
    return;
  }

  if (typeof oldObj !== typeof newObj) {
    changes.push({
      path: basePath || 'value',
      previousValue: formatValue(oldObj),
      newValue: formatValue(newObj),
    });
    return;
  }

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    diffArrays(oldObj, newObj, basePath, changes);
    return;
  }

  if (typeof oldObj === 'object' && typeof newObj === 'object') {
    const oldRecord = oldObj as Record<string, unknown>;
    const newRecord = newObj as Record<string, unknown>;
    const allKeys = new Set([
      ...Object.keys(oldRecord),
      ...Object.keys(newRecord),
    ]);

    for (const key of allKeys) {
      const childPath = basePath ? `${basePath}.${key}` : key;
      diffObjects(oldRecord[key], newRecord[key], childPath, changes);
    }
    return;
  }

  if (oldObj !== newObj) {
    changes.push({
      path: basePath || 'value',
      previousValue: formatValue(oldObj),
      newValue: formatValue(newObj),
    });
  }
}

/**
 * Diffs two arrays and collects property changes.
 */
function diffArrays(
  oldArr: unknown[],
  newArr: unknown[],
  basePath: string,
  changes: PropertyChange[]
): void {
  const maxLen = Math.max(oldArr.length, newArr.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${basePath}[${i}]`;
    const oldItem = i < oldArr.length ? oldArr[i] : undefined;
    const newItem = i < newArr.length ? newArr[i] : undefined;
    diffObjects(oldItem, newItem, childPath, changes);
  }
}

/**
 * Formats a value for display in the changelog.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'object' && isColor(value)) {
    return formatColor(value as FigmaColor);
  }

  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    if (str.length > 50) {
      return str.slice(0, 47) + '...';
    }
    return str;
  }

  return String(value);
}

/**
 * Checks if an object is a Figma color.
 */
function isColor(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return (
    typeof record.r === 'number' &&
    typeof record.g === 'number' &&
    typeof record.b === 'number'
  );
}

/**
 * Formats a Figma color as a hex string.
 */
export function formatColor(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

  if (color.a !== undefined && color.a < 1) {
    return `${hex} (${Math.round(color.a * 100)}% opacity)`;
  }
  return hex;
}

/**
 * Formats a property path for human-readable display.
 */
export function formatPropertyPath(propertyPath: string): string {
  return propertyPath
    .replace(/^node\./, '')
    .replace(/\[(\d+)\]/g, ' #$1')
    .replace(/\.color$/, ' color')
    .replace(/^fills/, 'Fill')
    .replace(/^strokes/, 'Stroke')
    .replace(/^effects/, 'Effect')
    .replace(/^style\./, 'Typography ')
    .replace(/fontSize/, 'font size')
    .replace(/fontFamily/, 'font family')
    .replace(/fontWeight/, 'font weight')
    .replace(/letterSpacing/, 'letter spacing')
    .replace(/lineHeightPx/, 'line height')
    .replace(/cornerRadius/, 'corner radius')
    .replace(/itemSpacing/, 'item spacing')
    .replace(/padding/, 'padding ')
    .replace(/opacity/, 'opacity');
}

/**
 * Generates a Markdown changelog from changelog entries.
 */
export function generateChangelogMarkdown(
  entries: ChangelogEntry[],
  options: { includeImages?: boolean } = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const lines: string[] = ['# Design Changelog', ''];

  const added = entries.filter((e) => e.type === 'added');
  const changed = entries.filter((e) => e.type === 'changed');
  const removed = entries.filter((e) => e.type === 'removed');

  if (added.length > 0) {
    lines.push('## ✨ Added', '');
    const grouped = groupByComponent(added);
    for (const [name, group] of grouped) {
      lines.push(`### ${name}`, '');
      for (const entry of group) {
        lines.push(`- Source: \`${entry.sourceFile}\``);
        if (options.includeImages && entry.imagePath) {
          lines.push('', `![${name}](${entry.imagePath})`, '');
        }
      }
      lines.push('');
    }
  }

  if (changed.length > 0) {
    lines.push('## 🔄 Changed', '');
    const grouped = groupByComponent(changed);
    for (const [name, group] of grouped) {
      lines.push(`### ${name}`, '');
      for (const entry of group) {
        lines.push(`- Source: \`${entry.sourceFile}\``);

        if (entry.propertyChanges && entry.propertyChanges.length > 0) {
          lines.push('- Changes:');
          for (const change of entry.propertyChanges) {
            const formattedPath = formatPropertyPath(change.path);
            lines.push(
              `  - ${formattedPath}: \`${change.previousValue}\` → \`${change.newValue}\``
            );
          }
        }

        // Show variant-specific changes for COMPONENT_SET nodes
        if (entry.variantChanges && entry.variantChanges.length > 0) {
          lines.push('- Variant Changes:');
          for (const vc of entry.variantChanges) {
            if (vc.type === 'added') {
              lines.push(`  - **${vc.variantName}**: ✨ New variant added`);
            } else if (vc.type === 'removed') {
              lines.push(`  - **${vc.variantName}**: ⚠️ Variant removed`);
            } else if (vc.type === 'changed' && vc.propertyChanges) {
              lines.push(`  - **${vc.variantName}**:`);
              for (const pc of vc.propertyChanges) {
                const formattedPath = formatPropertyPath(pc.path);
                lines.push(
                  `    - ${formattedPath}: \`${pc.previousValue}\` → \`${pc.newValue}\``
                );
              }
            }
          }
        }

        if (options.includeImages) {
          if (entry.previousImagePath && entry.imagePath) {
            lines.push('', '| Before | After |');
            lines.push('|--------|-------|');
            lines.push(
              `| ![Before](${entry.previousImagePath}) | ![After](${entry.imagePath}) |`
            );
            lines.push('');
          } else if (entry.imagePath) {
            lines.push('', `![${name}](${entry.imagePath})`, '');
          }
        }
      }
      lines.push('');
    }
  }

  if (removed.length > 0) {
    lines.push('## ⚠️ Removed', '');
    const grouped = groupByComponent(removed);
    for (const [name, group] of grouped) {
      lines.push(`### ${name}`, '');
      for (const entry of group) {
        lines.push(`- Source: \`${entry.sourceFile}\``);
        lines.push('- ⚠️ Node Removed - Figma node no longer exists');
        if (options.includeImages) {
          lines.push('- 📷 *No image available - node was deleted*');
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Groups changelog entries by component name.
 */
function groupByComponent(
  entries: ChangelogEntry[]
): Map<string, ChangelogEntry[]> {
  const grouped = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const name = entry.name;
    if (!grouped.has(name)) {
      grouped.set(name, []);
    }
    grouped.get(name)!.push(entry);
  }

  return grouped;
}

/**
 * Gets the relative image path for a node ID.
 * Uses format: images/<sanitized-nodeId>.png
 */
export function getRelativeImagePath(nodeId: string): string {
  return `images/${sanitizeNodeId(nodeId)}.png`;
}

/**
 * Gets the relative previous image path for a node ID.
 * Uses format: images/<sanitized-nodeId>.prev.png
 */
export function getRelativePreviousImagePath(nodeId: string): string {
  return `images/${sanitizeNodeId(nodeId)}.prev.png`;
}

/**
 * Attaches image paths to changelog entries from export results.
 * Uses relative paths for markdown embedding (e.g., images/1-23.png).
 */
export function attachImagePaths(
  entries: ChangelogEntry[],
  exportResult: ImageExportResult
): ChangelogEntry[] {
  const imageMap = new Map<string, ExportedImage>();
  for (const image of exportResult.images) {
    imageMap.set(image.nodeId, image);
  }

  return entries.map((entry) => {
    const exported = imageMap.get(entry.nodeId);
    if (!exported) {
      return entry;
    }

    return {
      ...entry,
      imagePath: getRelativeImagePath(entry.nodeId),
      previousImagePath: exported.previousImagePath
        ? getRelativePreviousImagePath(entry.nodeId)
        : undefined,
    };
  });
}

/**
 * Writes the changelog to a file.
 */
export function writeChangelog(
  specsDir: string,
  content: string,
  filename: string = 'DESIGN_CHANGELOG.md'
): void {
  const filePath = path.join(specsDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Main entry point for generating a changelog.
 */
export function generateChangelog(
  specsDir: string,
  result: ChangeDetectionResult,
  newSpecs: Map<string, NormalizedSpec>,
  options: { includeImages?: boolean; outputPath?: string; oldSpecs?: Map<string, NormalizedSpec> } = {}
): string {
  const entries = generateChangelogEntries(specsDir, result, newSpecs, options.oldSpecs);
  const markdown = generateChangelogMarkdown(entries, {
    includeImages: options.includeImages,
  });

  if (markdown && options.outputPath !== null) {
    writeChangelog(specsDir, markdown, options.outputPath);
  }

  return markdown;
}

/**
 * Generates a PR body with dynamic content listing tracked nodes and their changes.
 */
export function generatePRBody(entries: ChangelogEntry[]): string {
  const lines: string[] = [
    '## 🎨 Design Changes Detected',
    '',
    'This PR was automatically created by the **Figma Design Sentinel**.',
    '',
  ];

  const added = entries.filter(e => e.type === 'added');
  const changed = entries.filter(e => e.type === 'changed');
  const removed = entries.filter(e => e.type === 'removed');

  // Summary counts
  lines.push('### Summary');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|------|-------|');
  lines.push(`| ✨ Added | ${added.length} |`);
  lines.push(`| 🔄 Changed | ${changed.length} |`);
  lines.push(`| ⚠️ Removed | ${removed.length} |`);
  lines.push('');

  // Added nodes
  if (added.length > 0) {
    lines.push('### ✨ New Components');
    lines.push('');
    for (const entry of added) {
      lines.push(`- **${entry.name}** (\`${entry.nodeId}\`)`);
      lines.push(`  - Source: \`${entry.sourceFile}\``);
    }
    lines.push('');
  }

  // Changed nodes with property details
  if (changed.length > 0) {
    lines.push('### 🔄 Modified Components');
    lines.push('');
    for (const entry of changed) {
      lines.push('<details>');
      lines.push(`<summary><b>${entry.name}</b> (<code>${entry.nodeId}</code>)</summary>`);
      lines.push('');
      lines.push(`- Source: \`${entry.sourceFile}\``);

      if (entry.propertyChanges && entry.propertyChanges.length > 0) {
        lines.push('- **Property Changes:**');
        const maxChangesToShow = 10;
        const changesToShow = entry.propertyChanges.slice(0, maxChangesToShow);
        for (const change of changesToShow) {
          const formattedPath = formatPropertyPath(change.path);
          lines.push(`  - ${formattedPath}: \`${change.previousValue}\` → \`${change.newValue}\``);
        }
        if (entry.propertyChanges.length > maxChangesToShow) {
          lines.push(`  - ... and ${entry.propertyChanges.length - maxChangesToShow} more changes`);
        }
      }

      if (entry.variantChanges && entry.variantChanges.length > 0) {
        lines.push('- **Variant Changes:**');
        for (const vc of entry.variantChanges) {
          if (vc.type === 'added') {
            lines.push(`  - ✨ **${vc.variantName}**: New variant`);
          } else if (vc.type === 'removed') {
            lines.push(`  - ⚠️ **${vc.variantName}**: Removed`);
          } else if (vc.type === 'changed') {
            lines.push(`  - 🔄 **${vc.variantName}**: Modified`);
          }
        }
      }

      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  // Removed nodes
  if (removed.length > 0) {
    lines.push('### ⚠️ Removed Components');
    lines.push('');
    for (const entry of removed) {
      lines.push(`- **${entry.name}** (\`${entry.nodeId}\`)`);
      lines.push(`  - Was in: \`${entry.sourceFile}\``);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('📋 See `DESIGN_CHANGELOG.md` for full details with before/after images.');
  lines.push('');
  lines.push('> ⚠️ **Note**: This PR was auto-generated. Please review the changes carefully before merging.');

  return lines.join('\n');
}
