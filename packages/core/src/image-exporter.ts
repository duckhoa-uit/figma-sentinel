/**
 * Figma Image Exporter
 *
 * Exports visual previews of Figma nodes as PNG images for PR display.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  FigmaApiImagesResponse,
  ChangeDetectionResult,
  SentinelConfig,
} from './types.js';
import { sanitizeNodeId } from './storage.js';

const FIGMA_API_BASE = 'https://api.figma.com';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const DEFAULT_IMAGE_SCALE = 2;
const DEFAULT_SPECS_DIR = '.design-specs';

export interface ExportedImage {
  nodeId: string;
  imagePath: string;
  previousImagePath?: string;
}

export interface ImageExportResult {
  images: ExportedImage[];
  errors: ImageExportError[];
}

export interface ImageExportError {
  nodeId: string;
  message: string;
}

function getToken(): string {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    throw new Error(
      'FIGMA_TOKEN environment variable is required. Set it with your Figma personal access token.',
    );
  }
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  token: string,
  retryCount = 0,
): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (response.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(
        `Figma API rate limit exceeded. Max retries (${MAX_RETRIES}) reached.`,
      );
    }
    const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
    console.warn(
      `Rate limited by Figma API. Retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    );
    await sleep(backoffMs);
    return fetchWithRetry(url, token, retryCount + 1);
  }

  return response;
}

/**
 * Gets image URLs from the Figma API for specified nodes.
 */
async function getImageUrls(
  fileKey: string,
  nodeIds: string[],
  token: string,
  scale: number = DEFAULT_IMAGE_SCALE,
): Promise<{ urls: Record<string, string>; error?: string }> {
  if (nodeIds.length === 0) {
    return { urls: {} };
  }

  const idsParam = nodeIds.join(',');
  const url = `${FIGMA_API_BASE}/v1/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&scale=${scale}&format=png`;

  try {
    const response = await fetchWithRetry(url, token);

    if (!response.ok) {
      let errorMessage = `Figma API error: ${response.status} ${response.statusText}`;
      if (response.status === 403) {
        errorMessage =
          'Invalid or expired FIGMA_TOKEN. Please check your token has access to this file.';
      } else if (response.status === 404) {
        errorMessage = `Figma file not found: ${fileKey}. Check the file key is correct.`;
      }
      return { urls: {}, error: errorMessage };
    }

    const data = (await response.json()) as FigmaApiImagesResponse;

    if (data.err) {
      return { urls: {}, error: `Figma API error: ${data.err}` };
    }

    return { urls: data.images || {} };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { urls: {}, error: message };
  }
}

/**
 * Downloads an image from a URL and saves it to disk.
 */
async function downloadImage(
  imageUrl: string,
  destPath: string,
): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.warn(`Failed to download image: ${response.status} ${response.statusText}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to download image: ${message}`);
    return false;
  }
}

/**
 * Gets the image path for a node.
 */
export function getImagePath(specsDir: string, nodeId: string): string {
  return path.join(specsDir, 'images', `${sanitizeNodeId(nodeId)}.png`);
}

/**
 * Gets the previous image path for a node (for before/after comparison).
 */
export function getPreviousImagePath(specsDir: string, nodeId: string): string {
  return path.join(specsDir, 'images', `${sanitizeNodeId(nodeId)}.prev.png`);
}

/**
 * Ensures the images directory exists.
 */
