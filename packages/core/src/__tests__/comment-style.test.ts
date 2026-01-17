import { describe, it, expect } from 'vitest';
import { getCommentStyle, formatDirective, CommentStyle } from '../comment-style.js';

describe('getCommentStyle', () => {
  describe('C-style single-line comments (//) extensions', () => {
    const slashExtensions = ['.ts', '.tsx', '.js', '.jsx', '.swift', '.kt', '.go', '.rs'];

    it.each(slashExtensions)('returns // style for %s files', (ext) => {
      const result = getCommentStyle(`file${ext}`);
      expect(result).toEqual<CommentStyle>({
        type: 'single-line',
        prefix: '//',
      });
    });
  });

  describe('hash comment (#) extensions', () => {
    const hashExtensions = ['.py', '.rb', '.sh', '.yaml', '.yml'];

    it.each(hashExtensions)('returns # style for %s files', (ext) => {
      const result = getCommentStyle(`file${ext}`);
      expect(result).toEqual<CommentStyle>({
        type: 'single-line',
        prefix: '#',
      });
    });
  });

  describe('CSS block comment (/* */) extensions', () => {
    const cssExtensions = ['.css', '.scss', '.less'];

    it.each(cssExtensions)('returns /* */ style for %s files', (ext) => {
      const result = getCommentStyle(`file${ext}`);
      expect(result).toEqual<CommentStyle>({
        type: 'block',
        prefix: '/*',
        suffix: '*/',
      });
    });
  });

  describe('HTML comment (<!-- -->) extensions', () => {
    const htmlExtensions = ['.html', '.vue', '.svelte'];

    it.each(htmlExtensions)('returns <!-- --> style for %s files', (ext) => {
      const result = getCommentStyle(`file${ext}`);
      expect(result).toEqual<CommentStyle>({
        type: 'html',
        prefix: '<!--',
        suffix: '-->',
      });
    });
  });

  describe('unknown extensions', () => {
    it('defaults to // for unknown extensions', () => {
      const result = getCommentStyle('file.unknown');
      expect(result).toEqual<CommentStyle>({
        type: 'single-line',
        prefix: '//',
      });
    });

    it('defaults to // for files without extension', () => {
      const result = getCommentStyle('Makefile');
      expect(result).toEqual<CommentStyle>({
        type: 'single-line',
        prefix: '//',
      });
    });

    it('handles uppercase extensions', () => {
      const result = getCommentStyle('file.PY');
      expect(result).toEqual<CommentStyle>({
        type: 'single-line',
        prefix: '#',
      });
    });
  });
});

describe('formatDirective', () => {
  const fileKey = 'abc123XYZ';
  const nodeId = '1:23';

  describe('single-line comment styles', () => {
    it('formats directive for TypeScript files', () => {
      const result = formatDirective(fileKey, nodeId, 'component.tsx');
      expect(result).toBe(`// @figma-file: ${fileKey}\n// @figma-node: ${nodeId}`);
    });

    it('formats directive for Python files', () => {
      const result = formatDirective(fileKey, nodeId, 'script.py');
      expect(result).toBe(`# @figma-file: ${fileKey}\n# @figma-node: ${nodeId}`);
    });

    it('formats directive without node ID', () => {
      const result = formatDirective(fileKey, null, 'component.tsx');
      expect(result).toBe(`// @figma-file: ${fileKey}`);
    });
  });

  describe('block comment styles', () => {
    it('formats directive for CSS files', () => {
      const result = formatDirective(fileKey, nodeId, 'styles.css');
      expect(result).toBe(`/* @figma-file: ${fileKey} */\n/* @figma-node: ${nodeId} */`);
    });

    it('formats directive for SCSS files without node ID', () => {
      const result = formatDirective(fileKey, null, 'styles.scss');
      expect(result).toBe(`/* @figma-file: ${fileKey} */`);
    });
  });

  describe('HTML comment styles', () => {
    it('formats directive for HTML files', () => {
      const result = formatDirective(fileKey, nodeId, 'page.html');
      expect(result).toBe(`<!-- @figma-file: ${fileKey} -->\n<!-- @figma-node: ${nodeId} -->`);
    });

    it('formats directive for Vue files', () => {
      const result = formatDirective(fileKey, nodeId, 'Component.vue');
      expect(result).toBe(`<!-- @figma-file: ${fileKey} -->\n<!-- @figma-node: ${nodeId} -->`);
    });

    it('formats directive for Svelte files without node ID', () => {
      const result = formatDirective(fileKey, null, 'Component.svelte');
      expect(result).toBe(`<!-- @figma-file: ${fileKey} -->`);
    });
  });

  describe('path handling', () => {
    it('handles full file paths', () => {
      const result = formatDirective(fileKey, nodeId, '/src/components/Button.tsx');
      expect(result).toBe(`// @figma-file: ${fileKey}\n// @figma-node: ${nodeId}`);
    });

    it('handles relative paths', () => {
      const result = formatDirective(fileKey, nodeId, './styles/button.css');
      expect(result).toBe(`/* @figma-file: ${fileKey} */\n/* @figma-node: ${nodeId} */`);
    });
  });
});
