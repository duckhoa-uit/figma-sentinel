# @khoavhd/figma-sentinel

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

### Patch Changes

- Updated dependencies [70b7fa8]
  - @khoavhd/figma-sentinel-core@2.0.0