function ensureImagesDir(specsDir: string): void {
  const imagesDir = path.join(specsDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

export interface ExportImagesInput {
  fileKey: string;
  nodeIds: string[];
  changeResult: ChangeDetectionResult;
}

/**
 * Exports images for changed and added nodes.
 * Preserves previous versions as .prev.png for before/after comparison.
 */
export async function exportImages(
  input: ExportImagesInput,
  config?: Partial<SentinelConfig>,
): Promise<ImageExportResult> {
  const specsDir = config?.specsDir || DEFAULT_SPECS_DIR;
  const scale = config?.imageScale || DEFAULT_IMAGE_SCALE;
  const images: ExportedImage[] = [];
  const errors: ImageExportError[] = [];

  const { fileKey, changeResult } = input;

  const nodesToExport = [...changeResult.added, ...changeResult.changed];

  if (nodesToExport.length === 0) {
    console.log('No nodes to export images for');
    return { images, errors };
  }

  let token: string;
  try {
    token = getToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    for (const nodeId of nodesToExport) {
      errors.push({ nodeId, message });
    }
    return { images, errors };
  }

  ensureImagesDir(specsDir);

  console.log(`Exporting images for ${nodesToExport.length} node(s)`);

  const { urls, error: urlError } = await getImageUrls(
    fileKey,
    nodesToExport,
    token,
    scale,
  );

  if (urlError) {
    console.warn(`Failed to get image URLs: ${urlError}`);
    for (const nodeId of nodesToExport) {
      errors.push({ nodeId, message: urlError });
    }
    return { images, errors };
  }

  for (const nodeId of nodesToExport) {
    const imageUrl = urls[nodeId];
    if (!imageUrl) {
      errors.push({ nodeId, message: `No image URL returned for node ${nodeId}` });
      continue;
    }

    const currentPath = getImagePath(specsDir, nodeId);
    const prevPath = getPreviousImagePath(specsDir, nodeId);

    if (changeResult.changed.includes(nodeId) && fs.existsSync(currentPath)) {
      try {
        fs.copyFileSync(currentPath, prevPath);
      } catch {
        console.warn(`Failed to copy previous image for ${nodeId}`);
      }
    }

    const success = await downloadImage(imageUrl, currentPath);

    if (success) {
      const exportedImage: ExportedImage = {
        nodeId,
        imagePath: currentPath,
      };

      if (
        changeResult.changed.includes(nodeId) &&
        fs.existsSync(prevPath)
      ) {
        exportedImage.previousImagePath = prevPath;
      }

      images.push(exportedImage);
    } else {
      errors.push({ nodeId, message: `Failed to download image for node ${nodeId}` });
    }
  }

  console.log(`Successfully exported ${images.length} image(s)`);

  if (errors.length > 0) {
    console.warn(`Encountered ${errors.length} error(s) during image export`);
  }

  return { images, errors };
}

/**
 * Exports images for multiple file keys.
 * Groups nodes by file key for efficient API usage.
 */
export async function exportImagesForMultipleFiles(
  inputs: { fileKey: string; nodeId: string }[],
  changeResult: ChangeDetectionResult,
  config?: Partial<SentinelConfig>,
): Promise<ImageExportResult> {
  const allImages: ExportedImage[] = [];
  const allErrors: ImageExportError[] = [];

  const grouped = new Map<string, string[]>();
  for (const { fileKey, nodeId } of inputs) {
    const nodeIds = grouped.get(fileKey) || [];
    if (!nodeIds.includes(nodeId)) {
      nodeIds.push(nodeId);
      grouped.set(fileKey, nodeIds);
    }
  }

  for (const [fileKey, nodeIds] of grouped) {
    const relevantChange: ChangeDetectionResult = {
      hasChanges: changeResult.hasChanges,
      added: changeResult.added.filter(id => nodeIds.includes(id)),
      changed: changeResult.changed.filter(id => nodeIds.includes(id)),
      removed: changeResult.removed.filter(id => nodeIds.includes(id)),
    };

    const result = await exportImages(
      { fileKey, nodeIds, changeResult: relevantChange },
      config,
    );

    allImages.push(...result.images);
    allErrors.push(...result.errors);
  }

  return { images: allImages, errors: allErrors };
}

/**
 * Cleans up images for removed nodes.
 */
export function cleanupRemovedImages(
  specsDir: string,
  removedNodeIds: string[],
): void {
  for (const nodeId of removedNodeIds) {
    const imagePath = getImagePath(specsDir, nodeId);
    const prevPath = getPreviousImagePath(specsDir, nodeId);

    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch {
        console.warn(`Failed to remove image: ${imagePath}`);
      }
    }

    if (fs.existsSync(prevPath)) {
      try {
        fs.unlinkSync(prevPath);
      } catch {
        console.warn(`Failed to remove previous image: ${prevPath}`);
      }
    }
  }
}
