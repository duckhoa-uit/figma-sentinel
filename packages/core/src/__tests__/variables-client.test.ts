/**
 * Tests for Figma Variables API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchVariables,
  fetchVariablesForDirectives,
  normalizeVariable,
  normalizeVariableCollection,
  detectVariableChanges,
  generateVariableChangelogEntries,
  formatVariableValue,
  generateVariableChangelogMarkdown,
  type FigmaVariable,
  type FigmaVariableCollection,
  type NormalizedVariableSpec,
} from '../variables-client.js';

describe('variables-client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('fetchVariables', () => {
    it('throws error when FIGMA_TOKEN is not set', async () => {
      delete process.env.FIGMA_TOKEN;
      await expect(fetchVariables('test-file-key')).rejects.toThrow(
        'FIGMA_TOKEN environment variable is required',
      );
    });

    it('returns errors for 403 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        }),
      );

      const result = await fetchVariables('test-file-key');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Enterprise plan');
    });

    it('returns errors for 404 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        }),
      );

      const result = await fetchVariables('test-file-key');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('file not found');
    });

    it('successfully fetches variables', async () => {
      const mockResponse = {
        status: 200,
        error: false,
        meta: {
          variableCollections: {
            'vc1': {
              id: 'vc1',
              name: 'Colors',
              key: 'colors-key',
              modes: [{ modeId: 'm1', name: 'Light' }],
              defaultModeId: 'm1',
              remote: false,
              hiddenFromPublishing: false,
              variableIds: ['v1'],
            },
          },
          variables: {
            'v1': {
              id: 'v1',
              name: 'primary',
              key: 'primary-key',
              variableCollectionId: 'vc1',
              resolvedType: 'COLOR',
              valuesByMode: {
                'm1': { r: 0, g: 0, b: 1, a: 1 },
              },
              remote: false,
              description: 'Primary color',
              hiddenFromPublishing: false,
              scopes: ['ALL_FILLS'],
            },
          },
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const result = await fetchVariables('test-file-key');
      expect(result.errors).toHaveLength(0);
      expect(result.collections).toHaveLength(1);
      expect(result.variables).toHaveLength(1);
      expect(result.collections[0].name).toBe('Colors');
      expect(result.variables[0].name).toBe('primary');
    });

    it('filters by collection name', async () => {
      const mockResponse = {
        status: 200,
        error: false,
        meta: {
          variableCollections: {
            'vc1': {
              id: 'vc1',
              name: 'Colors',
              key: 'colors-key',
              modes: [{ modeId: 'm1', name: 'Light' }],
              defaultModeId: 'm1',
              remote: false,
              hiddenFromPublishing: false,
              variableIds: ['v1'],
            },
            'vc2': {
              id: 'vc2',
              name: 'Spacing',
              key: 'spacing-key',
              modes: [{ modeId: 'm1', name: 'Default' }],
              defaultModeId: 'm1',
              remote: false,
              hiddenFromPublishing: false,
              variableIds: ['v2'],
            },
          },
          variables: {
            'v1': {
              id: 'v1',
              name: 'primary',
              key: 'primary-key',
              variableCollectionId: 'vc1',
              resolvedType: 'COLOR',
              valuesByMode: { 'm1': { r: 0, g: 0, b: 1, a: 1 } },
              remote: false,
              description: '',
              hiddenFromPublishing: false,
              scopes: [],
            },
            'v2': {
              id: 'v2',
              name: 'small',
              key: 'small-key',
              variableCollectionId: 'vc2',
              resolvedType: 'FLOAT',
              valuesByMode: { 'm1': 8 },
              remote: false,
              description: '',
              hiddenFromPublishing: false,
              scopes: [],
            },
          },
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const result = await fetchVariables('test-file-key', ['Colors']);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0].name).toBe('Colors');
      expect(result.variables).toHaveLength(1);
    });
  });

  describe('fetchVariablesForDirectives', () => {
    it('handles empty directives array', async () => {
      const result = await fetchVariablesForDirectives([]);
      expect(result.collections).toHaveLength(0);
      expect(result.variables).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('normalizeVariable', () => {
    const mockCollection: FigmaVariableCollection = {
      id: 'vc1',
      name: 'Colors',
      key: 'colors-key',
      modes: [
        { modeId: 'm1', name: 'Light' },
        { modeId: 'm2', name: 'Dark' },
      ],
      defaultModeId: 'm1',
      remote: false,
      hiddenFromPublishing: false,
      variableIds: ['v1'],
    };

    it('normalizes a color variable', () => {
      const variable: FigmaVariable = {
        id: 'v1',
        name: 'primary',
        key: 'primary-key',
        variableCollectionId: 'vc1',
        resolvedType: 'COLOR',
        valuesByMode: {
          'm1': { r: 0, g: 0, b: 1, a: 1 },
          'm2': { r: 0.5, g: 0.5, b: 1, a: 1 },
        },
        remote: false,
        description: 'Primary brand color',
        hiddenFromPublishing: false,
        scopes: ['ALL_FILLS'],
      };

      const spec = normalizeVariable(variable, mockCollection, 'file-key', '/src/colors.ts');

      expect(spec.id).toBe('v1');
      expect(spec.name).toBe('primary');
      expect(spec.collectionName).toBe('Colors');
      expect(spec.type).toBe('COLOR');
      expect(spec.valuesByMode['Light']).toEqual({ r: 0, g: 0, b: 1, a: 1 });
      expect(spec.valuesByMode['Dark']).toEqual({ r: 0.5, g: 0.5, b: 1, a: 1 });
      expect(spec.contentHash).toHaveLength(16);
    });

    it('normalizes a number variable', () => {
      const variable: FigmaVariable = {
        id: 'v2',
        name: 'spacing-sm',
        key: 'spacing-sm-key',
        variableCollectionId: 'vc1',
        resolvedType: 'FLOAT',
        valuesByMode: { 'm1': 8 },
        remote: false,
        description: '',
        hiddenFromPublishing: false,
        scopes: ['GAP'],
      };

      const spec = normalizeVariable(variable, mockCollection, 'file-key', '/src/spacing.ts');

      expect(spec.type).toBe('FLOAT');
      expect(spec.valuesByMode['Light']).toBe(8);
    });
  });

  describe('normalizeVariableCollection', () => {
    it('normalizes a collection with variables', () => {
      const collection: FigmaVariableCollection = {
        id: 'vc1',
        name: 'Colors',
        key: 'colors-key',
        modes: [{ modeId: 'm1', name: 'Default' }],
        defaultModeId: 'm1',
        remote: false,
        hiddenFromPublishing: false,
        variableIds: ['v1'],
      };

      const variables: FigmaVariable[] = [
        {
          id: 'v1',
          name: 'primary',
          key: 'primary-key',
          variableCollectionId: 'vc1',
          resolvedType: 'COLOR',
          valuesByMode: { 'm1': { r: 1, g: 0, b: 0, a: 1 } },
          remote: false,
          description: '',
          hiddenFromPublishing: false,
          scopes: [],
        },
      ];

      const spec = normalizeVariableCollection(collection, variables, 'file-key', '/src/theme.ts');

      expect(spec.name).toBe('Colors');
      expect(spec.modes).toEqual(['Default']);
      expect(spec.defaultMode).toBe('Default');
      expect(spec.variables).toHaveLength(1);
      expect(spec.contentHash).toHaveLength(16);
    });
  });

  describe('detectVariableChanges', () => {
    const createSpec = (id: string, hash: string): NormalizedVariableSpec => ({
      id,
      name: `var-${id}`,
      collectionName: 'Test',
      collectionId: 'vc1',
      fileKey: 'fk1',
      sourceFile: '/src/test.ts',
      type: 'COLOR',
      valuesByMode: {},
      description: '',
      scopes: [],
      contentHash: hash,
      generatedAt: new Date().toISOString(),
    });

    it('detects no changes', () => {
      const specs = [createSpec('v1', 'hash1')];
      const result = detectVariableChanges(specs, specs);
      expect(result.hasChanges).toBe(false);
    });

    it('detects added variables', () => {
      const oldSpecs = [createSpec('v1', 'hash1')];
      const newSpecs = [createSpec('v1', 'hash1'), createSpec('v2', 'hash2')];
      const result = detectVariableChanges(oldSpecs, newSpecs);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toContain('v2');
      expect(result.changed).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('detects changed variables', () => {
      const oldSpecs = [createSpec('v1', 'hash1')];
      const newSpecs = [createSpec('v1', 'hash2')];
      const result = detectVariableChanges(oldSpecs, newSpecs);

      expect(result.hasChanges).toBe(true);
      expect(result.changed).toContain('v1');
    });

    it('detects removed variables', () => {
      const oldSpecs = [createSpec('v1', 'hash1'), createSpec('v2', 'hash2')];
      const newSpecs = [createSpec('v1', 'hash1')];
      const result = detectVariableChanges(oldSpecs, newSpecs);

      expect(result.hasChanges).toBe(true);
      expect(result.removed).toContain('v2');
    });
  });

  describe('formatVariableValue', () => {
    it('formats boolean values', () => {
      expect(formatVariableValue(true)).toBe('true');
      expect(formatVariableValue(false)).toBe('false');
    });

    it('formats number values', () => {
      expect(formatVariableValue(42)).toBe('42');
      expect(formatVariableValue(3.14)).toBe('3.14');
    });

    it('formats string values', () => {
      expect(formatVariableValue('hello')).toBe('hello');
    });

    it('formats color values', () => {
      const color = { r: 1, g: 0, b: 0, a: 1 };
      expect(formatVariableValue(color)).toBe('#FF0000');
    });

    it('formats color values with opacity', () => {
      const color = { r: 1, g: 0, b: 0, a: 0.5 };
      expect(formatVariableValue(color)).toBe('#FF0000 (50%)');
    });

    it('formats variable aliases', () => {
      const alias = { type: 'VARIABLE_ALIAS' as const, id: 'v123' };
      expect(formatVariableValue(alias)).toBe('→ v123');
    });

    it('formats undefined', () => {
      expect(formatVariableValue(undefined)).toBe('(undefined)');
    });
  });

  describe('generateVariableChangelogEntries', () => {
    const createSpec = (id: string, name: string, hash: string): NormalizedVariableSpec => ({
      id,
      name,
      collectionName: 'Colors',
      collectionId: 'vc1',
      fileKey: 'fk1',
      sourceFile: '/src/test.ts',
      type: 'COLOR',
      valuesByMode: { Default: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      scopes: [],
      contentHash: hash,
      generatedAt: new Date().toISOString(),
    });

    it('generates entries for added variables', () => {
      const oldSpecs: NormalizedVariableSpec[] = [];
      const newSpecs = [createSpec('v1', 'primary', 'hash1')];
      const changeResult = {
        hasChanges: true,
        added: ['v1'],
        changed: [],
        removed: [],
        addedCollections: [],
        removedCollections: [],
      };

      const entries = generateVariableChangelogEntries(oldSpecs, newSpecs, changeResult);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('added');
      expect(entries[0].name).toBe('primary');
    });

    it('generates entries for removed variables', () => {
      const oldSpecs = [createSpec('v1', 'primary', 'hash1')];
      const newSpecs: NormalizedVariableSpec[] = [];
      const changeResult = {
        hasChanges: true,
        added: [],
        changed: [],
        removed: ['v1'],
        addedCollections: [],
        removedCollections: [],
      };

      const entries = generateVariableChangelogEntries(oldSpecs, newSpecs, changeResult);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('removed');
    });
  });

  describe('generateVariableChangelogMarkdown', () => {
    it('returns empty string for no entries', () => {
      const result = generateVariableChangelogMarkdown([]);
      expect(result).toBe('');
    });

    it('generates markdown for added variables', () => {
      const entries = [
        {
          type: 'added' as const,
          variableId: 'v1',
          name: 'primary',
          collectionName: 'Colors',
          sourceFile: '/src/test.ts',
        },
      ];

      const markdown = generateVariableChangelogMarkdown(entries);
      expect(markdown).toContain('## Variable Changes');
      expect(markdown).toContain('### Added Variables');
      expect(markdown).toContain('**primary**');
      expect(markdown).toContain('`Colors`');
    });

    it('generates markdown for changed variables', () => {
      const entries = [
        {
          type: 'changed' as const,
          variableId: 'v1',
          name: 'primary',
          collectionName: 'Colors',
          sourceFile: '/src/test.ts',
          propertyChanges: [
            { path: 'valuesByMode.Default', previousValue: '#FF0000', newValue: '#00FF00' },
          ],
        },
      ];

      const markdown = generateVariableChangelogMarkdown(entries);
      expect(markdown).toContain('### Changed Variables');
      expect(markdown).toContain('`#FF0000`');
      expect(markdown).toContain('`#00FF00`');
    });

    it('generates markdown for removed variables', () => {
      const entries = [
        {
          type: 'removed' as const,
          variableId: 'v1',
          name: 'primary',
          collectionName: 'Colors',
          sourceFile: '/src/test.ts',
        },
      ];

      const markdown = generateVariableChangelogMarkdown(entries);
      expect(markdown).toContain('### Removed Variables');
      expect(markdown).toContain('~~primary~~');
    });
  });
});
