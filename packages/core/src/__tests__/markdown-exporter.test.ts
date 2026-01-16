import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateMarkdownFromSpec,
  getMarkdownFilePath,
  saveMarkdownSpec,
  exportSpecAsMarkdown,
  exportSpecsAsMarkdown,
  removeMarkdownSpec,
} from '../markdown-exporter.js';
import type { NormalizedSpec, SentinelConfig, FigmaNode } from '../types.js';

describe('markdown-exporter', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join('/tmp', 'markdown-exporter-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('getMarkdownFilePath', () => {
    it('should return correct path for node ID', () => {
      const result = getMarkdownFilePath('/specs', '1:23');
      expect(result).toBe('/specs/1-23.md');
    });

    it('should sanitize node IDs with colons', () => {
      const result = getMarkdownFilePath('/specs/dir', '123:456');
      expect(result).toBe('/specs/dir/123-456.md');
    });
  });

  describe('generateMarkdownFromSpec', () => {
    const createMockSpec = (overrides: Partial<NormalizedSpec> = {}): NormalizedSpec => ({
      id: '1:23',
      name: 'Test Component',
      type: 'FRAME',
      fileKey: 'test-file-key',
      sourceFile: 'src/components/Test.tsx',
      contentHash: 'abc123',
      generatedAt: '2025-01-16T00:00:00.000Z',
      node: {
        id: '1:23',
        name: 'Test Component',
        type: 'FRAME',
      } as FigmaNode,
      ...overrides,
    });

    it('should generate basic markdown structure', () => {
      const spec = createMockSpec();
      const result = generateMarkdownFromSpec(spec);

      expect(result).toContain('# Test Component');
      expect(result).toContain('> Component type: FRAME');
      expect(result).toContain('> Source file: `src/components/Test.tsx`');
      expect(result).toContain('> Figma file: test-file-key');
      expect(result).toContain('> Node ID: 1:23');
      expect(result).toContain('*Generated at: 2025-01-16T00:00:00.000Z*');
    });

    it('should include colors from fills', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Colored Box',
          type: 'RECTANGLE',
          fills: [
            {
              type: 'SOLID',
              visible: true,
              color: { r: 1, g: 0, b: 0, a: 1 },
            },
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Colors:** #FF0000');
    });

    it('should include gradient colors', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Gradient Box',
          type: 'RECTANGLE',
          fills: [
            {
              type: 'GRADIENT_LINEAR',
              visible: true,
              gradientStops: [
                { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
                { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
              ],
            },
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('Gradient: #FF0000 → #0000FF');
    });

    it('should include typography information', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Text Node',
          type: 'TEXT',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: 600,
            lineHeightPx: 24,
            letterSpacing: 0.5,
            textAlignHorizontal: 'LEFT',
          },
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Typography:**');
      expect(result).toContain('Font: Inter');
      expect(result).toContain('Size: 16px');
      expect(result).toContain('Weight: 600');
      expect(result).toContain('Line Height: 24px');
      expect(result).toContain('Letter Spacing: 0.5px');
      expect(result).toContain('Align: left');
    });

    it('should include layout information', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Flex Container',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          itemSpacing: 16,
          paddingTop: 8,
          paddingRight: 8,
          paddingBottom: 8,
          paddingLeft: 8,
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Layout:**');
      expect(result).toContain('Layout: horizontal');
      expect(result).toContain('Gap: 16px');
      expect(result).toContain('Padding: 8px');
    });

    it('should include corner radius', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Rounded Box',
          type: 'RECTANGLE',
          cornerRadius: 8,
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Corner Radius:** 8px');
    });

    it('should include individual corner radii', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Custom Corners',
          type: 'RECTANGLE',
          rectangleCornerRadii: [4, 8, 12, 16],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Corner Radius:** 4px 8px 12px 16px');
    });

    it('should include effects', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Shadow Box',
          type: 'RECTANGLE',
          effects: [
            {
              type: 'DROP_SHADOW',
              visible: true,
              radius: 4,
              color: { r: 0, g: 0, b: 0, a: 0.25 },
              offset: { x: 0, y: 2 },
              spread: 0,
            },
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Effects:**');
      expect(result).toContain('drop shadow');
      expect(result).toContain('radius: 4px');
    });

    it('should include opacity when less than 1', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Transparent Box',
          type: 'RECTANGLE',
          opacity: 0.5,
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Opacity:** 50%');
    });

    it('should include visibility when hidden', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Hidden Box',
          type: 'RECTANGLE',
          visible: false,
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Visibility:** hidden');
    });

    it('should include children', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Parent',
          type: 'FRAME',
          children: [
            { id: '1:24', name: 'Child 1', type: 'RECTANGLE' } as FigmaNode,
            { id: '1:25', name: 'Child 2', type: 'TEXT' } as FigmaNode,
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('**Children:** 2 element(s)');
      expect(result).toContain('### Child 1 (RECTANGLE)');
      expect(result).toContain('### Child 2 (TEXT)');
    });

    it('should include variants section', () => {
      const spec = createMockSpec({
        type: 'COMPONENT_SET',
        variants: [
          {
            id: '1:30',
            name: 'Default',
            type: 'COMPONENT',
            node: { id: '1:30', name: 'Default', type: 'COMPONENT' } as FigmaNode,
          },
          {
            id: '1:31',
            name: 'Hover',
            type: 'COMPONENT',
            node: { id: '1:31', name: 'Hover', type: 'COMPONENT' } as FigmaNode,
          },
        ],
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('## Variants');
      expect(result).toContain('### Default');
      expect(result).toContain('### Hover');
    });

    it('should skip hidden fills', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Box with hidden fill',
          type: 'RECTANGLE',
          fills: [
            {
              type: 'SOLID',
              visible: false,
              color: { r: 1, g: 0, b: 0, a: 1 },
            },
            {
              type: 'SOLID',
              visible: true,
              color: { r: 0, g: 1, b: 0, a: 1 },
            },
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('#00FF00');
      expect(result).not.toContain('#FF0000');
    });

    it('should include fill opacity', () => {
      const spec = createMockSpec({
        node: {
          id: '1:23',
          name: 'Transparent fill',
          type: 'RECTANGLE',
          fills: [
            {
              type: 'SOLID',
              visible: true,
              color: { r: 0, g: 0, b: 1, a: 1 },
              opacity: 0.75,
            },
          ],
        } as FigmaNode,
      });

      const result = generateMarkdownFromSpec(spec);
      expect(result).toContain('#0000FF (75%)');
    });
  });

  describe('saveMarkdownSpec', () => {
    it('should create directory if not exists', () => {
      const specsDir = path.join(testDir, 'nested', 'specs');
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'Test',
        type: 'FRAME',
        fileKey: 'file-key',
        sourceFile: 'test.tsx',
        contentHash: 'hash',
        generatedAt: new Date().toISOString(),
        node: { id: '1:23', name: 'Test', type: 'FRAME' } as FigmaNode,
      };

      saveMarkdownSpec(specsDir, spec, '# Test Content');

      expect(fs.existsSync(specsDir)).toBe(true);
      expect(fs.existsSync(path.join(specsDir, '1-23.md'))).toBe(true);
    });

    it('should save content to file', () => {
      const spec: NormalizedSpec = {
        id: '2:45',
        name: 'Test',
        type: 'FRAME',
        fileKey: 'file-key',
        sourceFile: 'test.tsx',
        contentHash: 'hash',
        generatedAt: new Date().toISOString(),
        node: { id: '2:45', name: 'Test', type: 'FRAME' } as FigmaNode,
      };

      const content = '# My Markdown Content\n\nSome text here.';
      saveMarkdownSpec(testDir, spec, content);

      const savedContent = fs.readFileSync(path.join(testDir, '2-45.md'), 'utf-8');
      expect(savedContent).toBe(content);
    });
  });

  describe('exportSpecAsMarkdown', () => {
    it('should export spec using built-in generator', () => {
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'Test Component',
        type: 'FRAME',
        fileKey: 'file-key',
        sourceFile: 'test.tsx',
        contentHash: 'hash',
        generatedAt: new Date().toISOString(),
        node: { id: '1:23', name: 'Test Component', type: 'FRAME' } as FigmaNode,
      };

      const result = exportSpecAsMarkdown(spec, testDir, false);

      expect(result.success).toBe(true);
      expect(result.usedExtractor).toBe(false);
      expect(fs.existsSync(path.join(testDir, '1-23.md'))).toBe(true);
    });

    it('should export spec with useFigmaExtractor=true but no extractor available', () => {
      const spec: NormalizedSpec = {
        id: '3:45',
        name: 'Another Component',
        type: 'FRAME',
        fileKey: 'file-key',
        sourceFile: 'test.tsx',
        contentHash: 'hash',
        generatedAt: new Date().toISOString(),
        node: { id: '3:45', name: 'Another Component', type: 'FRAME' } as FigmaNode,
      };

      const result = exportSpecAsMarkdown(spec, testDir, true);

      expect(result.success).toBe(true);
      expect(result.usedExtractor).toBe(false);
      expect(fs.existsSync(path.join(testDir, '3-45.md'))).toBe(true);
    });
  });

  describe('exportSpecsAsMarkdown', () => {
    const createConfig = (overrides: Partial<SentinelConfig> = {}): SentinelConfig => ({
      specsDir: testDir,
      imagesDir: path.join(testDir, 'images'),
      patterns: ['**/*.tsx'],
      outputFormat: 'both',
      exportImages: false,
      figmaToken: 'test-token',
      ...overrides,
    });

    it('should skip export when outputFormat is json', () => {
      const config = createConfig({ outputFormat: 'json' });
      const specs: NormalizedSpec[] = [];

      const result = exportSpecsAsMarkdown(specs, config);

      expect(result.exported).toHaveLength(0);
      expect(result.usedExtractor).toBe(false);
      expect(result.extractorAvailable).toBe(false);
    });

    it('should export specs when outputFormat is markdown', () => {
      const config = createConfig({ outputFormat: 'markdown' });
      const specs: NormalizedSpec[] = [
        {
          id: '1:23',
          name: 'Component 1',
          type: 'FRAME',
          fileKey: 'file-key',
          sourceFile: 'test1.tsx',
          contentHash: 'hash1',
          generatedAt: new Date().toISOString(),
          node: { id: '1:23', name: 'Component 1', type: 'FRAME' } as FigmaNode,
        },
        {
          id: '1:24',
          name: 'Component 2',
          type: 'FRAME',
          fileKey: 'file-key',
          sourceFile: 'test2.tsx',
          contentHash: 'hash2',
          generatedAt: new Date().toISOString(),
          node: { id: '1:24', name: 'Component 2', type: 'FRAME' } as FigmaNode,
        },
      ];

      const result = exportSpecsAsMarkdown(specs, config);

      expect(result.exported).toEqual(['1:23', '1:24']);
      expect(result.extractorAvailable).toBe(false);
      expect(fs.existsSync(path.join(testDir, '1-23.md'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, '1-24.md'))).toBe(true);
    });

    it('should export specs when outputFormat is both', () => {
      const config = createConfig({ outputFormat: 'both' });
      const specs: NormalizedSpec[] = [
        {
          id: '2:30',
          name: 'Test',
          type: 'FRAME',
          fileKey: 'file-key',
          sourceFile: 'test.tsx',
          contentHash: 'hash',
          generatedAt: new Date().toISOString(),
          node: { id: '2:30', name: 'Test', type: 'FRAME' } as FigmaNode,
        },
      ];

      const result = exportSpecsAsMarkdown(specs, config);

      expect(result.exported).toEqual(['2:30']);
      expect(fs.existsSync(path.join(testDir, '2-30.md'))).toBe(true);
    });
  });

  describe('removeMarkdownSpec', () => {
    it('should remove existing markdown file', () => {
      const filePath = path.join(testDir, '1-23.md');
      fs.writeFileSync(filePath, '# Test', 'utf-8');

      const result = removeMarkdownSpec(testDir, '1:23');

      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should return false when file does not exist', () => {
      const result = removeMarkdownSpec(testDir, '99:99');
      expect(result).toBe(false);
    });
  });
});
