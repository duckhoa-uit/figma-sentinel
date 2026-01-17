# Figma Sentinel

[![npm version](https://img.shields.io/npm/v/@khoavhd/figma-sentinel-core.svg)](https://www.npmjs.com/package/@khoavhd/figma-sentinel-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> Automated design change tracking and synchronization from Figma to your codebase

Figma Sentinel is a directive-driven tool that monitors Figma designs referenced in your source code, detects changes, and creates automated pull requests with detailed changelogs. It bridges the gap between design and development by keeping your codebase in sync with Figma.

## Features

- **Directive-Based Tracking**: Reference Figma nodes directly in source code comments
- **Easy Linking**: Add Figma directives from URLs with a single command
- **Change Detection**: Automatically detect added, modified, and removed design properties
- **Image Export**: Export design previews alongside JSON specs
- **Markdown Export**: Generate LLM-optimized design specs for AI-assisted development
- **Automated PRs**: Create pull requests with detailed changelogs via GitHub Actions
- **Flexible Configuration**: Support for multiple config formats (JS, JSON, package.json)

## Requirements

- **Node.js 18+** (uses native fetch)
- **Figma Personal Access Token** ([Get one here](https://www.figma.com/developers/api#access-tokens))
- **pnpm/npm/yarn** for package installation

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@khoavhd/figma-sentinel`](./packages/cli) | CLI tool | [![npm](https://img.shields.io/npm/v/@khoavhd/figma-sentinel.svg)](https://www.npmjs.com/package/@khoavhd/figma-sentinel) |
| [`@khoavhd/figma-sentinel-core`](./packages/core) | Core library | [![npm](https://img.shields.io/npm/v/@khoavhd/figma-sentinel-core.svg)](https://www.npmjs.com/package/@khoavhd/figma-sentinel-core) |
| [`@khoavhd/figma-sentinel-action`](./packages/action) | GitHub Action | [Marketplace](https://github.com/duckhoa-uit/figma-sentinel) |

## Installation

### CLI (Recommended)

```bash
# Run directly with npx (no install required)
npx @khoavhd/figma-sentinel sync

# Or install globally
npm install -g @khoavhd/figma-sentinel
pnpm add -g @khoavhd/figma-sentinel

# Verify installation
figma-sentinel --version
```

### Core Library (for programmatic use)

```bash
npm install @khoavhd/figma-sentinel-core
# or
pnpm add @khoavhd/figma-sentinel-core
```

### GitHub Action

```yaml
- uses: duckhoa-uit/figma-sentinel@v1
  with:
    figma-token: ${{ secrets.FIGMA_TOKEN }}
```

See [GitHub Action Usage](#github-action-usage) for complete workflow examples.

## Quick Start

### 1. Add Figma Directives to Your Code

Reference Figma designs in your source code using comment directives:

```tsx
// src/components/Button.tsx

// @figma-file: ABC123xyz
// @figma-node: 1:23
// @figma-node: 1:45

export function Button({ children }) {
  return <button className="btn-primary">{children}</button>;
}
```

**Directive Syntax:**
- `@figma-file: <file-key>` - The Figma file key from the URL
- `@figma-node: <node-id>` - The node ID (right-click → "Copy link" in Figma)

### 2. Initialize Configuration

```bash
# Interactive setup
figma-sentinel init

# Or create manually: figma-sentinel.config.js
```

> **Tip:** Use `figma-sentinel link <url> -f src/Button.tsx` to quickly add directives from a Figma URL!

### 3. Set Up Figma Token

```bash
export FIGMA_TOKEN="your-figma-personal-access-token"
```

Get your token from [Figma Account Settings](https://www.figma.com/developers/api#access-tokens).

### 4. Run Sync

```bash
# Check your setup first
figma-sentinel check

# Sync designs
figma-sentinel sync
```

## Configuration

Figma Sentinel uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration loading. Create one of:

- `figma-sentinel.config.js` or `figma-sentinel.config.cjs`
- `.figma-sentinelrc.json`
- `"figma-sentinel"` key in `package.json`

### Configuration Options

```js
// figma-sentinel.config.js
module.exports = {
  // Glob patterns for files to scan (default: ['src/**/*.tsx', 'src/**/*.jsx'])
  filePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],
  
  // Patterns to exclude
  excludePatterns: ['node_modules/**', '**/*.test.tsx'],
  
  // Directory to store design specs (default: '.design-specs')
  specsDir: '.design-specs',
  
  // Export design images (default: true)
  exportImages: true,
  
  // Image export scale (default: 2)
  imageScale: 2,
  
  // Output format: 'json', 'markdown', or 'both' (default: 'json')
  outputFormat: 'json',
  
  // Properties to include (allowlist)
  includeProperties: ['fills', 'strokes', 'effects', 'style'],
  
  // Properties to exclude (blocklist)
  excludeProperties: ['absoluteBoundingBox', 'relativeTransform'],
};
```

### Default Values

| Option | Default | Description |
|--------|---------|-------------|
| `filePatterns` | `['src/**/*.tsx', 'src/**/*.jsx']` | Files to scan for directives |
| `excludePatterns` | `['node_modules/**']` | Files to exclude |
| `specsDir` | `'.design-specs'` | Output directory for specs |
| `exportImages` | `true` | Export node images |
| `imageScale` | `2` | Image export scale (1-4) |
| `outputFormat` | `'json'` | Spec output format |

## Error Handling

Figma Sentinel provides comprehensive error handling with typed error classes, automatic retry logic, and user-friendly error messages.

### Error Types

| Error Class | Code | When Occurs | Retryable |
|-------------|------|-------------|-----------|
| `FigmaAuthenticationError` | `AUTH_ERROR` | 401/403 - Invalid or expired token, no access | No |
| `FigmaNotFoundError` | `NOT_FOUND` | 404 - File or node doesn't exist | No |
| `FigmaRateLimitError` | `RATE_LIMIT` | 429 - Too many requests | Yes |
| `FigmaServerError` | `SERVER_ERROR` | 500+ - Figma API server error | No |
| `FigmaValidationError` | `VALIDATION_ERROR` | 400 - Invalid request format | No |
| `FigmaNetworkError` | `NETWORK_ERROR` | Connection failed, timeout | Yes |

### Retry Behavior

When a rate limit (429) or network error occurs, Figma Sentinel automatically retries with the following logic:

1. **Retry-After Header**: If Figma returns a `Retry-After` header, that value is used as the wait time
2. **Exponential Backoff**: If no header is present, uses exponential backoff (1s, 2s, 4s...)
3. **Max Delay Abort**: If the wait time exceeds `maxRetryDelayMs` (default: 1 hour), retries abort immediately

The CLI shows a spinner with countdown during rate limit waits:
```
⠋ Rate limited. Waiting 60s... (Tier: starter, Type: file)
```

### Configuration Options

Control retry and concurrency behavior via the `api` config section:

```js
// figma-sentinel.config.js
module.exports = {
  // ... other options
  api: {
    concurrency: 5,       // Max concurrent API requests (default: 5, max: 20)
    maxRetries: 3,        // Max retry attempts (default: 3, max: 10)
    maxRetryDelayMs: 3600000, // Max wait before aborting retry (default: 1 hour)
  },
};
```

### Event System for Custom Integrations

For advanced use cases, subscribe to error events programmatically:

```typescript
import { 
  runSentinel, 
  createEventEmitter,
  type ErrorEventPayload,
  type RetryEventPayload,
  type RateLimitedEventPayload,
  type CompletedEventPayload,
} from '@khoavhd/figma-sentinel-core';

const emitter = createEventEmitter();

// Handle errors
emitter.onError((payload: ErrorEventPayload) => {
  console.error(`Error in file ${payload.context?.fileKey}:`, payload.error.message);
  // Send to Sentry, Slack, etc.
});

// Track retries
emitter.onRetry((payload: RetryEventPayload) => {
  console.log(`Retry ${payload.details.attempt}/${payload.details.maxRetries}`);
});

// Handle rate limits
emitter.onRateLimited((payload: RateLimitedEventPayload) => {
  console.log(`Rate limited. Waiting ${payload.details.retryAfterSec}s`);
  console.log(`Plan tier: ${payload.details.headers.planTier}`);
});

// Track completion
emitter.onCompleted((payload: CompletedEventPayload) => {
  console.log(`Done: ${payload.details.successCount} succeeded, ${payload.details.failureCount} failed`);
});

// Pass emitter to runSentinel
const result = await runSentinel({
  configPath: './figma-sentinel.config.js',
  eventEmitter: emitter,
});
```

### GitHub Action Error Outputs

When using the GitHub Action, error information is available via outputs:

```yaml
- name: Sync Figma Designs
  id: sync
  uses: duckhoa-uit/figma-sentinel@v1
  with:
    figma-token: ${{ secrets.FIGMA_TOKEN }}
  continue-on-error: true

- name: Handle Errors
  if: steps.sync.outputs.error-count != '0'
  run: |
    echo "Error occurred: ${{ steps.sync.outputs.error-details }}"
```

| Output | Description |
|--------|-------------|
| `error-count` | Number of errors (`0` or `1` with fail-fast) |
| `error-details` | JSON with `code`, `message`, `isRetryable`, `name` |

## CLI Commands

### `figma-sentinel sync`

Scan source files, fetch Figma designs, and detect changes.

```bash
figma-sentinel sync [options]

Options:
  --dry-run         Preview changes without writing files
  --cwd <dir>       Set working directory
  --config <path>   Path to config file
```

**Example:**
```bash
# Preview what would change
figma-sentinel sync --dry-run

# Sync with custom config
figma-sentinel sync --config ./custom-config.js
```

### `figma-sentinel check`

Validate your setup without fetching from Figma.

```bash
figma-sentinel check [options]

Options:
  --cwd <dir>       Set working directory
  --config <path>   Path to config file
```

**Output includes:**
- Config file validation
- FIGMA_TOKEN environment check
- Summary of files with directives
- Node count and unique Figma file count

### `figma-sentinel init`

Initialize Figma Sentinel with an interactive wizard.

```bash
figma-sentinel init [options]

Options:
  --cwd <dir>       Set working directory
```

**Prompts for:**
- Config format (JS/JSON/package.json)
- Specs directory location
- File patterns to scan
- Image export options

### `figma-sentinel diff <node-id>`

Debug and compare a specific node's current and stored state.

```bash
figma-sentinel diff <node-id> [options]

Options:
  --file-key <key>  Figma file key (required)
  --cwd <dir>       Set working directory
  --config <path>   Path to config file
```

**Example:**
```bash
# Compare node 1:23 from Figma file ABC123
figma-sentinel diff 1:23 --file-key ABC123xyz
```

### `figma-sentinel variables`

Fetch and display Figma Variables (design tokens) from Figma files.

> **Note:** The Figma Variables API requires a Figma Enterprise plan.

```bash
figma-sentinel variables [options]

Options:
  --file-key <key>      Figma file key to fetch variables from
  --collection <name>   Filter by collection name
  --output <path>       Output JSON file path
  --cwd <dir>          Set working directory
  --config <path>      Path to config file
```

**Examples:**
```bash
# Fetch all variables from a specific file
figma-sentinel variables --file-key ABC123xyz

# Fetch only the "Colors" collection
figma-sentinel variables --file-key ABC123xyz --collection Colors

# Export to JSON file
figma-sentinel variables --file-key ABC123xyz --output variables.json

# Using directives from source files
figma-sentinel variables
```

**Directive Syntax for Variables:**
```tsx
// @figma-file: ABC123xyz
// @figma-variables: *              // Track all collections
// @figma-variables: Colors         // Track specific collection
// @figma-variables: Colors, Spacing // Track multiple collections
```

### `figma-sentinel link`

Link source files to Figma designs by adding directives from URLs.

```bash
figma-sentinel link [url] [options]

Options:
  -f, --file <path>    Target file path (can be used multiple times)
  -p, --path <path>    Alias for --file
  -y, --yes            Skip confirmations (auto-add or auto-replace)
  --force              Always replace existing directives
  -c, --cwd <dir>      Set working directory
```

**How it works:**
1. Parses the Figma URL to extract the file key and node ID
2. Detects the correct comment style for your file type (e.g., `//` for TypeScript, `#` for Python)
3. Inserts `@figma-file` and `@figma-node` directives at the top of the file

**Examples:**
```bash
# Link a single file (interactive if no args)
figma-sentinel link

# Link with URL and file
figma-sentinel link "https://www.figma.com/design/ABC123/MyDesign?node-id=1:23" -f src/Button.tsx

# Link multiple files to the same design
figma-sentinel link "https://www.figma.com/design/ABC123/MyDesign?node-id=1:23" \
  -f src/Button.tsx \
  -f src/ButtonIcon.tsx

# Replace existing directives without prompting
figma-sentinel link "https://www.figma.com/design/ABC123/MyDesign?node-id=1:23" -f src/Button.tsx --force

# Auto-accept defaults (add if same file key, replace if different)
figma-sentinel link "https://www.figma.com/design/ABC123/MyDesign?node-id=1:23" -f src/Button.tsx --yes
```

## GitHub Action Usage

Add Figma Sentinel to your CI/CD pipeline for automated design sync.

### Basic Usage

```yaml
# .github/workflows/figma-sync.yml
name: Figma Design Sync

on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9am UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Sync Figma Designs
        uses: duckhoa-uit/figma-sentinel@v1
        with:
          figma-token: ${{ secrets.FIGMA_TOKEN }}
          create-pr: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `figma-token` | Yes | - | Figma API personal access token |
| `config-path` | No | Auto-detect | Path to config file |
| `dry-run` | No | `false` | Preview without changes |
| `create-pr` | No | `false` | Create/update PR with changes |
| `pr-title` | No | `chore: update Figma design specs` | PR title |
| `pr-labels` | No | `design-sync,automated` | Comma-separated PR labels |
| `pr-reviewers` | No | - | Comma-separated reviewers |

### Action Outputs

| Output | Description |
|--------|-------------|
| `has-changes` | Whether design changes were detected |
| `changelog-path` | Path to generated changelog file |
| `pr-number` | Created/updated PR number |
| `pr-url` | Created/updated PR URL |

### Advanced Workflow

```yaml
name: Figma Design Sync

on:
  schedule:
    - cron: '0 9 * * 1-5'
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Sync Figma Designs
        id: sync
        uses: duckhoa-uit/figma-sentinel@v1
        with:
          figma-token: ${{ secrets.FIGMA_TOKEN }}
          create-pr: true
          pr-title: 'chore: sync design specs from Figma'
          pr-labels: 'design,automated,needs-review'
          pr-reviewers: 'design-team-lead'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Comment on PR
        if: steps.sync.outputs.has-changes == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = '${{ steps.sync.outputs.pr-number }}';
            if (prNumber) {
              github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: parseInt(prNumber),
                body: '🎨 Design specs have been updated. Please review the changes.'
              });
            }
```

## Programmatic Usage

Use the core library for custom integrations:

```typescript
import { 
  runSentinel, 
  parseDirectives, 
  fetchNodes,
  loadConfig 
} from '@khoavhd/figma-sentinel-core';

// Run the full sync workflow
const result = await runSentinel({
  configPath: './figma-sentinel.config.js',
  cwd: process.cwd(),
  dryRun: false,
});

console.log(`Changes detected: ${result.changeResult?.hasChanges}`);

// Or use individual modules
const directives = await parseDirectives(['src/**/*.tsx']);
const { config } = await loadConfig();
```

### Variables API (Enterprise)

```typescript
import {
  fetchVariables,
  parseVariablesDirectivesSync,
  normalizeVariableCollection,
  detectVariableChanges,
  generateVariableChangelogMarkdown
} from '@khoavhd/figma-sentinel-core';

// Fetch variables from a Figma file
const result = await fetchVariables('YOUR_FILE_KEY', ['Colors', 'Spacing']);

// Or parse directives from source files
const directives = parseVariablesDirectivesSync(['src/**/*.tsx']);

// Normalize for storage/comparison
for (const collection of result.collections) {
  const normalized = normalizeVariableCollection(
    collection,
    result.variables,
    'file-key',
    'source-file.ts'
  );
  console.log(`Collection: ${normalized.name}, Variables: ${normalized.variables.length}`);
}

// Detect changes between old and new specs
const changes = detectVariableChanges(oldSpecs, newSpecs);
if (changes.hasChanges) {
  const entries = generateVariableChangelogEntries(oldSpecs, newSpecs, changes);
  const markdown = generateVariableChangelogMarkdown(entries);
  console.log(markdown);
}
```

## Output Structure

After running `figma-sentinel sync`, your `.design-specs` directory will contain:

```
.design-specs/
├── CHANGELOG.md          # Human-readable changelog
├── PR_BODY.md            # Generated PR description
├── src/
│   └── components/
│       └── Button.tsx/
│           ├── 1-23.json          # Normalized node spec
│           ├── 1-23.png           # Node preview image
│           ├── 1-23.previous.png  # Previous version (if changed)
│           └── 1-45.json
└── ...
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © [duckhoa-uit](https://github.com/duckhoa-uit)
