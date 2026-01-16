/**
 * Image Exporter module unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  exportImages,
  exportImagesForMultipleFiles,
  cleanupRemovedImages,
  getImagePath,
  getPreviousImagePath,
} from '../image-exporter.js';
import type { ChangeDetectionResult } from '../types.js';

const originalEnv = { ...process.env };

describe('getImagePath', () => {
  it('returns correct path for node ID', () => {
    const result = getImagePath('.design-specs', '1:23');
    expect(result).toBe(path.join('.design-specs', 'images', '1-23.png'));
  });

  it('sanitizes node IDs with colons', () => {
    const result = getImagePath('/specs', '10:20:30');
    expect(result).toBe(path.join('/specs', 'images', '10-20-30.png'));
  });
});

describe('getPreviousImagePath', () => {
  it('returns correct previous image path', () => {
    const result = getPreviousImagePath('.design-specs', '2:34');
    expect(result).toBe(path.join('.design-specs', 'images', '2-34.prev.png'));
  });
});

describe('exportImages', () => {
  const testDir = '/tmp/figma-sentinel-test-images';
  const imagesDir = path.join(testDir, 'images');

  beforeEach(() => {
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token' };
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('exports images for added nodes with mocked API', async () => {
    const mockImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com/v1/images')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              images: { '1:23': mockImageUrl },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        arrayBuffer: () =>
          Promise.resolve(
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              'base64',
            ),
          ),
      });
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0].nodeId).toBe('1:23');
    expect(result.errors).toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.figma.com/v1/images'),
      expect.any(Object),
    );
  });

  it('returns empty result for no nodes to export', async () => {
    const changeResult: ChangeDetectionResult = {
      hasChanges: false,
      added: [],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: [], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles API error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid or expired FIGMA_TOKEN');
  });

  it('handles file not found error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'badfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('file not found');
  });

  it('handles network error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Network error');
  });

  it('handles missing FIGMA_TOKEN', async () => {
    delete process.env.FIGMA_TOKEN;

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('FIGMA_TOKEN');
  });

  it('handles missing image URL in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ images: {} }),
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('No image URL returned');
  });

  it('copies current image to .prev.png for changed nodes', async () => {
    const currentImagePath = path.join(imagesDir, '2-34.png');
    fs.writeFileSync(currentImagePath, 'original image content');

    const mockImageUrl = 'https://example.com/new-image.png';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com/v1/images')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ images: { '2:34': mockImageUrl } }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('new image content')),
      });
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: [],
      changed: ['2:34'],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['2:34'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0].previousImagePath).toBeDefined();

    const prevPath = path.join(imagesDir, '2-34.prev.png');
    expect(fs.existsSync(prevPath)).toBe(true);
    expect(fs.readFileSync(prevPath, 'utf-8')).toBe('original image content');
  });

  it('handles download failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com/v1/images')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ images: { '1:23': 'https://example.com/image.png' } }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
    }));

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    const result = await exportImages(
      { fileKey: 'testfile', nodeIds: ['1:23'], changeResult },
      { specsDir: testDir },
    );

    expect(result.images).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Failed to download');
  });
});

describe('exportImagesForMultipleFiles', () => {
  const testDir = '/tmp/figma-sentinel-test-multi-images';

  beforeEach(() => {
    process.env = { ...originalEnv, FIGMA_TOKEN: 'test-token' };
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('groups nodes by file key for efficient batching', async () => {
    const fetchCalls: string[] = [];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      if (url.includes('api.figma.com/v1/images')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              images: {
                '1:23': 'https://example.com/1.png',
                '2:34': 'https://example.com/2.png',
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('image')),
      });
    }));

    const inputs = [
      { fileKey: 'file1', nodeId: '1:23' },
      { fileKey: 'file1', nodeId: '2:34' },
      { fileKey: 'file2', nodeId: '3:45' },
    ];

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23', '2:34', '3:45'],
      changed: [],
      removed: [],
    };

    await exportImagesForMultipleFiles(inputs, changeResult, { specsDir: testDir });

    const imageCalls = fetchCalls.filter((u) => u.includes('api.figma.com/v1/images'));
    expect(imageCalls.length).toBe(2);
    expect(imageCalls.some((u) => u.includes('file1'))).toBe(true);
    expect(imageCalls.some((u) => u.includes('file2'))).toBe(true);
  });

  it('deduplicates node IDs in same file', async () => {
    let callCount = 0;

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com/v1/images')) {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ images: { '1:23': 'https://example.com/1.png' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('image')),
      });
    }));

    const inputs = [
      { fileKey: 'file1', nodeId: '1:23' },
      { fileKey: 'file1', nodeId: '1:23' },
    ];

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23'],
      changed: [],
      removed: [],
    };

    await exportImagesForMultipleFiles(inputs, changeResult, { specsDir: testDir });

    expect(callCount).toBe(1);
  });

  it('aggregates results from multiple files', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com/v1/images')) {
        if (url.includes('file1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ images: { '1:23': 'https://example.com/1.png' } }),
          });
        }
        if (url.includes('file2')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ images: { '2:34': 'https://example.com/2.png' } }),
          });
        }
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('image')),
      });
    }));

    const inputs = [
      { fileKey: 'file1', nodeId: '1:23' },
      { fileKey: 'file2', nodeId: '2:34' },
    ];

    const changeResult: ChangeDetectionResult = {
      hasChanges: true,
      added: ['1:23', '2:34'],
      changed: [],
      removed: [],
    };

    const result = await exportImagesForMultipleFiles(inputs, changeResult, {
      specsDir: testDir,
    });

    expect(result.images.length).toBe(2);
    expect(result.images.some((i) => i.nodeId === '1:23')).toBe(true);
    expect(result.images.some((i) => i.nodeId === '2:34')).toBe(true);
  });
});

describe('cleanupRemovedImages', () => {
  const testDir = '/tmp/figma-sentinel-cleanup-test';
  const imagesDir = path.join(testDir, 'images');

  beforeEach(() => {
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('removes images for deleted nodes', () => {
    const imagePath = path.join(imagesDir, '1-23.png');
    const prevPath = path.join(imagesDir, '1-23.prev.png');
    fs.writeFileSync(imagePath, 'image');
    fs.writeFileSync(prevPath, 'prev image');

    cleanupRemovedImages(testDir, ['1:23']);

    expect(fs.existsSync(imagePath)).toBe(false);
    expect(fs.existsSync(prevPath)).toBe(false);
  });

  it('handles non-existent images gracefully', () => {
    expect(() => {
      cleanupRemovedImages(testDir, ['nonexistent:99']);
    }).not.toThrow();
  });

  it('removes multiple node images', () => {
    fs.writeFileSync(path.join(imagesDir, '1-23.png'), 'img1');
    fs.writeFileSync(path.join(imagesDir, '2-34.png'), 'img2');
    fs.writeFileSync(path.join(imagesDir, '3-45.png'), 'img3');

    cleanupRemovedImages(testDir, ['1:23', '2:34']);

    expect(fs.existsSync(path.join(imagesDir, '1-23.png'))).toBe(false);
    expect(fs.existsSync(path.join(imagesDir, '2-34.png'))).toBe(false);
    expect(fs.existsSync(path.join(imagesDir, '3-45.png'))).toBe(true);
  });
});
