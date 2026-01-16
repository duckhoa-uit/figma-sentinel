import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
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
} from '../differ.js';
import type { NormalizedSpec, ChangeDetectionResult, ChangelogEntry, FigmaColor } from '../types.js';

describe('differ', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'differ-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createSpec(overrides: Partial<NormalizedSpec> = {}): NormalizedSpec {
    return {
      id: '1:23',
      name: 'TestComponent',
      type: 'COMPONENT',
      fileKey: 'abc123',
      sourceFile: 'src/Component.tsx',
      node: {
        type: 'COMPONENT',
        name: 'TestComponent',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
      },
      contentHash: 'abc123def456',
      ...overrides,
    };
  }

  describe('diffSpecs', () => {
    it('should detect no changes for identical specs', () => {
      const spec = createSpec();
      const changes = diffSpecs(spec, spec);
      expect(changes).toHaveLength(0);
    });

    it('should detect color changes', () => {
      const oldSpec = createSpec({
        node: {
          type: 'COMPONENT',
          name: 'TestComponent',
          fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
        },
      });
      const newSpec = createSpec({
        node: {
          type: 'COMPONENT',
          name: 'TestComponent',
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
        },
      });
      const changes = diffSpecs(oldSpec, newSpec);
      expect(changes.length).toBeGreaterThan(0);
      const colorChange = changes.find((c) => c.path.includes('color'));
      expect(colorChange).toBeDefined();
    });

    it('should detect added properties', () => {
      const oldSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent' },
      });
      const newSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent', opacity: 0.5 },
      });
      const changes = diffSpecs(oldSpec, newSpec);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe('opacity');
      expect(changes[0].previousValue).toBe('undefined');
      expect(changes[0].newValue).toBe('0.5');
    });

    it('should detect removed properties', () => {
      const oldSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent', opacity: 0.5 },
      });
      const newSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent' },
      });
      const changes = diffSpecs(oldSpec, newSpec);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe('opacity');
      expect(changes[0].previousValue).toBe('0.5');
      expect(changes[0].newValue).toBe('undefined');
    });

    it('should detect array changes', () => {
      const oldSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent', fills: [{ type: 'SOLID' }] },
      });
      const newSpec = createSpec({
        node: { type: 'COMPONENT', name: 'TestComponent', fills: [{ type: 'SOLID' }, { type: 'GRADIENT_LINEAR' }] },
      });
      const changes = diffSpecs(oldSpec, newSpec);
      expect(changes.length).toBeGreaterThan(0);
    });
  });

  describe('diffVariants', () => {
    it('should detect added variants', () => {
      const oldSpec = createSpec({ type: 'COMPONENT_SET', variants: [] });
      const newSpec = createSpec({
        type: 'COMPONENT_SET',
        variants: [createSpec({ id: 'v1', name: 'Variant1' })],
      });
      const changes = diffVariants(oldSpec, newSpec);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('added');
      expect(changes[0].variantName).toBe('Variant1');
    });

    it('should detect removed variants', () => {
      const oldSpec = createSpec({
        type: 'COMPONENT_SET',
        variants: [createSpec({ id: 'v1', name: 'Variant1' })],
      });
      const newSpec = createSpec({ type: 'COMPONENT_SET', variants: [] });
      const changes = diffVariants(oldSpec, newSpec);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('removed');
      expect(changes[0].variantName).toBe('Variant1');
    });

    it('should detect changed variants', () => {
      const oldSpec = createSpec({
        type: 'COMPONENT_SET',
        variants: [createSpec({ id: 'v1', name: 'Variant1', contentHash: 'hash1' })],
      });
      const newSpec = createSpec({
        type: 'COMPONENT_SET',
        variants: [createSpec({ id: 'v1', name: 'Variant1', contentHash: 'hash2', node: { type: 'COMPONENT', name: 'Variant1', opacity: 0.5 } })],
      });
      const changes = diffVariants(oldSpec, newSpec);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('changed');
      expect(changes[0].variantName).toBe('Variant1');
    });
  });

  describe('formatValue', () => {
    it('should format null as undefined', () => {
      expect(formatValue(null)).toBe('undefined');
    });

    it('should format undefined as undefined', () => {
      expect(formatValue(undefined)).toBe('undefined');
    });

    it('should format numbers as strings', () => {
      expect(formatValue(42)).toBe('42');
    });

    it('should format strings as-is', () => {
      expect(formatValue('hello')).toBe('hello');
    });

    it('should format colors as hex', () => {
      const color = { r: 1, g: 0, b: 0, a: 1 };
      expect(formatValue(color)).toBe('#FF0000');
    });

    it('should format colors with opacity', () => {
      const color = { r: 1, g: 0, b: 0, a: 0.5 };
      expect(formatValue(color)).toBe('#FF0000 (50% opacity)');
    });

    it('should truncate long JSON strings', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 };
      const result = formatValue(obj);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('formatColor', () => {
    it('should format RGB color as hex', () => {
      const color: FigmaColor = { r: 1, g: 0.5, b: 0, a: 1 };
      expect(formatColor(color)).toBe('#FF8000');
    });

    it('should format color with opacity', () => {
      const color: FigmaColor = { r: 0, g: 0, b: 1, a: 0.75 };
      expect(formatColor(color)).toBe('#0000FF (75% opacity)');
    });

    it('should format black color', () => {
      const color: FigmaColor = { r: 0, g: 0, b: 0, a: 1 };
      expect(formatColor(color)).toBe('#000000');
    });

    it('should format white color', () => {
      const color: FigmaColor = { r: 1, g: 1, b: 1, a: 1 };
      expect(formatColor(color)).toBe('#FFFFFF');
    });
  });

  describe('formatPropertyPath', () => {
    it('should format fills path', () => {
      expect(formatPropertyPath('fills[0].color')).toBe('Fill #0 color');
    });

    it('should format strokes path', () => {
      expect(formatPropertyPath('strokes[1].color')).toBe('Stroke #1 color');
    });

    it('should format effects path', () => {
      expect(formatPropertyPath('effects[0].type')).toBe('Effect #0.type');
    });

    it('should format typography paths', () => {
      expect(formatPropertyPath('style.fontSize')).toBe('Typography font size');
      expect(formatPropertyPath('style.fontFamily')).toBe('Typography font family');
      expect(formatPropertyPath('style.fontWeight')).toBe('Typography font weight');
    });

    it('should format cornerRadius', () => {
      expect(formatPropertyPath('cornerRadius')).toBe('corner radius');
    });
  });

  describe('getRelativeImagePath', () => {
    it('should generate relative image path', () => {
      expect(getRelativeImagePath('1:23')).toBe('images/1-23.png');
    });

    it('should handle complex node IDs', () => {
      expect(getRelativeImagePath('123:456:789')).toBe('images/123-456-789.png');
    });
  });

  describe('getRelativePreviousImagePath', () => {
    it('should generate relative previous image path', () => {
      expect(getRelativePreviousImagePath('1:23')).toBe('images/1-23.prev.png');
    });
  });

  describe('attachImagePaths', () => {
    it('should attach image paths to entries', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const exportResult = {
        images: [{ nodeId: '1:23', path: '/full/path/images/1-23.png' }],
      };
      const result = attachImagePaths(entries, exportResult);
      expect(result[0].imagePath).toBe('images/1-23.png');
    });

    it('should attach previous image path if available', () => {
      const entries: ChangelogEntry[] = [
        { type: 'changed', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const exportResult = {
        images: [{ nodeId: '1:23', path: '/full/path/images/1-23.png', previousImagePath: '/full/path/images/1-23.prev.png' }],
      };
      const result = attachImagePaths(entries, exportResult);
      expect(result[0].imagePath).toBe('images/1-23.png');
      expect(result[0].previousImagePath).toBe('images/1-23.prev.png');
    });

    it('should leave entries without images unchanged', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const exportResult = { images: [] };
      const result = attachImagePaths(entries, exportResult);
      expect(result[0].imagePath).toBeUndefined();
    });
  });

  describe('generateChangelogEntries', () => {
    it('should generate entries for added nodes', () => {
      const result: ChangeDetectionResult = { added: ['1:23'], changed: [], removed: [] };
      const newSpecs = new Map<string, NormalizedSpec>([
        ['1:23', createSpec({ id: '1:23', name: 'Button' })],
      ]);
      const entries = generateChangelogEntries(tempDir, result, newSpecs, new Map());
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe('added');
      expect(entries[0].name).toBe('Button');
    });

    it('should generate entries for changed nodes', () => {
      const oldSpec = createSpec({ id: '1:23', name: 'Button', contentHash: 'old' });
      const newSpec = createSpec({ id: '1:23', name: 'Button', contentHash: 'new', node: { type: 'COMPONENT', name: 'Button', opacity: 0.5 } });
      
      const result: ChangeDetectionResult = { added: [], changed: ['1:23'], removed: [] };
      const newSpecs = new Map<string, NormalizedSpec>([['1:23', newSpec]]);
      const oldSpecs = new Map<string, NormalizedSpec>([['1:23', oldSpec]]);
      
      const entries = generateChangelogEntries(tempDir, result, newSpecs, oldSpecs);
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe('changed');
      expect(entries[0].propertyChanges?.length).toBeGreaterThan(0);
    });

    it('should generate entries for removed nodes', () => {
      const oldSpec = createSpec({ id: '1:23', name: 'Button' });
      const oldSpecs = new Map<string, NormalizedSpec>([['1:23', oldSpec]]);
      
      const result: ChangeDetectionResult = { added: [], changed: [], removed: ['1:23'] };
      const entries = generateChangelogEntries(tempDir, result, new Map(), oldSpecs);
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe('removed');
      expect(entries[0].name).toBe('Button');
    });
  });

  describe('generateChangelogMarkdown', () => {
    it('should return empty string for no entries', () => {
      const result = generateChangelogMarkdown([]);
      expect(result).toBe('');
    });

    it('should generate markdown for added entries', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const markdown = generateChangelogMarkdown(entries);
      expect(markdown).toContain('# Design Changelog');
      expect(markdown).toContain('## ✨ Added');
      expect(markdown).toContain('### Button');
      expect(markdown).toContain('src/Button.tsx');
    });

    it('should generate markdown for changed entries with property changes', () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'changed',
          nodeId: '1:23',
          name: 'Button',
          sourceFile: 'src/Button.tsx',
          propertyChanges: [{ path: 'opacity', previousValue: '1', newValue: '0.5' }],
        },
      ];
      const markdown = generateChangelogMarkdown(entries);
      expect(markdown).toContain('## 🔄 Changed');
      expect(markdown).toContain('opacity');
      expect(markdown).toContain('`1`');
      expect(markdown).toContain('`0.5`');
    });

    it('should generate markdown for removed entries', () => {
      const entries: ChangelogEntry[] = [
        { type: 'removed', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const markdown = generateChangelogMarkdown(entries);
      expect(markdown).toContain('## ⚠️ Removed');
      expect(markdown).toContain('Node Removed');
    });

    it('should include images when option is set', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx', imagePath: 'images/1-23.png' },
      ];
      const markdown = generateChangelogMarkdown(entries, { includeImages: true });
      expect(markdown).toContain('![Button](images/1-23.png)');
    });
  });

  describe('generatePRBody', () => {
    it('should generate PR body with summary table', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
        { type: 'changed', nodeId: '2:34', name: 'Card', sourceFile: 'src/Card.tsx', propertyChanges: [] },
        { type: 'removed', nodeId: '3:45', name: 'Badge', sourceFile: 'src/Badge.tsx' },
      ];
      const body = generatePRBody(entries);
      expect(body).toContain('## 🎨 Design Changes Detected');
      expect(body).toContain('### Summary');
      expect(body).toContain('| ✨ Added | 1 |');
      expect(body).toContain('| 🔄 Changed | 1 |');
      expect(body).toContain('| ⚠️ Removed | 1 |');
    });

    it('should include component details', () => {
      const entries: ChangelogEntry[] = [
        { type: 'added', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx' },
      ];
      const body = generatePRBody(entries);
      expect(body).toContain('### ✨ New Components');
      expect(body).toContain('**Button**');
      expect(body).toContain('`1:23`');
    });

    it('should use collapsible sections for changed components', () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'changed',
          nodeId: '1:23',
          name: 'Button',
          sourceFile: 'src/Button.tsx',
          propertyChanges: [{ path: 'opacity', previousValue: '1', newValue: '0.5' }],
        },
      ];
      const body = generatePRBody(entries);
      expect(body).toContain('<details>');
      expect(body).toContain('</details>');
      expect(body).toContain('<summary>');
    });

    it('should limit property changes shown', () => {
      const propertyChanges = Array.from({ length: 15 }, (_, i) => ({
        path: `property${i}`,
        previousValue: 'old',
        newValue: 'new',
      }));
      const entries: ChangelogEntry[] = [
        { type: 'changed', nodeId: '1:23', name: 'Button', sourceFile: 'src/Button.tsx', propertyChanges },
      ];
      const body = generatePRBody(entries);
      expect(body).toContain('... and 5 more changes');
    });
  });

  describe('writeChangelog', () => {
    it('should write changelog to file', () => {
      const content = '# Test Changelog\n\nSome content';
      writeChangelog(tempDir, content);
      const filePath = path.join(tempDir, 'DESIGN_CHANGELOG.md');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
    });

    it('should use custom filename', () => {
      const content = '# Test Changelog';
      writeChangelog(tempDir, content, 'CUSTOM_CHANGELOG.md');
      const filePath = path.join(tempDir, 'CUSTOM_CHANGELOG.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('generateChangelog', () => {
    it('should generate and write changelog', () => {
      const result: ChangeDetectionResult = { added: ['1:23'], changed: [], removed: [] };
      const newSpecs = new Map<string, NormalizedSpec>([
        ['1:23', createSpec({ id: '1:23', name: 'Button' })],
      ]);
      const markdown = generateChangelog(tempDir, result, newSpecs, { oldSpecs: new Map() });
      expect(markdown).toContain('# Design Changelog');
      expect(markdown).toContain('Button');
    });

    it('should return empty string when no changes', () => {
      const result: ChangeDetectionResult = { added: [], changed: [], removed: [] };
      const markdown = generateChangelog(tempDir, result, new Map(), { oldSpecs: new Map() });
      expect(markdown).toBe('');
    });
  });
});
