/**
 * Figma Variables API Client
 *
 * Fetches Figma Variables from the REST API for design token tracking.
 * Note: This API requires Figma Enterprise plan.
 */

import * as crypto from 'crypto';
import type { FigmaColor } from './types.js';

const FIGMA_API_BASE = 'https://api.figma.com';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Variable types supported by Figma
 */
export type VariableResolvedType = 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';

/**
 * Variable scope for showing/hiding in the variable picker UI
 */
export type VariableScope =
  | 'ALL_SCOPES'
  | 'CORNER_RADIUS'
  | 'TEXT_CONTENT'
  | 'WIDTH_HEIGHT'
  | 'GAP'
  | 'STROKE_FLOAT'
  | 'OPACITY'
  | 'EFFECT_FLOAT'
  | 'FONT_WEIGHT'
  | 'FONT_SIZE'
  | 'LINE_HEIGHT'
  | 'LETTER_SPACING'
  | 'PARAGRAPH_SPACING'
  | 'PARAGRAPH_INDENT'
  | 'FONT_FAMILY'
  | 'FONT_STYLE'
  | 'FONT_VARIATIONS'
  | 'ALL_FILLS'
  | 'FRAME_FILL'
  | 'SHAPE_FILL'
  | 'TEXT_FILL'
  | 'STROKE_COLOR'
  | 'EFFECT_COLOR';

/**
 * Variable alias referencing another variable
 */
export interface VariableAlias {
  type: 'VARIABLE_ALIAS';
  id: string;
}

/**
 * Code syntax definitions for a variable
 */
export interface VariableCodeSyntax {
  WEB?: string;
  ANDROID?: string;
  iOS?: string;
}

/**
 * Value types for variables
 */
export type VariableValue = boolean | number | string | FigmaColor | VariableAlias;

/**
 * A Figma Variable (design token)
 */
export interface FigmaVariable {
  /** Unique identifier */
  id: string;
  /** Variable name */
  name: string;
  /** Key for referencing */
  key: string;
  /** Collection this variable belongs to */
  variableCollectionId: string;
  /** The resolved type of the variable */
  resolvedType: VariableResolvedType;
  /** Values for each mode */
  valuesByMode: Record<string, VariableValue>;
  /** Whether this is a remote variable */
  remote: boolean;
  /** Description of the variable */
  description: string;
  /** Whether hidden from publishing */
  hiddenFromPublishing: boolean;
  /** UI scopes where this variable is shown */
  scopes: VariableScope[];
  /** Code syntax definitions */
  codeSyntax?: VariableCodeSyntax;
  /** Whether deleted but still referenced */
  deletedButReferenced?: boolean;
}

/**
 * Mode information within a variable collection
 */
export interface VariableMode {
  modeId: string;
  name: string;
  parentModeId?: string;
}

/**
 * A Figma Variable Collection
 */
export interface FigmaVariableCollection {
  /** Unique identifier */
  id: string;
  /** Collection name */
  name: string;
  /** Key for referencing */
  key: string;
  /** Modes in this collection (modeId -> mode info) */
  modes: VariableMode[];
  /** Default mode ID */
  defaultModeId: string;
  /** Whether this is a remote collection */
  remote: boolean;
  /** Whether hidden from publishing */
  hiddenFromPublishing: boolean;
  /** Variable IDs in this collection */
  variableIds: string[];
  /** Whether this is an extended collection */
  isExtension?: boolean;
  /** Parent collection ID (for extended collections) */
  parentVariableCollectionId?: string;
  /** Root collection ID (for extended collections) */
  rootVariableCollectionId?: string;
  /** Inherited variable IDs (for extended collections) */
  inheritedVariableIds?: string[];
  /** Local variable IDs (for extended collections) */
  localVariableIds?: string[];
  /** Variable overrides (for extended collections) */
  variableOverrides?: Record<string, Record<string, VariableValue>>;
}

/**
 * Response from GET /v1/files/:file_key/variables/local
 */
export interface FigmaVariablesApiResponse {
  status: number;
  error: boolean;
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables: Record<string, FigmaVariable>;
  };
}

/**
 * A variables directive extracted from source code
 */
export interface FigmaVariablesDirective {
  /** Path to the source file containing the directive */
  sourceFile: string;
  /** Figma file key */
  fileKey: string;
  /** Collection names to track (empty array means all collections) */
  collectionNames: string[];
}

/**
 * Result from fetching variables
 */
export interface FetchVariablesResult {
  /** Fetched variable collections */
  collections: FigmaVariableCollection[];
  /** Fetched variables */
  variables: FigmaVariable[];
  /** Errors encountered */
  errors: FetchVariablesError[];
}

/**
 * Error from fetching variables
 */
