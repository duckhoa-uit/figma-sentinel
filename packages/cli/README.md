# @khoavhd/figma-sentinel

[![npm version](https://img.shields.io/npm/v/@khoavhd/figma-sentinel.svg)](https://www.npmjs.com/package/@khoavhd/figma-sentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> CLI for Figma Sentinel - Automated design change tracking and synchronization from Figma to your codebase

## Installation

```bash
# Run directly with npx (no install required)
npx @khoavhd/figma-sentinel sync

# Or install globally
npm install -g @khoavhd/figma-sentinel
pnpm add -g @khoavhd/figma-sentinel

# Verify installation
figma-sentinel --version
```

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

### 2. Set Up Figma Token

```bash
export FIGMA_TOKEN="your-figma-personal-access-token"
```

Get your token from [Figma Account Settings](https://www.figma.com/developers/api#access-tokens).

### 3. Initialize Configuration

```bash
figma-sentinel init
```

### 4. Run Sync

```bash
figma-sentinel sync
```

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

### `figma-sentinel check`

Validate your setup without fetching from Figma.

```bash
figma-sentinel check [options]

Options:
  --cwd <dir>       Set working directory
  --config <path>   Path to config file
```

### `figma-sentinel init`

Initialize Figma Sentinel with an interactive wizard.

```bash
figma-sentinel init [options]

Options:
  --cwd <dir>       Set working directory
```

### `figma-sentinel diff <node-id>`

Debug and compare a specific node's current and stored state.

```bash
figma-sentinel diff <node-id> [options]

Options:
  --file-key <key>  Figma file key (required)
  --cwd <dir>       Set working directory
  --config <path>   Path to config file
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

## Configuration

Create `figma-sentinel.config.js` in your project root:

```js
module.exports = {
  filePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],
  excludePatterns: ['node_modules/**', '**/*.test.tsx'],
  specsDir: '.design-specs',
  exportImages: true,
  imageScale: 2,
  outputFormat: 'json',
};
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@khoavhd/figma-sentinel-core`](https://www.npmjs.com/package/@khoavhd/figma-sentinel-core) | Core library for programmatic use |
| [`@khoavhd/figma-sentinel-action`](https://github.com/duckhoa-uit/figma-sentinel) | GitHub Action wrapper |

## Documentation

For complete documentation, see the [main repository](https://github.com/duckhoa-uit/figma-sentinel).

## License

MIT © [duckhoa-uit](https://github.com/duckhoa-uit)
