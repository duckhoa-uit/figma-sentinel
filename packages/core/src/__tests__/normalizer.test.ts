/**
 * Normalizer module unit tests
 */

import { describe, it, expect } from 'vitest';
import { normalizeNode, toStableJson, createNormalizer } from '../normalizer.js';
import type { FigmaNode } from '../types.js';

describe('normalizeNode', () => {
  it('removes volatile properties', () => {
    const node = {
      id: '1:23',
      name: 'TestFrame',
      type: 'FRAME',
      absoluteBoundingBox: { x: 100, y: 200, width: 300, height: 400 },
      absoluteRenderBounds: { x: 100, y: 200, width: 300, height: 400 },
      relativeTransform: [[1, 0, 100], [0, 1, 200]],
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
      pluginData: { somePlugin: 'data' },
      sharedPluginData: { anotherPlugin: 'more data' },
    };

    const result = normalizeNode(node);

    expect(result.id).toBe('1:23');
    expect(result.name).toBe('TestFrame');
    expect(result.fills).toEqual([{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }]);
    expect((result as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();
    expect((result as Record<string, unknown>).absoluteRenderBounds).toBeUndefined();
    expect((result as Record<string, unknown>).relativeTransform).toBeUndefined();
    expect((result as Record<string, unknown>).pluginData).toBeUndefined();
    expect((result as Record<string, unknown>).sharedPluginData).toBeUndefined();
  });

  it('preserves visual properties', () => {
    const node = {
      id: '2:34',
      name: 'Button',
      type: 'COMPONENT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
      effects: [{ type: 'DROP_SHADOW', radius: 4, color: { r: 0, g: 0, b: 0, a: 0.25 } }],
      style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 500 },
      layoutMode: 'HORIZONTAL',
      itemSpacing: 8,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      cornerRadius: 8,
      opacity: 1,
      blendMode: 'PASS_THROUGH',
      visible: true,
    };

    const result = normalizeNode(node);

    expect(result.id).toBe('2:34');
    expect(result.name).toBe('Button');
    expect(result.type).toBe('COMPONENT');
    expect(result.fills).toBeDefined();
    expect(result.strokes).toBeDefined();
    expect(result.effects).toBeDefined();
    expect(result.style).toEqual({ fontFamily: 'Inter', fontSize: 16, fontWeight: 500 });
    expect(result.layoutMode).toBe('HORIZONTAL');
    expect(result.itemSpacing).toBe(8);
    expect(result.paddingLeft).toBe(16);
    expect(result.paddingRight).toBe(16);
    expect(result.paddingTop).toBe(8);
    expect(result.paddingBottom).toBe(8);
    expect(result.cornerRadius).toBe(8);
    expect(result.opacity).toBe(1);
    expect(result.blendMode).toBe('PASS_THROUGH');
    expect(result.visible).toBe(true);
  });

  it('produces output with sorted keys for determinism', () => {
    const node1 = {
      type: 'FRAME',
      name: 'TestFrame',
      id: '3:45',
      fills: [],
      opacity: 1,
    };

    const node2 = {
      id: '3:45',
      opacity: 1,
      fills: [],
      name: 'TestFrame',
      type: 'FRAME',
    };

    const result1 = normalizeNode(node1);
    const result2 = normalizeNode(node2);

    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);

    expect(json1).toBe(json2);
    expect(Object.keys(result1)).toEqual(Object.keys(result1).sort());
  });

  it('handles nested children recursively', () => {
    const node = {
      id: '4:56',
      name: 'Parent',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        {
          id: '5:67',
          name: 'Child1',
          type: 'RECTANGLE',
          absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 },
          fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
        },
        {
          id: '6:78',
          name: 'Child2',
          type: 'TEXT',
          absoluteBoundingBox: { x: 60, y: 10, width: 30, height: 20 },
          characters: 'Hello',
          style: { fontSize: 14 },
          pluginData: { foo: 'bar' },
        },
      ],
    };

    const result = normalizeNode(node);

    expect(result.children).toHaveLength(2);
    expect((result as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();

    const child1 = result.children![0];
    expect(child1.id).toBe('5:67');
    expect(child1.fills).toBeDefined();
    expect((child1 as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();

    const child2 = result.children![1];
    expect(child2.id).toBe('6:78');
    expect((child2 as Record<string, unknown>).characters).toBe('Hello');
    expect(child2.style).toEqual({ fontSize: 14 });
    expect((child2 as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();
    expect((child2 as Record<string, unknown>).pluginData).toBeUndefined();
  });

  it('handles null and undefined values', () => {
    const node = {
      id: '7:89',
      name: 'NullTest',
      type: 'FRAME',
      fills: null,
      strokes: undefined,
    };

    const result = normalizeNode(node);

    expect(result.id).toBe('7:89');
    expect(result.fills).toBeNull();
    expect(result.strokes).toBeUndefined();
  });

  it('handles empty arrays', () => {
    const node = {
      id: '8:90',
      name: 'EmptyArrays',
      type: 'FRAME',
      fills: [],
      strokes: [],
      effects: [],
      children: [],
    };

    const result = normalizeNode(node);

    expect(result.fills).toEqual([]);
    expect(result.strokes).toEqual([]);
    expect(result.effects).toEqual([]);
    expect(result.children).toEqual([]);
  });

  it('respects custom excludeProperties config', () => {
    const node = {
      id: '9:01',
      name: 'CustomExclude',
      type: 'FRAME',
      opacity: 0.8,
      cornerRadius: 12,
      customField: 'should be excluded',
    };

    const result = normalizeNode(node, {
      excludeProperties: ['customField', 'cornerRadius'],
    });

    expect(result.id).toBe('9:01');
    expect(result.opacity).toBe(0.8);
    expect((result as Record<string, unknown>).cornerRadius).toBeUndefined();
    expect((result as Record<string, unknown>).customField).toBeUndefined();
  });

  it('respects custom includeProperties config', () => {
    const node = {
      id: '10:02',
      name: 'CustomInclude',
      type: 'FRAME',
      fills: [],
      customProperty: 'should be included',
      anotherCustom: 'not included',
    };

    const result = normalizeNode(node, {
      includeProperties: ['customProperty'],
    });

    expect(result.id).toBe('10:02');
    expect(result.name).toBe('CustomInclude');
    expect(result.fills).toEqual([]);
    expect((result as Record<string, unknown>).customProperty).toBe('should be included');
    expect((result as Record<string, unknown>).anotherCustom).toBeUndefined();
  });
});

describe('toStableJson', () => {
  it('converts node to deterministic JSON string', () => {
    const node: FigmaNode = {
      id: '11:03',
      name: 'JsonTest',
      type: 'FRAME',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }],
    };

    const json = toStableJson(node);

    expect(json).toContain('"id": "11:03"');
    expect(json).toContain('"name": "JsonTest"');
    expect(json).toContain('"type": "FRAME"');
    expect(typeof json).toBe('string');
  });

  it('sorts keys in output for determinism', () => {
    const node1: FigmaNode = {
      type: 'TEXT',
      name: 'Text1',
      id: '12:04',
    };

    const node2: FigmaNode = {
      id: '12:04',
      name: 'Text1',
      type: 'TEXT',
    };

    const json1 = toStableJson(node1);
    const json2 = toStableJson(node2);

    expect(json1).toBe(json2);
  });

  it('sorts nested object keys', () => {
    const node: FigmaNode = {
      id: '13:05',
      name: 'NestedSort',
      type: 'TEXT',
      style: {
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 400,
      },
    };

    const json = toStableJson(node);
    const parsed = JSON.parse(json);

    const styleKeys = Object.keys(parsed.style);
    expect(styleKeys).toEqual(['fontFamily', 'fontSize', 'fontWeight']);
  });
});

describe('createNormalizer', () => {
  it('creates a reusable normalizer function', () => {
    const normalize = createNormalizer();

    const node = {
      id: '14:06',
      name: 'Reusable',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fills: [],
    };

    const result = normalize(node);

    expect(result.id).toBe('14:06');
    expect((result as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();
  });

  it('applies config to all normalized nodes', () => {
    const normalize = createNormalizer({
      filePatterns: [],
      excludePatterns: [],
      specsDir: '.design-specs',
      exportImages: true,
      imageScale: 2,
      outputFormat: 'json',
      excludeProperties: ['cornerRadius'],
    });

    const node1 = {
      id: '15:07',
      name: 'Node1',
      type: 'FRAME',
      cornerRadius: 8,
      opacity: 1,
    };

    const node2 = {
      id: '16:08',
      name: 'Node2',
      type: 'FRAME',
      cornerRadius: 12,
      opacity: 0.5,
    };

    const result1 = normalize(node1);
    const result2 = normalize(node2);

    expect((result1 as Record<string, unknown>).cornerRadius).toBeUndefined();
    expect(result1.opacity).toBe(1);
    expect((result2 as Record<string, unknown>).cornerRadius).toBeUndefined();
    expect(result2.opacity).toBe(0.5);
  });

  it('applies includeProperties from config', () => {
    const normalize = createNormalizer({
      filePatterns: [],
      excludePatterns: [],
      specsDir: '.design-specs',
      exportImages: true,
      imageScale: 2,
      outputFormat: 'json',
      includeProperties: ['customProp'],
    });

    const node = {
      id: '17:09',
      name: 'IncludeTest',
      type: 'FRAME',
      customProp: 'included',
      otherProp: 'excluded',
    };

    const result = normalize(node);

    expect((result as Record<string, unknown>).customProp).toBe('included');
    expect((result as Record<string, unknown>).otherProp).toBeUndefined();
  });
});

describe('normalizeNode edge cases', () => {
  it('handles deeply nested structures', () => {
    const node = {
      id: '18:10',
      name: 'Deep',
      type: 'FRAME',
      children: [
        {
          id: '19:11',
          name: 'Level1',
          type: 'FRAME',
          children: [
            {
              id: '20:12',
              name: 'Level2',
              type: 'FRAME',
              absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
              fills: [{ type: 'SOLID' }],
            },
          ],
        },
      ],
    };

    const result = normalizeNode(node);

    expect(result.children![0].children![0].fills).toEqual([{ type: 'SOLID' }]);
    expect((result.children![0].children![0] as Record<string, unknown>).absoluteBoundingBox).toBeUndefined();
  });

  it('handles arrays of objects within properties', () => {
    const node = {
      id: '21:13',
      name: 'ArrayProps',
      type: 'FRAME',
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true },
        { type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0 }, { position: 1 }] },
      ],
    };

    const result = normalizeNode(node);

    expect(result.fills).toHaveLength(2);
    expect(result.fills![0]).toEqual({ color: { a: 1, b: 0, g: 0, r: 1 }, type: 'SOLID', visible: true });
    expect(result.fills![1]).toEqual({ gradientStops: [{ position: 0 }, { position: 1 }], type: 'GRADIENT_LINEAR' });
  });

  it('preserves characters property for TEXT nodes', () => {
    const node = {
      id: '22:14',
      name: 'TextNode',
      type: 'TEXT',
      characters: 'Hello World',
      style: { fontSize: 14 },
    };

    const result = normalizeNode(node);

    expect((result as Record<string, unknown>).characters).toBe('Hello World');
  });

  it('handles variantProperties and componentProperties', () => {
    const node = {
      id: '23:15',
      name: 'ButtonVariant',
      type: 'COMPONENT',
      variantProperties: { State: 'Default', Size: 'Medium' },
      componentProperties: { label: { type: 'TEXT', value: 'Click me' } },
    };

    const result = normalizeNode(node);

    expect(result.variantProperties).toEqual({ Size: 'Medium', State: 'Default' });
    expect(result.componentProperties).toEqual({ label: { type: 'TEXT', value: 'Click me' } });
  });
});