export interface FetchVariablesError {
  fileKey: string;
  message: string;
}

/**
 * Normalized variable spec for storage and comparison
 */
export interface NormalizedVariableSpec {
  /** Unique identifier based on variable ID */
  id: string;
  /** Variable name */
  name: string;
  /** Collection name */
  collectionName: string;
  /** Collection ID */
  collectionId: string;
  /** Figma file key */
  fileKey: string;
  /** Source file that references this variable */
  sourceFile: string;
  /** Variable type */
  type: VariableResolvedType;
  /** Values by mode (mode name -> value) */
  valuesByMode: Record<string, VariableValue>;
  /** Variable description */
  description: string;
  /** Scopes */
  scopes: VariableScope[];
  /** Code syntax */
  codeSyntax?: VariableCodeSyntax;
  /** Content hash for change detection */
  contentHash: string;
  /** Timestamp when spec was generated */
  generatedAt: string;
}

/**
 * Normalized variable collection spec
 */
export interface NormalizedVariableCollectionSpec {
  /** Collection ID */
  id: string;
  /** Collection name */
  name: string;
  /** Figma file key */
  fileKey: string;
  /** Source file */
  sourceFile: string;
  /** Mode names */
  modes: string[];
  /** Default mode name */
  defaultMode: string;
  /** Variables in this collection */
  variables: NormalizedVariableSpec[];
  /** Content hash */
  contentHash: string;
  /** Generated timestamp */
  generatedAt: string;
}

/**
 * Variable change detection result
 */
export interface VariableChangeDetectionResult {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Added variables */
  added: string[];
  /** Changed variables */
  changed: string[];
  /** Removed variables */
  removed: string[];
  /** Added collections */
  addedCollections: string[];
  /** Removed collections */
  removedCollections: string[];
}

/**
 * Variable changelog entry
 */
