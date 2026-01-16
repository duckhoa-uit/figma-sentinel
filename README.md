# Figma Sentinel

[![npm version](https://img.shields.io/npm/v/@khoavhd/figma-sentinel-core.svg)](https://www.npmjs.com/package/@khoavhd/figma-sentinel-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> Automated design change tracking and synchronization from Figma to your codebase

Figma Sentinel is a directive-driven tool that monitors Figma designs referenced in your source code, detects changes, and creates automated pull requests with detailed changelogs. It bridges the gap between design and development by keeping your codebase in sync with Figma.

## Features

- **Directive-Based Tracking**: Reference Figma nodes directly in source code comments
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
