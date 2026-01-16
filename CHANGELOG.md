# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Figma Sentinel
- Core library (`@khoavhd/figma-sentinel-core`) with:
  - Figma API client for fetching nodes
  - Directive parser for extracting `@figma` comments from source files
  - Node normalizer for consistent property extraction
  - Storage system for persisting design specs
  - Change detection and diff generation
  - Image exporter for capturing node screenshots
  - Markdown exporter for LLM-optimized specs
  - Configuration validation with Zod
- CLI tool (`@khoavhd/figma-sentinel`) with commands:
  - `sync` - Detect and sync design changes
  - `check` - Validate setup without making changes
  - `init` - Interactive project setup
  - `diff` - Debug specific node changes
- GitHub Action (`@khoavhd/figma-sentinel-action`) with:
  - Automated design sync in CI
  - Automatic PR creation for changes
  - Configurable options for dry-run, labels, reviewers