export interface VariableChangelogEntry {
  /** Type of change */
  type: 'added' | 'changed' | 'removed';
  /** Variable ID */
  variableId: string;
  /** Variable name */
  name: string;
  /** Collection name */
  collectionName: string;
  /** Source file path */
  sourceFile: string;
  /** Property changes (for 'changed' type) */
  propertyChanges?: Array<{
    path: string;
    previousValue: string;
    newValue: string;
  }>;
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
 * Fetches local variables from a Figma file.
 * Note: This API requires Figma Enterprise plan.
 *
 * @param fileKey - The Figma file key
 * @param collectionNames - Optional array of collection names to filter (empty = all)
 * @returns Promise containing collections, variables, and any errors
 */
export async function fetchVariables(
  fileKey: string,
  collectionNames: string[] = [],
): Promise<FetchVariablesResult> {
  const token = getToken();
  const collections: FigmaVariableCollection[] = [];
  const variables: FigmaVariable[] = [];
  const errors: FetchVariablesError[] = [];

  const url = `${FIGMA_API_BASE}/v1/files/${fileKey}/variables/local`;

  let response: Response;
  try {
    response = await fetchWithRetry(url, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    errors.push({ fileKey, message });
    return { collections, variables, errors };
  }

  if (!response.ok) {
    let errorMessage = `Figma API error: ${response.status} ${response.statusText}`;
    if (response.status === 403) {
      errorMessage =
        'Figma Variables API requires Enterprise plan. Please check your plan and token permissions.';
    } else if (response.status === 404) {
      errorMessage = `Figma file not found: ${fileKey}. Check the file key is correct.`;
    }
    errors.push({ fileKey, message: errorMessage });
    return { collections, variables, errors };
  }

  let data: FigmaVariablesApiResponse;
  try {
    data = (await response.json()) as FigmaVariablesApiResponse;
  } catch {
    errors.push({ fileKey, message: 'Failed to parse Figma Variables API response' });
    return { collections, variables, errors };
  }

  if (data.error) {
    errors.push({ fileKey, message: 'Figma API returned an error response' });
    return { collections, variables, errors };
  }

  // Process collections
  for (const collection of Object.values(data.meta.variableCollections)) {
    // Filter by collection name if specified
    if (collectionNames.length > 0 && !collectionNames.includes(collection.name)) {
      continue;
    }
    collections.push(collection);

    // Get variables for this collection
    for (const variableId of collection.variableIds) {
      const variable = data.meta.variables[variableId];
      if (variable) {
        variables.push(variable);
      }
    }
  }

  console.log(
    `Fetched ${collections.length} collection(s) with ${variables.length} variable(s) from file ${fileKey}`,
  );

  return { collections, variables, errors };
}

/**
 * Fetches variables for multiple directives.
 */
export async function fetchVariablesForDirectives(
  directives: FigmaVariablesDirective[],
): Promise<FetchVariablesResult> {
  const allCollections: FigmaVariableCollection[] = [];
  const allVariables: FigmaVariable[] = [];
  const allErrors: FetchVariablesError[] = [];

  // Group by file key
  const byFileKey = new Map<string, string[]>();
  for (const directive of directives) {
    const existing = byFileKey.get(directive.fileKey) || [];
    existing.push(...directive.collectionNames);
    byFileKey.set(directive.fileKey, existing);
  }

  for (const [fileKey, collectionNames] of byFileKey) {
    const result = await fetchVariables(fileKey, collectionNames);
    allCollections.push(...result.collections);
    allVariables.push(...result.variables);
    allErrors.push(...result.errors);
  }

  return {
    collections: allCollections,
    variables: allVariables,
    errors: allErrors,
  };
}

/**
 * Normalizes a variable for storage and comparison.
 * Strips volatile properties and creates a stable representation.
 */
export function normalizeVariable(
  variable: FigmaVariable,
  collection: FigmaVariableCollection,
  fileKey: string,
  sourceFile: string,
): NormalizedVariableSpec {
  // Create mode name mapping
  const modeIdToName = new Map<string, string>();
  for (const mode of collection.modes) {
    modeIdToName.set(mode.modeId, mode.name);
  }

  // Convert valuesByMode to use mode names instead of IDs
  const valuesByModeName: Record<string, VariableValue> = {};
  for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
    const modeName = modeIdToName.get(modeId) || modeId;
    valuesByModeName[modeName] = value;
  }

  const spec: Omit<NormalizedVariableSpec, 'contentHash' | 'generatedAt'> = {
    id: variable.id,
    name: variable.name,
    collectionName: collection.name,
    collectionId: collection.id,
    fileKey,
    sourceFile,
    type: variable.resolvedType,
    valuesByMode: valuesByModeName,
    description: variable.description || '',
    scopes: variable.scopes || [],
    codeSyntax: variable.codeSyntax,
  };

  const contentHash = computeVariableContentHash(spec);

  return {
    ...spec,
    contentHash,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Normalizes a variable collection for storage and comparison.
 */
export function normalizeVariableCollection(
  collection: FigmaVariableCollection,
  variables: FigmaVariable[],
  fileKey: string,
  sourceFile: string,
): NormalizedVariableCollectionSpec {
  const modeNames = collection.modes.map(m => m.name);
  const defaultModeName =
    collection.modes.find(m => m.modeId === collection.defaultModeId)?.name ||
    modeNames[0] ||
    'Mode 1';

  const normalizedVariables = variables
    .filter(v => v.variableCollectionId === collection.id)
    .map(v => normalizeVariable(v, collection, fileKey, sourceFile))
    .sort((a, b) => a.name.localeCompare(b.name));

  const spec: Omit<NormalizedVariableCollectionSpec, 'contentHash' | 'generatedAt'> = {
    id: collection.id,
    name: collection.name,
    fileKey,
    sourceFile,
    modes: modeNames,
    defaultMode: defaultModeName,
    variables: normalizedVariables,
  };

  const contentHash = computeCollectionContentHash(spec);

  return {
    ...spec,
    contentHash,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Computes a content hash for a variable spec.
 */
function computeVariableContentHash(
  spec: Omit<NormalizedVariableSpec, 'contentHash' | 'generatedAt'>,
): string {
  const content = JSON.stringify({
    name: spec.name,
    type: spec.type,
    valuesByMode: spec.valuesByMode,
    description: spec.description,
    scopes: spec.scopes,
    codeSyntax: spec.codeSyntax,
  });
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Computes a content hash for a collection spec.
 */
function computeCollectionContentHash(
  spec: Omit<NormalizedVariableCollectionSpec, 'contentHash' | 'generatedAt'>,
): string {
  const content = JSON.stringify({
    name: spec.name,
    modes: spec.modes,
    defaultMode: spec.defaultMode,
    variableHashes: spec.variables.map(v => v.contentHash),
  });
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Detects changes between old and new variable specs.
 */
export function detectVariableChanges(
  oldSpecs: NormalizedVariableSpec[],
  newSpecs: NormalizedVariableSpec[],
): VariableChangeDetectionResult {
  const oldMap = new Map(oldSpecs.map(s => [s.id, s]));
  const newMap = new Map(newSpecs.map(s => [s.id, s]));

  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  // Check for added and changed
  for (const [id, newSpec] of newMap) {
    const oldSpec = oldMap.get(id);
    if (!oldSpec) {
      added.push(id);
    } else if (oldSpec.contentHash !== newSpec.contentHash) {
      changed.push(id);
    }
  }

  // Check for removed
  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      removed.push(id);
    }
  }

  return {
    hasChanges: added.length > 0 || changed.length > 0 || removed.length > 0,
    added,
    changed,
    removed,
    addedCollections: [],
    removedCollections: [],
  };
}

/**
 * Generates changelog entries for variable changes.
 */
export function generateVariableChangelogEntries(
  oldSpecs: NormalizedVariableSpec[],
  newSpecs: NormalizedVariableSpec[],
  changeResult: VariableChangeDetectionResult,
): VariableChangelogEntry[] {
  const oldMap = new Map(oldSpecs.map(s => [s.id, s]));
  const newMap = new Map(newSpecs.map(s => [s.id, s]));

  const entries: VariableChangelogEntry[] = [];

  // Added variables
  for (const id of changeResult.added) {
    const spec = newMap.get(id);
    if (spec) {
      entries.push({
        type: 'added',
        variableId: id,
        name: spec.name,
        collectionName: spec.collectionName,
        sourceFile: spec.sourceFile,
      });
    }
  }

  // Changed variables
  for (const id of changeResult.changed) {
    const oldSpec = oldMap.get(id);
    const newSpec = newMap.get(id);
    if (oldSpec && newSpec) {
      const propertyChanges = diffVariableSpecs(oldSpec, newSpec);
      entries.push({
        type: 'changed',
        variableId: id,
        name: newSpec.name,
        collectionName: newSpec.collectionName,
        sourceFile: newSpec.sourceFile,
        propertyChanges,
      });
    }
  }

  // Removed variables
  for (const id of changeResult.removed) {
    const spec = oldMap.get(id);
    if (spec) {
      entries.push({
        type: 'removed',
        variableId: id,
        name: spec.name,
        collectionName: spec.collectionName,
        sourceFile: spec.sourceFile,
      });
    }
  }

  return entries;
}

/**
 * Diffs two variable specs and returns property changes.
 */
function diffVariableSpecs(
  oldSpec: NormalizedVariableSpec,
  newSpec: NormalizedVariableSpec,
): Array<{ path: string; previousValue: string; newValue: string }> {
  const changes: Array<{ path: string; previousValue: string; newValue: string }> = [];

  // Check name
  if (oldSpec.name !== newSpec.name) {
    changes.push({
      path: 'name',
      previousValue: oldSpec.name,
      newValue: newSpec.name,
    });
  }

  // Check description
  if (oldSpec.description !== newSpec.description) {
    changes.push({
      path: 'description',
      previousValue: oldSpec.description || '(empty)',
      newValue: newSpec.description || '(empty)',
    });
  }

  // Check values by mode
  const allModes = new Set([
    ...Object.keys(oldSpec.valuesByMode),
    ...Object.keys(newSpec.valuesByMode),
  ]);

  for (const mode of allModes) {
    const oldValue = oldSpec.valuesByMode[mode];
    const newValue = newSpec.valuesByMode[mode];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        path: `valuesByMode.${mode}`,
        previousValue: formatVariableValue(oldValue),
        newValue: formatVariableValue(newValue),
      });
    }
  }

  return changes;
}

/**
 * Formats a variable value for display.
 */
export function formatVariableValue(value: VariableValue | undefined): string {
  if (value === undefined) {
    return '(undefined)';
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  // Check if it's a variable alias
  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    return `→ ${value.id}`;
  }

  // It's a color
  if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    if (value.a !== undefined && value.a < 1) {
      return `${hex} (${Math.round(value.a * 100)}%)`;
    }
    return hex;
  }

  return JSON.stringify(value);
}

/**
 * Generates markdown changelog for variable changes.
 */
export function generateVariableChangelogMarkdown(
  entries: VariableChangelogEntry[],
): string {
  if (entries.length === 0) {
    return '';
  }

  const lines: string[] = ['## Variable Changes', ''];

  const added = entries.filter(e => e.type === 'added');
  const changed = entries.filter(e => e.type === 'changed');
  const removed = entries.filter(e => e.type === 'removed');

  if (added.length > 0) {
    lines.push('### Added Variables', '');
    for (const entry of added) {
      lines.push(`- **${entry.name}** in \`${entry.collectionName}\``);
    }
    lines.push('');
  }

  if (changed.length > 0) {
    lines.push('### Changed Variables', '');
    for (const entry of changed) {
      lines.push(`- **${entry.name}** in \`${entry.collectionName}\``);
      if (entry.propertyChanges) {
        for (const change of entry.propertyChanges) {
          lines.push(`  - ${change.path}: \`${change.previousValue}\` → \`${change.newValue}\``);
        }
      }
    }
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('### Removed Variables', '');
    for (const entry of removed) {
      lines.push(`- ~~${entry.name}~~ from \`${entry.collectionName}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
