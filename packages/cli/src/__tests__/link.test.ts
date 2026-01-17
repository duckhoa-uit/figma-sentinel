import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { linkCommand, LinkOptions } from '../commands/link.js';

const TEST_DIR = path.join(process.cwd(), 'packages/cli/src/__tests__/fixtures');
const VALID_DESIGN_URL = 'https://www.figma.com/design/abc123XYZ/Test-File?node-id=1%3A23';
const VALID_DESIGN_URL_NO_NODE = 'https://www.figma.com/design/abc123XYZ/Test-File';
const VALID_FILE_URL = 'https://www.figma.com/file/xyz789ABC/Legacy-File?node-id=4-56';
const INVALID_URL = 'https://example.com/not-figma';
const FIGJAM_URL = 'https://www.figma.com/board/abc123/FigJam';

describe('linkCommand', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createTestFile(name: string, content: string = ''): string {
    const filePath = path.join(TEST_DIR, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  function readTestFile(name: string): string {
    return fs.readFileSync(path.join(TEST_DIR, name), 'utf-8');
  }

  describe('basic link command with URL and file', () => {
    it('links a file with valid design URL and node ID', async () => {
      const filePath = createTestFile('component.tsx', 'const Component = () => {};');
      const options: LinkOptions = { file: filePath };

      await linkCommand(VALID_DESIGN_URL, options);

      const content = readTestFile('component.tsx');
      expect(content).toContain('// @figma-file: abc123XYZ');
      expect(content).toContain('// @figma-node: 1:23');
      expect(content).toContain('const Component = () => {};');
    });

    it('links a file with legacy file URL', async () => {
      const filePath = createTestFile('legacy.tsx', 'export default {};');
      const options: LinkOptions = { file: filePath };

      await linkCommand(VALID_FILE_URL, options);

      const content = readTestFile('legacy.tsx');
      expect(content).toContain('// @figma-file: xyz789ABC');
      expect(content).toContain('// @figma-node: 4-56');
    });

    it('links a file with URL that has no node ID', async () => {
      const filePath = createTestFile('nonode.tsx', 'const x = 1;');
      const options: LinkOptions = { file: filePath };

      await linkCommand(VALID_DESIGN_URL_NO_NODE, options);

      const content = readTestFile('nonode.tsx');
      expect(content).toContain('// @figma-file: abc123XYZ');
      expect(content).not.toContain('@figma-node');
    });
  });

  describe('--path alias works same as --file', () => {
    it('links a file using --path option', async () => {
      const filePath = createTestFile('path-test.tsx', 'const y = 2;');
      const options: LinkOptions = { path: filePath };

      await linkCommand(VALID_DESIGN_URL, options);

      const content = readTestFile('path-test.tsx');
      expect(content).toContain('// @figma-file: abc123XYZ');
      expect(content).toContain('// @figma-node: 1:23');
    });

    it('combines --file and --path options', async () => {
      const file1 = createTestFile('file1.tsx', 'const a = 1;');
      const file2 = createTestFile('file2.tsx', 'const b = 2;');
      const options: LinkOptions = { file: file1, path: file2 };

      await linkCommand(VALID_DESIGN_URL, options);

      expect(readTestFile('file1.tsx')).toContain('// @figma-file: abc123XYZ');
      expect(readTestFile('file2.tsx')).toContain('// @figma-file: abc123XYZ');
    });
  });

  describe('error for non-existent file', () => {
    it('reports error for non-existent file', async () => {
      const nonExistentFile = path.join(TEST_DIR, 'does-not-exist.tsx');
      const options: LinkOptions = { file: nonExistentFile };

      await linkCommand(VALID_DESIGN_URL, options);

      // File should not be created
      expect(fs.existsSync(nonExistentFile)).toBe(false);
    });
  });

  describe('error for invalid URL', () => {
    it('exits with error for invalid URL', async () => {
      const filePath = createTestFile('invalid-url.tsx', 'const z = 3;');
      const options: LinkOptions = { file: filePath };

      await expect(linkCommand(INVALID_URL, options)).rejects.toThrow('process.exit called');
    });

    it('exits with error for FigJam URL', async () => {
      const filePath = createTestFile('figjam.tsx', 'const w = 4;');
      const options: LinkOptions = { file: filePath };

      await expect(linkCommand(FIGJAM_URL, options)).rejects.toThrow('process.exit called');
    });
  });

  describe('--yes flag skips confirmation', () => {
    it('auto-adds node when same file key with --yes flag', async () => {
      const content = `// @figma-file: abc123XYZ
// @figma-node: 9:99
const existing = true;`;
      const filePath = createTestFile('existing.tsx', content);
      const options: LinkOptions = { file: filePath, yes: true };

      await linkCommand(VALID_DESIGN_URL, options);

      const result = readTestFile('existing.tsx');
      expect(result).toContain('// @figma-node: 9:99');
      expect(result).toContain('// @figma-node: 1:23');
    });

    it('auto-replaces when different file key with --yes flag', async () => {
      const content = `// @figma-file: differentKey
// @figma-node: 5:55
const different = true;`;
      const filePath = createTestFile('different.tsx', content);
      const options: LinkOptions = { file: filePath, yes: true };

      await linkCommand(VALID_DESIGN_URL, options);

      const result = readTestFile('different.tsx');
      expect(result).toContain('// @figma-file: abc123XYZ');
      expect(result).toContain('// @figma-node: 1:23');
      expect(result).not.toContain('differentKey');
    });
  });

  describe('--force flag replaces directives', () => {
    it('replaces existing directives with --force flag', async () => {
      const content = `// @figma-file: oldKey123
// @figma-node: 1:11
// @figma-node: 2:22
const forced = true;`;
      const filePath = createTestFile('forced.tsx', content);
      const options: LinkOptions = { file: filePath, force: true };

      await linkCommand(VALID_DESIGN_URL, options);

      const result = readTestFile('forced.tsx');
      expect(result).toContain('// @figma-file: abc123XYZ');
      expect(result).toContain('// @figma-node: 1:23');
      expect(result).not.toContain('oldKey123');
      expect(result).not.toContain('1:11');
      expect(result).not.toContain('2:22');
    });
  });

  describe('batch linking with multiple files', () => {
    it('links multiple files with one command', async () => {
      const file1 = createTestFile('batch1.tsx', 'const one = 1;');
      const file2 = createTestFile('batch2.tsx', 'const two = 2;');
      const file3 = createTestFile('batch3.tsx', 'const three = 3;');
      const options: LinkOptions = { file: [file1, file2, file3] };

      await linkCommand(VALID_DESIGN_URL, options);

      expect(readTestFile('batch1.tsx')).toContain('// @figma-file: abc123XYZ');
      expect(readTestFile('batch2.tsx')).toContain('// @figma-file: abc123XYZ');
      expect(readTestFile('batch3.tsx')).toContain('// @figma-file: abc123XYZ');
    });
  });

  describe('partial batch failure continues processing', () => {
    it('continues processing remaining files when one fails', async () => {
      const file1 = createTestFile('good1.tsx', 'const good1 = 1;');
      const nonExistent = path.join(TEST_DIR, 'missing.tsx');
      const file2 = createTestFile('good2.tsx', 'const good2 = 2;');
      const options: LinkOptions = { file: [file1, nonExistent, file2] };

      await linkCommand(VALID_DESIGN_URL, options);

      expect(readTestFile('good1.tsx')).toContain('// @figma-file: abc123XYZ');
      expect(readTestFile('good2.tsx')).toContain('// @figma-file: abc123XYZ');
    });
  });

  describe('duplicate node handling', () => {
    it('skips duplicate node ID with info message', async () => {
      const content = `// @figma-file: abc123XYZ
// @figma-node: 1:23
const already = true;`;
      const filePath = createTestFile('duplicate.tsx', content);
      const options: LinkOptions = { file: filePath, yes: true };

      await linkCommand(VALID_DESIGN_URL, options);

      const result = readTestFile('duplicate.tsx');
      const nodeMatches = result.match(/@figma-node: 1:23/g);
      expect(nodeMatches).toHaveLength(1);
    });
  });

  describe('--cwd option', () => {
    it('resolves relative file paths from --cwd', async () => {
      createTestFile('cwdtest.tsx', 'const cwd = true;');
      const options: LinkOptions = { file: 'cwdtest.tsx', cwd: TEST_DIR };

      await linkCommand(VALID_DESIGN_URL, options);

      const result = readTestFile('cwdtest.tsx');
      expect(result).toContain('// @figma-file: abc123XYZ');
    });
  });

  describe('comment style by file extension', () => {
    it('uses // comments for TypeScript files', async () => {
      const filePath = createTestFile('typescript.ts', 'const ts = true;');
      await linkCommand(VALID_DESIGN_URL, { file: filePath });
      expect(readTestFile('typescript.ts')).toContain('// @figma-file:');
    });

    it('uses # comments for Python files', async () => {
      const filePath = createTestFile('python.py', 'x = True');
      await linkCommand(VALID_DESIGN_URL, { file: filePath });
      expect(readTestFile('python.py')).toContain('# @figma-file:');
    });

    it('uses /* */ comments for CSS files', async () => {
      const filePath = createTestFile('styles.css', '.class {}');
      await linkCommand(VALID_DESIGN_URL, { file: filePath });
      expect(readTestFile('styles.css')).toContain('/* @figma-file:');
    });

    it('uses <!-- --> comments for HTML files', async () => {
      const filePath = createTestFile('page.html', '<div></div>');
      await linkCommand(VALID_DESIGN_URL, { file: filePath });
      expect(readTestFile('page.html')).toContain('<!-- @figma-file:');
    });
  });
});
