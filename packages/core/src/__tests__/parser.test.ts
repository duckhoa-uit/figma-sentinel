/**
 * Parser module unit tests
 */

import * as path from 'path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseFile, parseDirectives, parseDirectivesSync } from '../parser.js';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('parseFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts single directive from file', () => {
    const filePath = path.join(FIXTURES_DIR, 'single-directive.tsx');
    const result = parseFile(filePath);

    expect(result).not.toBeNull();
    expect(result?.sourceFile).toBe(filePath);
    expect(result?.fileKey).toBe('ABC123DEF456');
    expect(result?.nodeIds).toEqual(['1:23']);
  });

  it('extracts multiple nodes from same file', () => {
    const filePath = path.join(FIXTURES_DIR, 'multiple-nodes.tsx');
    const result = parseFile(filePath);

    expect(result).not.toBeNull();
    expect(result?.fileKey).toBe('XYZ789ABC123');
    expect(result?.nodeIds).toHaveLength(3);
    expect(result?.nodeIds).toEqual(['10:20', '30:40', '50:60']);
  });

  it('returns null for files with no directives', () => {
    const filePath = path.join(FIXTURES_DIR, 'no-directives.tsx');
    const result = parseFile(filePath);

    expect(result).toBeNull();
  });

  it('handles malformed directives (no crash, returns null with warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filePath = path.join(FIXTURES_DIR, 'malformed-directive.tsx');
    const result = parseFile(filePath);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has @figma-node directive(s) but no @figma-file directive')
    );
  });

  it('handles multiple @figma-file directives by using first one', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filePath = path.join(FIXTURES_DIR, 'multiple-files-directive.tsx');
    const result = parseFile(filePath);

    expect(result).not.toBeNull();
    expect(result?.fileKey).toBe('FILE1ABC123');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has multiple @figma-file directives')
    );
  });

  it('parses block comment style directives', () => {
    const filePath = path.join(FIXTURES_DIR, 'block-comment-style.tsx');
    const result = parseFile(filePath);

    expect(result).not.toBeNull();
    expect(result?.fileKey).toBe('BLOCK123KEY');
    expect(result?.nodeIds).toEqual(['5:10']);
  });

  it('returns null for @figma-file without @figma-node directives', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filePath = path.join(FIXTURES_DIR, 'file-without-nodes.tsx');
    const result = parseFile(filePath);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has @figma-file directive but no @figma-node directives')
    );
  });

  it('handles non-existent file gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseFile('/non/existent/file.tsx');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not read file')
    );
  });
});

describe('parseDirectivesSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds directives in files matching pattern', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = parseDirectivesSync(
      ['**/*.tsx'],
      [],
      FIXTURES_DIR
    );

    const validDirectives = results.filter(d => d !== null);
    expect(validDirectives.length).toBeGreaterThanOrEqual(3);

    const singleDirective = validDirectives.find(d => d.fileKey === 'ABC123DEF456');
    expect(singleDirective).toBeDefined();
    expect(singleDirective?.nodeIds).toEqual(['1:23']);
  });

  it('respects file pattern filtering', () => {
    const results = parseDirectivesSync(
      ['**/single-directive.tsx'],
      [],
      FIXTURES_DIR
    );

    expect(results).toHaveLength(1);
    expect(results[0].fileKey).toBe('ABC123DEF456');
  });

  it('respects exclude patterns', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = parseDirectivesSync(
      ['**/*.tsx'],
      ['**/single-directive.tsx'],
      FIXTURES_DIR
    );

    const hasExcluded = results.some(d => d.fileKey === 'ABC123DEF456');
    expect(hasExcluded).toBe(false);
  });

  it('returns empty array when no files match pattern', () => {
    const results = parseDirectivesSync(
      ['**/*.nonexistent'],
      [],
      FIXTURES_DIR
    );

    expect(results).toEqual([]);
  });
});

describe('parseDirectives (async)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds directives in files matching pattern', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = await parseDirectives(
      ['**/*.tsx'],
      [],
      FIXTURES_DIR
    );

    const validDirectives = results.filter(d => d !== null);
    expect(validDirectives.length).toBeGreaterThanOrEqual(3);
  });

  it('respects file pattern filtering', async () => {
    const results = await parseDirectives(
      ['**/multiple-nodes.tsx'],
      [],
      FIXTURES_DIR
    );

    expect(results).toHaveLength(1);
    expect(results[0].fileKey).toBe('XYZ789ABC123');
    expect(results[0].nodeIds).toHaveLength(3);
  });
});
