# @khoavhd/figma-sentinel-core

## 1.2.0

### Minor Changes

- 3b2ae7d: feat: Improved Figma API Error Handling & User Notification System

  ## New Features
  - **Typed Error Classes**: Added `FigmaSentinelError` base class and specific subclasses (`FigmaRateLimitError`, `FigmaAuthenticationError`, `FigmaNotFoundError`, `FigmaServerError`, `FigmaValidationError`, `FigmaNetworkError`) with rich metadata
  - **Retry-After Support**: Rate limit retries now respect Figma's `Retry-After` header instead of fixed exponential backoff
  - **Rate Limit Headers**: Extract and surface `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, and `X-Figma-Upgrade-Link` headers
  - **Concurrency Control**: Added `p-limit` based concurrency control with configurable `api.concurrency` option (default: 5)
  - **Unified Logger**: New `Logger` interface with `ConsoleLogger` implementation for consistent logging
  - **Actionable Error Messages**: Context-aware error messages with specific guidance for each error code (400, 401, 403, 404, 429, 500)
  - **Error Event System**: New `ErrorEventEmitter` for future notification integrations (Slack, Telegram, Discord)
  - **Fail-Fast Behavior**: Execution stops immediately on first error with clear context
  - **CLI Improvements**: Added `--verbose` flag for debug output, color-coded error messages
  - **Action Improvements**: Added `error-count` and `error-details` outputs

  ## Configuration

  New API configuration options:

  ```typescript
  {
    api: {
      maxRetries: 3,        // Max retry attempts
      maxRetryDelayMs: 3600000,  // Max wait time (1 hour)
      concurrency: 5        // Concurrent requests
    }
  }
  ```

## 1.1.0

### Minor Changes

- b3514d4: feat: add `link` command for interactive project setup
  - New `sentinel link` command to interactively configure Figma projects
  - Prompts for Figma file URL, output directory, and export options
  - Automatically creates or updates sentinel.config.json

## 2.0.0

### Major Changes

- 70b7fa8: # 🎨 Figma Sentinel v1.0.0 - Initial Release

  Automated design change tracking and synchronization from Figma to your codebase.

  ## Features

  ### Core Library (`@khoavhd/figma-sentinel-core`)
  - **Directive Parser**: Extract `@figma-file` and `@figma-node` directives from source files
  - **Figma API Client**: Fetch node data with retry logic and rate limit handling
  - **Node Normalizer**: Remove volatile properties to prevent false positive changes
  - **Change Detection**: Detect added, modified, and removed design nodes
  - **Image Exporter**: Export node previews as PNG with before/after comparison
  - **Markdown Exporter**: Generate LLM-optimized design specs
  - **Changelog Generator**: Create human-readable changelogs and PR bodies
  - **Variables API**: Support for Figma Variables (Enterprise)

  ### CLI (`@khoavhd/figma-sentinel`)
  - `figma-sentinel sync` - Scan and sync design changes
  - `figma-sentinel check` - Validate setup without fetching
  - `figma-sentinel init` - Interactive configuration wizard
  - `figma-sentinel diff <node-id>` - Debug specific node changes
  - `figma-sentinel variables` - Fetch Figma Variables

  ### GitHub Action (`@khoavhd/figma-sentinel-action`)
  - Automated design sync in CI/CD pipelines
  - Automatic PR creation with changelogs
  - Support for scheduled, push, and manual triggers
  - Configurable PR title, labels, and reviewers
