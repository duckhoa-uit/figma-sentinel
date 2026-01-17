import { describe, it, expect } from 'vitest';
import { detectDirectives } from '../directive-detector.js';

describe('detectDirectives', () => {
  describe('detecting @figma-file directive', () => {
    it('detects // style file directive', () => {
      const content = '// @figma-file: abc123XYZ\n// @figma-node: 1:23\nconst x = 1;';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(true);
      expect(result.fileKey).toBe('abc123XYZ');
    });

    it('detects # style file directive', () => {
      const content = '# @figma-file: abc123XYZ\n# @figma-node: 1:23\nprint("hello")';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(true);
      expect(result.fileKey).toBe('abc123XYZ');
    });

    it('detects /* */ style file directive', () => {
      const content = '/* @figma-file: abc123XYZ */\n/* @figma-node: 1:23 */\n.class {}';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(true);
      expect(result.fileKey).toBe('abc123XYZ');
    });

    it('detects <!-- --> style file directive', () => {
      const content = '<!-- @figma-file: abc123XYZ -->\n<!-- @figma-node: 1:23 -->\n<div></div>';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(true);
      expect(result.fileKey).toBe('abc123XYZ');
    });

    it('returns false when no file directive exists', () => {
      const content = 'const x = 1;\nconst y = 2;';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(false);
      expect(result.fileKey).toBeNull();
    });
  });

  describe('detecting @figma-node directives', () => {
    it('detects single node ID with // style', () => {
      const content = '// @figma-file: abc123\n// @figma-node: 1:23\nconst x = 1;';
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23']);
    });

    it('detects multiple node IDs', () => {
      const content = `// @figma-file: abc123
// @figma-node: 1:23
// @figma-node: 4:56
// @figma-node: 7:89
const x = 1;`;
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23', '4:56', '7:89']);
    });

    it('detects node IDs with # style', () => {
      const content = '# @figma-file: abc123\n# @figma-node: 1:23\n# @figma-node: 4:56\n';
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23', '4:56']);
    });

    it('detects node IDs with /* */ style', () => {
      const content = '/* @figma-file: abc123 */\n/* @figma-node: 1:23 */\n/* @figma-node: 4:56 */';
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23', '4:56']);
    });

    it('detects node IDs with <!-- --> style', () => {
      const content =
        '<!-- @figma-file: abc123 -->\n<!-- @figma-node: 1:23 -->\n<!-- @figma-node: 4:56 -->';
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23', '4:56']);
    });

    it('returns empty array when no node directives exist', () => {
      const content = '// @figma-file: abc123\nconst x = 1;';
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual([]);
    });

    it('deduplicates node IDs', () => {
      const content = `// @figma-file: abc123
// @figma-node: 1:23
// @figma-node: 1:23
// @figma-node: 4:56
// @figma-node: 1:23`;
      const result = detectDirectives(content);
      expect(result.nodeIds).toEqual(['1:23', '4:56']);
    });
  });

  describe('edge cases', () => {
    it('handles empty content', () => {
      const result = detectDirectives('');
      expect(result.hasFileDirective).toBe(false);
      expect(result.fileKey).toBeNull();
      expect(result.nodeIds).toEqual([]);
    });

    it('handles content with no directives', () => {
      const content = `export function hello() {
  console.log("Hello, world!");
}`;
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(false);
      expect(result.fileKey).toBeNull();
      expect(result.nodeIds).toEqual([]);
    });

    it('handles directives with extra whitespace', () => {
      const content = '//   @figma-file:   abc123  \n//   @figma-node:   1:23  ';
      const result = detectDirectives(content);
      expect(result.hasFileDirective).toBe(true);
      expect(result.fileKey).toBe('abc123');
      expect(result.nodeIds).toEqual(['1:23']);
    });

    it('handles mixed comment styles in content (uses first found)', () => {
      const content = `// @figma-file: first123
/* @figma-file: second456 */
// @figma-node: 1:23`;
      const result = detectDirectives(content);
      expect(result.fileKey).toBe('first123');
      expect(result.nodeIds).toEqual(['1:23']);
    });
  });
});
