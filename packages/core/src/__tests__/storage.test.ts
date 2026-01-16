import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  sanitizeNodeId,
  getSpecFilePath,
  computeContentHash,
  loadSpec,
  loadAllSpecs,
  saveSpec,
  removeSpec,
  createNormalizedSpec,
  detectChanges,
  saveAndDetectChanges,
  getPreviousSpec,
} from '../storage.js';
import type { FigmaNode, NormalizedSpec } from '../types.js';

describe('storage', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-sentinel-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('sanitizeNodeId', () => {
    it('replaces colons with dashes', () => {
      expect(sanitizeNodeId('1:23')).toBe('1-23');
      expect(sanitizeNodeId('123:456:789')).toBe('123-456-789');
    });

    it('leaves IDs without colons unchanged', () => {
      expect(sanitizeNodeId('12345')).toBe('12345');
    });
  });

  describe('getSpecFilePath', () => {
    it('returns correct path with sanitized node ID', () => {
      const result = getSpecFilePath('/specs', '1:23');
      expect(result).toBe('/specs/1-23.json');
    });
  });

  describe('computeContentHash', () => {
    it('returns a 16 character hex string', () => {
      const hash = computeContentHash('test content');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('returns same hash for same content', () => {
      const hash1 = computeContentHash('identical content');
      const hash2 = computeContentHash('identical content');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different content', () => {
      const hash1 = computeContentHash('content A');
      const hash2 = computeContentHash('content B');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('saveSpec', () => {
    it('creates directory if it does not exist', () => {
      const specsDir = path.join(tempDir, 'nested', 'specs');
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'TestComponent',
        type: 'COMPONENT',
        sourceFile: 'src/Component.tsx',
        fileKey: 'ABC123',
        node: { id: '1:23', name: 'TestComponent', type: 'COMPONENT' },
        contentHash: 'abc123',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      saveSpec(specsDir, spec);

      expect(fs.existsSync(specsDir)).toBe(true);
      expect(fs.existsSync(path.join(specsDir, '1-23.json'))).toBe(true);
    });

    it('writes spec as JSON with formatting', () => {
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'TestComponent',
        type: 'COMPONENT',
        sourceFile: 'src/Component.tsx',
        fileKey: 'ABC123',
        node: { id: '1:23', name: 'TestComponent', type: 'COMPONENT' },
        contentHash: 'abc123',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      saveSpec(tempDir, spec);

      const content = fs.readFileSync(path.join(tempDir, '1-23.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(spec);
      expect(content).toContain('\n'); // Formatted with newlines
    });
  });

  describe('loadSpec', () => {
    it('returns null if spec does not exist', () => {
      const result = loadSpec(tempDir, '1:23');
      expect(result).toBeNull();
    });

    it('returns null if directory does not exist', () => {
      const result = loadSpec('/nonexistent/dir', '1:23');
      expect(result).toBeNull();
    });

    it('returns spec if it exists', () => {
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'TestComponent',
        type: 'COMPONENT',
        sourceFile: 'src/Component.tsx',
        fileKey: 'ABC123',
        node: { id: '1:23', name: 'TestComponent', type: 'COMPONENT' },
        contentHash: 'abc123',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-23.json'),
        JSON.stringify(spec),
        'utf-8'
      );

      const result = loadSpec(tempDir, '1:23');
      expect(result).toEqual(spec);
    });

    it('returns null and warns on invalid JSON', () => {
      fs.writeFileSync(path.join(tempDir, '1-23.json'), 'invalid json', 'utf-8');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSpec(tempDir, '1:23');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Failed to read spec file')
      );
      warnSpy.mockRestore();
    });
  });

  describe('loadAllSpecs', () => {
    it('returns empty map if directory does not exist', () => {
      const result = loadAllSpecs('/nonexistent/dir');
      expect(result.size).toBe(0);
    });

    it('returns empty map if directory is empty', () => {
      const result = loadAllSpecs(tempDir);
      expect(result.size).toBe(0);
    });

    it('loads all JSON files in directory', () => {
      const spec1: NormalizedSpec = {
        id: '1:1',
        name: 'Component1',
        type: 'COMPONENT',
        sourceFile: 'src/C1.tsx',
        fileKey: 'ABC123',
        node: { id: '1:1', name: 'Component1', type: 'COMPONENT' },
        contentHash: 'hash1',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };
      const spec2: NormalizedSpec = {
        id: '2:2',
        name: 'Component2',
        type: 'FRAME',
        sourceFile: 'src/C2.tsx',
        fileKey: 'DEF456',
        node: { id: '2:2', name: 'Component2', type: 'FRAME' },
        contentHash: 'hash2',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-1.json'),
        JSON.stringify(spec1),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tempDir, '2-2.json'),
        JSON.stringify(spec2),
        'utf-8'
      );

      const result = loadAllSpecs(tempDir);

      expect(result.size).toBe(2);
      expect(result.get('1:1')).toEqual(spec1);
      expect(result.get('2:2')).toEqual(spec2);
    });

    it('ignores non-JSON files', () => {
      fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'not a spec', 'utf-8');

      const result = loadAllSpecs(tempDir);
      expect(result.size).toBe(0);
    });
  });

  describe('removeSpec', () => {
    it('returns false if spec does not exist', () => {
      const result = removeSpec(tempDir, '1:23');
      expect(result).toBe(false);
    });

    it('removes spec and returns true', () => {
      const filePath = path.join(tempDir, '1-23.json');
      fs.writeFileSync(filePath, '{}', 'utf-8');

      const result = removeSpec(tempDir, '1:23');

      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('createNormalizedSpec', () => {
    it('creates spec with content hash', () => {
      const node: FigmaNode = {
        id: '1:23',
        name: 'TestComponent',
        type: 'COMPONENT',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
      };

      const spec = createNormalizedSpec(node, 'src/Test.tsx', 'ABC123');

      expect(spec.id).toBe('1:23');
      expect(spec.name).toBe('TestComponent');
      expect(spec.type).toBe('COMPONENT');
      expect(spec.sourceFile).toBe('src/Test.tsx');
      expect(spec.fileKey).toBe('ABC123');
      expect(spec.contentHash).toHaveLength(16);
      expect(spec.generatedAt).toBeDefined();
      expect(spec.node).toBeDefined();
    });

    it('includes variants for COMPONENT_SET', () => {
      const node: FigmaNode = {
        id: '1:1',
        name: 'ButtonSet',
        type: 'COMPONENT_SET',
        children: [
          { id: '1:2', name: 'State=Default', type: 'COMPONENT' },
          { id: '1:3', name: 'State=Hover', type: 'COMPONENT' },
        ],
      };

      const spec = createNormalizedSpec(node, 'src/Button.tsx', 'ABC123');

      expect(spec.variants).toBeDefined();
      expect(spec.variants).toHaveLength(2);
      expect(spec.variants![0].id).toBe('1:2');
      expect(spec.variants![1].id).toBe('1:3');
    });

    it('does not include variants for non-COMPONENT_SET', () => {
      const node: FigmaNode = {
        id: '1:1',
        name: 'Frame',
        type: 'FRAME',
        children: [
          { id: '1:2', name: 'Child', type: 'RECTANGLE' },
        ],
      };

      const spec = createNormalizedSpec(node, 'src/Test.tsx', 'ABC123');

      expect(spec.variants).toBeUndefined();
    });
  });

  describe('detectChanges', () => {
    it('detects added specs', () => {
      const newSpecs: NormalizedSpec[] = [
        {
          id: '1:1',
          name: 'Component1',
          type: 'COMPONENT',
          sourceFile: 'src/C1.tsx',
          fileKey: 'ABC123',
          node: { id: '1:1', name: 'Component1', type: 'COMPONENT' },
          contentHash: 'hash1',
          generatedAt: '2025-01-01T00:00:00.000Z',
        },
      ];

      const result = detectChanges(tempDir, newSpecs);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(['1:1']);
      expect(result.changed).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('detects changed specs', () => {
      const existingSpec: NormalizedSpec = {
        id: '1:1',
        name: 'Component1',
        type: 'COMPONENT',
        sourceFile: 'src/C1.tsx',
        fileKey: 'ABC123',
        node: { id: '1:1', name: 'Component1', type: 'COMPONENT' },
        contentHash: 'oldhash',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-1.json'),
        JSON.stringify(existingSpec),
        'utf-8'
      );

      const newSpecs: NormalizedSpec[] = [
        { ...existingSpec, contentHash: 'newhash' },
      ];

      const result = detectChanges(tempDir, newSpecs);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual([]);
      expect(result.changed).toEqual(['1:1']);
      expect(result.removed).toEqual([]);
    });

    it('detects removed specs', () => {
      const existingSpec: NormalizedSpec = {
        id: '1:1',
        name: 'Component1',
        type: 'COMPONENT',
        sourceFile: 'src/C1.tsx',
        fileKey: 'ABC123',
        node: { id: '1:1', name: 'Component1', type: 'COMPONENT' },
        contentHash: 'hash1',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-1.json'),
        JSON.stringify(existingSpec),
        'utf-8'
      );

      const result = detectChanges(tempDir, []);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual([]);
      expect(result.changed).toEqual([]);
      expect(result.removed).toEqual(['1:1']);
    });

    it('returns hasChanges false when no changes', () => {
      const existingSpec: NormalizedSpec = {
        id: '1:1',
        name: 'Component1',
        type: 'COMPONENT',
        sourceFile: 'src/C1.tsx',
        fileKey: 'ABC123',
        node: { id: '1:1', name: 'Component1', type: 'COMPONENT' },
        contentHash: 'hash1',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-1.json'),
        JSON.stringify(existingSpec),
        'utf-8'
      );

      const result = detectChanges(tempDir, [existingSpec]);

      expect(result.hasChanges).toBe(false);
      expect(result.added).toEqual([]);
      expect(result.changed).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });

  describe('saveAndDetectChanges', () => {
    it('saves new specs and detects them as added', () => {
      const inputs = [
        {
          node: { id: '1:1', name: 'Component', type: 'COMPONENT' } as FigmaNode,
          sourceFile: 'src/Test.tsx',
          fileKey: 'ABC123',
        },
      ];

      const result = saveAndDetectChanges(tempDir, inputs);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(['1:1']);
      expect(fs.existsSync(path.join(tempDir, '1-1.json'))).toBe(true);
    });

    it('removes specs that are no longer present', () => {
      const oldSpec: NormalizedSpec = {
        id: '1:2',
        name: 'OldComponent',
        type: 'COMPONENT',
        sourceFile: 'src/Old.tsx',
        fileKey: 'ABC123',
        node: { id: '1:2', name: 'OldComponent', type: 'COMPONENT' },
        contentHash: 'hash',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-2.json'),
        JSON.stringify(oldSpec),
        'utf-8'
      );

      const inputs = [
        {
          node: { id: '1:1', name: 'NewComponent', type: 'COMPONENT' } as FigmaNode,
          sourceFile: 'src/New.tsx',
          fileKey: 'ABC123',
        },
      ];

      const result = saveAndDetectChanges(tempDir, inputs);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(['1:1']);
      expect(result.removed).toEqual(['1:2']);
      expect(fs.existsSync(path.join(tempDir, '1-1.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '1-2.json'))).toBe(false);
    });
  });

  describe('getPreviousSpec', () => {
    it('returns null if no previous spec', () => {
      const result = getPreviousSpec(tempDir, '1:23');
      expect(result).toBeNull();
    });

    it('returns previous spec if exists', () => {
      const spec: NormalizedSpec = {
        id: '1:23',
        name: 'TestComponent',
        type: 'COMPONENT',
        sourceFile: 'src/Test.tsx',
        fileKey: 'ABC123',
        node: { id: '1:23', name: 'TestComponent', type: 'COMPONENT' },
        contentHash: 'abc123',
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempDir, '1-23.json'),
        JSON.stringify(spec),
        'utf-8'
      );

      const result = getPreviousSpec(tempDir, '1:23');
      expect(result).toEqual(spec);
    });
  });
});
