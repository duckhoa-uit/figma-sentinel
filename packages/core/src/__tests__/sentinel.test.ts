/**
 * Integration test for the full Figma Design Sentinel workflow.
 * Tests the complete flow from parsing to changelog generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runSentinel, type SentinelOptions } from '../sentinel.js';
import type { FigmaApiNodesResponse } from '../types.js';

const testTempDir = path.join(__dirname, '.test-temp-sentinel');
const testSpecsDir = path.join(testTempDir, '.design-specs');
const testSrcDir = path.join(testTempDir, 'src');
const testComponentsDir = path.join(testSrcDir, 'components');

const sampleApiResponse: FigmaApiNodesResponse = {
  name: 'Test File',
  lastModified: '2026-01-16T00:00:00Z',
  thumbnailUrl: 'https://example.com/thumb.png',
  version: '1',
  nodes: {
    '1:23': {
      document: {
        id: '1:23',
        name: 'Button',
        type: 'COMPONENT',
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.2, g: 0.4, b: 0.9, a: 1 },
          },
        ],
        strokes: [],
        effects: [],
        cornerRadius: 8,
        children: [
          {
            id: '1:24',
            name: 'Label',
            type: 'TEXT',
            characters: 'Click me',
          },
        ],
      },
    },
    '2:45': {
      document: {
        id: '2:45',
        name: 'Card',
        type: 'FRAME',
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 1, b: 1, a: 1 },
          },
        ],
        strokes: [],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.1 },
            offset: { x: 0, y: 2 },
            radius: 4,
          },
        ],
        children: [],
      },
    },
  },
};

const updatedApiResponse: FigmaApiNodesResponse = {
  ...sampleApiResponse,
  nodes: {
    '1:23': {
      document: {
        ...sampleApiResponse.nodes['1:23'].document,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.31, g: 0.27, b: 0.9, a: 1 },
          },
        ],
        cornerRadius: 12,
      },
    },
    '2:45': sampleApiResponse.nodes['2:45'],
  },
};

const originalEnv = { ...process.env };

function createTestSourceFile(
  filename: string,
  fileKey: string,
  nodeIds: string[]
): void {
  const content = `// @figma-file: ${fileKey}
${nodeIds.map((id) => `// @figma-node: ${id}`).join('\n')}

import React from 'react';

export const ${filename.replace('.tsx', '')} = () => <div>Component</div>;
`;
  fs.writeFileSync(path.join(testComponentsDir, filename), content);
}

function cleanupTestDir(): void {
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
}

function setupTestDir(): void {
  cleanupTestDir();
  fs.mkdirSync(testComponentsDir, { recursive: true });
}

function mockFetchSuccess(response: FigmaApiNodesResponse): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    } as Response)
  );
}

describe('runSentinel integration tests', () => {
  beforeEach(() => {
    setupTestDir();
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token-123' };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
    vi.restoreAllMocks();
    cleanupTestDir();
  });

  describe('full workflow from parse to changelog generation', () => {
    it('completes full workflow with valid directives and changes', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      createTestSourceFile('Card.tsx', 'ABC123', ['2:45']);
      mockFetchSuccess(sampleApiResponse);

      const options: SentinelOptions = {
        cwd: testTempDir,
      };

      const result = await runSentinel(options);

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.nodesProcessed).toBe(2);
      expect(result.apiCallCount).toBeGreaterThanOrEqual(1);
      expect(result.changeResult).toBeDefined();
      expect(result.changeResult?.added).toContain('1:23');
      expect(result.changeResult?.added).toContain('2:45');

      expect(fs.existsSync(path.join(testSpecsDir, '1-23.json'))).toBe(true);
      expect(fs.existsSync(path.join(testSpecsDir, '2-45.json'))).toBe(true);

      const changelogPath = path.join(testSpecsDir, 'DESIGN_CHANGELOG.md');
      expect(fs.existsSync(changelogPath)).toBe(true);

      const changelog = fs.readFileSync(changelogPath, 'utf-8');
      expect(changelog).toContain('Added');
      expect(changelog).toContain('Button');
      expect(changelog).toContain('Card');
    });

    it('detects changes on subsequent runs', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      createTestSourceFile('Card.tsx', 'ABC123', ['2:45']);

      mockFetchSuccess(sampleApiResponse);
      await runSentinel({ cwd: testTempDir });

      mockFetchSuccess(updatedApiResponse);
      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.changeResult?.changed).toContain('1:23');
      expect(result.changeResult?.added).toHaveLength(0);
      expect(result.changeResult?.removed).toHaveLength(0);

      const changelog = fs.readFileSync(
        path.join(testSpecsDir, 'DESIGN_CHANGELOG.md'),
        'utf-8'
      );
      expect(changelog).toContain('Changed');
      expect(changelog).toContain('Button');
    });

    it('detects removed nodes', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      createTestSourceFile('Card.tsx', 'ABC123', ['2:45']);

      mockFetchSuccess(sampleApiResponse);
      await runSentinel({ cwd: testTempDir });

      fs.unlinkSync(path.join(testComponentsDir, 'Card.tsx'));
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.changeResult?.removed).toContain('2:45');

      expect(fs.existsSync(path.join(testSpecsDir, '2-45.json'))).toBe(false);
    });
  });

  describe('initial run with empty .design-specs', () => {
    it('treats all nodes as added on first run', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess(sampleApiResponse);

      expect(fs.existsSync(testSpecsDir)).toBe(false);

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.changeResult?.added).toContain('1:23');
      expect(result.changeResult?.changed).toHaveLength(0);
      expect(result.changeResult?.removed).toHaveLength(0);

      expect(fs.existsSync(testSpecsDir)).toBe(true);
    });

    it('creates specs directory if it does not exist', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess(sampleApiResponse);

      await runSentinel({ cwd: testTempDir });

      expect(fs.existsSync(testSpecsDir)).toBe(true);
      expect(fs.statSync(testSpecsDir).isDirectory()).toBe(true);
    });
  });

  describe('no-change scenario exits silently', () => {
    it('returns hasChanges=false when no changes detected', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess(sampleApiResponse);

      await runSentinel({ cwd: testTempDir });

      mockFetchSuccess(sampleApiResponse);
      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(false);
      expect(result.changeResult?.added).toHaveLength(0);
      expect(result.changeResult?.changed).toHaveLength(0);
      expect(result.changeResult?.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('does not update changelog when no changes', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess(sampleApiResponse);

      await runSentinel({ cwd: testTempDir });

      const changelogPath = path.join(testSpecsDir, 'DESIGN_CHANGELOG.md');
      const firstMtime = fs.statSync(changelogPath).mtimeMs;

      await new Promise((resolve) => setTimeout(resolve, 100));

      mockFetchSuccess(sampleApiResponse);
      await runSentinel({ cwd: testTempDir });

      const secondMtime = fs.statSync(changelogPath).mtimeMs;
      expect(secondMtime).toBe(firstMtime);
    });
  });

  describe('dry run mode', () => {
    it('detects changes without saving specs in dry run mode', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess(sampleApiResponse);

      const result = await runSentinel({ cwd: testTempDir, dryRun: true });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.changeResult?.added).toContain('1:23');

      expect(fs.existsSync(path.join(testSpecsDir, '1-23.json'))).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles missing FIGMA_TOKEN', async () => {
      delete process.env.FIGMA_TOKEN;
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('FIGMA_TOKEN'))).toBe(true);
    });

    it('handles API errors gracefully', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        } as Response)
      );

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles network errors gracefully', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Network'))).toBe(true);
    });
  });

  describe('no directives found', () => {
    it('returns success with no changes when no directives found', async () => {
      const emptyFile = path.join(testComponentsDir, 'Empty.tsx');
      fs.writeFileSync(emptyFile, 'export const Empty = () => null;');

      mockFetchSuccess(sampleApiResponse);

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.nodesProcessed).toBe(0);
    });
  });

  describe('image export integration', () => {
    it('exports images when enabled', async () => {
      const configPath = path.join(testTempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          filePatterns: ['src/**/*.tsx'],
          exportImages: true,
        })
      );

      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/images/')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                err: null,
                images: {
                  '1:23':
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              }),
            } as Response);
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ...sampleApiResponse,
              nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
            }),
          } as Response);
        })
      );

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
    });
  });

  describe('markdown export integration', () => {
    it('exports markdown specs when outputFormat is markdown', async () => {
      const configPath = path.join(testTempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          filePatterns: ['src/**/*.tsx'],
          outputFormat: 'markdown',
          exportImages: false,
        })
      );

      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);

      expect(fs.existsSync(path.join(testSpecsDir, '1-23.md'))).toBe(true);
    });

    it('exports both json and markdown when outputFormat is both', async () => {
      const configPath = path.join(testTempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          filePatterns: ['src/**/*.tsx'],
          outputFormat: 'both',
          exportImages: false,
        })
      );

      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);

      expect(fs.existsSync(path.join(testSpecsDir, '1-23.json'))).toBe(true);
      expect(fs.existsSync(path.join(testSpecsDir, '1-23.md'))).toBe(true);
    });
  });

  describe('component variants', () => {
    it('handles COMPONENT_SET nodes with variants', async () => {
      createTestSourceFile('ButtonSet.tsx', 'ABC123', ['3:00']);

      const componentSetResponse: FigmaApiNodesResponse = {
        ...sampleApiResponse,
        nodes: {
          '3:00': {
            document: {
              id: '3:00',
              name: 'Button',
              type: 'COMPONENT_SET',
              fills: [],
              children: [
                {
                  id: '3:01',
                  name: 'State=Default',
                  type: 'COMPONENT',
                  fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9, a: 1 } }],
                },
                {
                  id: '3:02',
                  name: 'State=Hover',
                  type: 'COMPONENT',
                  fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.5, b: 1, a: 1 } }],
                },
              ],
            },
          },
        },
      };

      mockFetchSuccess(componentSetResponse);

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);

      const specPath = path.join(testSpecsDir, '3-00.json');
      expect(fs.existsSync(specPath)).toBe(true);

      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      expect(spec.type).toBe('COMPONENT_SET');
      expect(spec.variants).toHaveLength(2);
      expect(spec.variants[0].name).toBe('State=Default');
      expect(spec.variants[1].name).toBe('State=Hover');
    });
  });

  describe('multiple file keys', () => {
    it('batches API calls by file key', async () => {
      const configPath = path.join(testTempDir, '.figma-sentinelrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          filePatterns: ['src/**/*.tsx'],
          exportImages: false,
        })
      );

      createTestSourceFile('Button.tsx', 'FILE_A', ['1:23']);
      createTestSourceFile('Card.tsx', 'FILE_B', ['2:45']);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('FILE_A')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                ...sampleApiResponse,
                nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
              }),
            } as Response);
          }
          if (url.includes('FILE_B')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                ...sampleApiResponse,
                nodes: { '2:45': sampleApiResponse.nodes['2:45'] },
              }),
            } as Response);
          }
          return Promise.reject(new Error('Unexpected URL'));
        })
      );

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(result.apiCallCount).toBe(2);
      expect(result.nodesProcessed).toBe(2);
    });
  });

  describe('config loading', () => {
    it('uses default config when no config file present', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
    });

    it('loads config from figma-sentinel.config.js', async () => {
      const configPath = path.join(testTempDir, 'figma-sentinel.config.js');
      fs.writeFileSync(
        configPath,
        `module.exports = {
          filePatterns: ['src/**/*.tsx'],
          exportImages: false,
          specsDir: '.custom-specs',
        };`
      );

      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
      expect(
        fs.existsSync(path.join(testTempDir, '.custom-specs', '1-23.json'))
      ).toBe(true);
    });

    it('accepts config via options parameter', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);
      mockFetchSuccess({
        ...sampleApiResponse,
        nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
      });

      const result = await runSentinel({
        cwd: testTempDir,
        config: {
          filePatterns: ['src/**/*.tsx'],
          excludePatterns: [],
          specsDir: '.provided-specs',
          exportImages: false,
          imageScale: 2,
          outputFormat: 'json',
        },
      });

      expect(result.success).toBe(true);
      expect(
        fs.existsSync(path.join(testTempDir, '.provided-specs', '1-23.json'))
      ).toBe(true);
    });
  });

  describe('warnings and edge cases', () => {
    it('fails with missing node in response', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23', '99:99']);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            ...sampleApiResponse,
            nodes: { '1:23': sampleApiResponse.nodes['1:23'] },
          }),
        } as Response)
      );

      const result = await runSentinel({ cwd: testTempDir });

      // With fail-fast behavior, missing node throws an error
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found in file');
    });

    it('logs warning when fetch returns partial node errors', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['1:23']);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            name: 'Test File',
            lastModified: '2026-01-16T00:00:00Z',
            thumbnailUrl: '',
            version: '1',
            nodes: {
              '1:23': {
                document: {
                  id: '1:23',
                  name: 'Button',
                  type: 'COMPONENT',
                  fills: [],
                },
              },
            },
          }),
        } as Response)
      );

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(true);
    });

    it('returns success false when no nodes fetched', async () => {
      createTestSourceFile('Button.tsx', 'ABC123', ['99:99']);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            name: 'Test File',
            lastModified: '2026-01-16T00:00:00Z',
            thumbnailUrl: '',
            version: '1',
            nodes: {},
          }),
        } as Response)
      );

      const result = await runSentinel({ cwd: testTempDir });

      expect(result.success).toBe(false);
      expect(result.nodesProcessed).toBe(0);
    });
  });
});
