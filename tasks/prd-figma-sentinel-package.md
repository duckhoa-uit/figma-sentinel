# PRD: Figma Sentinel - Standalone Package & GitHub Action

## Introduction

Figma Sentinel is a directive-driven design synchronization tool that automatically tracks Figma design nodes referenced in code and creates pull requests when designs change. This PRD outlines the extraction of the existing implementation from a project-specific script into a reusable npm package and GitHub Action that can be adopted across multiple projects.

The tool solves a critical problem for design/frontend teams: keeping code in sync with Figma designs by detecting visual changes, generating human-readable changelogs with before/after comparisons, and automating PR creation for developer review.

**Current State:** Embedded in `playaz4playaz-mobile/scripts/figma-sentinel/`
**Target State:** Standalone npm package + GitHub Action on npm registry and GitHub Marketplace

## Goals

- Publish a production-ready npm package (`figma-sentinel`) with CLI and programmatic API
- Create a native GitHub Action (`figma-sentinel-action`) for seamless CI/CD integration
- Maintain 100% feature parity with current implementation
- Support multiple configuration sources (config files, `package.json`)
- Achieve zero-friction adoption for new projects (< 5 minutes setup)
- Comprehensive documentation with examples for common use cases

## User Stories

### US-001: Initialize package repository structure
**Description:** As a maintainer, I want a well-organized monorepo structure so that CLI, core library, and GitHub Action can share code efficiently.

**Acceptance Criteria:**
- [ ] Create monorepo with `packages/core`, `packages/cli`, `packages/action` structure
- [ ] Configure pnpm workspaces or npm workspaces
- [ ] Set up shared TypeScript configuration with project references
- [ ] Configure ESLint and Prettier with shared rules
- [ ] Add root-level scripts for build, test, lint across all packages
- [ ] Typecheck passes

---

### US-002: Extract core library package
**Description:** As a developer, I want a standalone core library so that I can use Figma Sentinel programmatically in custom tooling.

**Acceptance Criteria:**
- [ ] Create `@aspect-build/figma-sentinel-core` or `figma-sentinel` package
- [ ] Export all core functions: `runSentinel`, `parseDirectives`, `fetchNodes`, `detectChanges`, `generateChangelog`
- [ ] Export all TypeScript types for consumer type safety
- [ ] Zero runtime dependencies where possible (use native fetch, crypto)
- [ ] Support both ESM and CommonJS output
- [ ] Add comprehensive JSDoc comments for all public APIs
- [ ] Typecheck passes

---

### US-003: Create CLI package with shadcn-style UX
**Description:** As a developer, I want to run `npx figma-sentinel` with an elegant CLI experience similar to shadcn/ui.

**Acceptance Criteria:**
- [ ] Create CLI package with `bin` entry pointing to executable
- [ ] Implement commands using `commander`:
  - `figma-sentinel init` - Interactive setup with `prompts`
  - `figma-sentinel sync` - Main workflow with `ora` spinners
  - `figma-sentinel check` - Dry-run validation
- [ ] Add flags: `--dry-run`, `--config`, `--cwd`, `--verbose`, `--quiet`
- [ ] Display colorized output with `kleur` (success/error/warning)
- [ ] Show progress spinners during Figma API calls and file operations
- [ ] Interactive `init` prompts for: config format, specs directory, file patterns
- [ ] Exit code 0 for success, 1 for errors
- [ ] Typecheck passes

---

### US-004: Support flexible configuration with cosmiconfig
**Description:** As a developer, I want to configure Figma Sentinel using my preferred config format so that it fits my project's conventions.

**Acceptance Criteria:**
- [ ] Use `cosmiconfig` for config discovery with module name `figma-sentinel`
- [ ] Support all cosmiconfig formats automatically:
  - `figma-sentinel.config.js` / `.cjs` / `.mjs`
  - `.figma-sentinelrc` (JSON/YAML)
  - `.figma-sentinelrc.json` / `.yaml` / `.yml` / `.js` / `.cjs`
  - `package.json` under `"figma-sentinel"` key
- [ ] Implement configuration precedence: CLI flags > env vars > cosmiconfig > defaults
- [ ] Cache config discovery for performance
- [ ] Validate configuration with Zod schema and clear error messages
- [ ] Document all configuration options in README
- [ ] Typecheck passes

---

### US-005: Create native GitHub Action
**Description:** As a DevOps engineer, I want to add Figma Sentinel to my workflow with a simple action reference so that design sync runs automatically.

**Acceptance Criteria:**
- [ ] Create `action.yml` with proper metadata and branding
- [ ] Support inputs: `figma-token`, `config-path`, `dry-run`, `create-pr`, `pr-title`, `pr-labels`
- [ ] Support outputs: `has-changes`, `changelog-path`, `pr-number`, `pr-url`
- [ ] Use composite action or JavaScript action pattern
- [ ] Handle PR creation with customizable title, body, labels, reviewers
- [ ] Support running on schedule, push, and workflow_dispatch triggers
- [ ] Auto-detect and install Node.js if needed
- [ ] Typecheck passes

---

### US-006: Implement PR creation logic in action
**Description:** As a team lead, I want automatic PRs created when designs change so that my team is notified and can review changes.

**Acceptance Criteria:**
- [ ] Create PR with dynamically generated body from `PR_BODY.md`
- [ ] Include summary table (added/changed/removed counts)
- [ ] Support configurable PR title (default: "🎨 Design Specs Updated")
- [ ] Support configurable labels (default: `["design-sync", "automated"]`)
- [ ] Support configurable reviewers and team reviewers
- [ ] Update existing PR if one already exists for the branch
- [ ] Skip PR creation if no changes detected
- [ ] Typecheck passes

---

### US-007: Add comprehensive test suite
**Description:** As a maintainer, I want comprehensive tests so that I can confidently release updates without regressions.

**Acceptance Criteria:**
- [ ] Migrate existing tests from source repository
- [ ] Add unit tests for all core modules (>80% coverage)
- [ ] Add integration tests for CLI commands
- [ ] Add E2E tests for GitHub Action using act or workflow dispatch
- [ ] Mock Figma API responses for deterministic testing
- [ ] Set up GitHub Actions CI pipeline for tests on PR
- [ ] Typecheck passes

---

### US-008: Create documentation and examples
**Description:** As a new user, I want clear documentation so that I can set up Figma Sentinel in my project quickly.

**Acceptance Criteria:**
- [ ] Write comprehensive README with quick start guide
- [ ] Document all configuration options with examples
- [ ] Add example workflow files for common scenarios (scheduled, PR-triggered)
- [ ] Create CONTRIBUTING.md for contributors
- [ ] Add CHANGELOG.md with semantic versioning
- [ ] Include troubleshooting section for common issues
- [ ] Add architecture diagram using Mermaid
- [ ] Typecheck passes

---

### US-009: Implement versioning and release automation
**Description:** As a maintainer, I want automated releases so that publishing new versions is consistent and error-free.

**Acceptance Criteria:**
- [ ] Set up changesets or semantic-release for version management
- [ ] Configure GitHub Actions workflow for automated npm publishing
- [ ] Configure GitHub Actions workflow for automated GitHub Action releases
- [ ] Tag releases with proper semver (v1.0.0, v1.0.1, etc.)
- [ ] Generate release notes from commits/changesets
- [ ] Publish to npm registry with provenance
- [ ] Typecheck passes

---

### US-010: Add telemetry opt-in and error reporting
**Description:** As a maintainer, I want optional anonymous usage telemetry so that I can understand how the tool is used and prioritize improvements.

**Acceptance Criteria:**
- [ ] Add opt-in telemetry (disabled by default)
- [ ] Track only anonymous usage metrics (command used, success/failure, node count)
- [ ] Never collect file contents, tokens, or PII
- [ ] Provide `--no-telemetry` flag and `FIGMA_SENTINEL_TELEMETRY=false` env var
- [ ] Document telemetry in README with transparency
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The CLI must read Figma directives (`@figma-file`, `@figma-node`) from source files matching configured glob patterns
- FR-2: The CLI must fetch node data from Figma REST API with retry logic and rate limit handling
- FR-3: The CLI must normalize Figma node data by removing volatile properties (position, timestamps) to prevent false positives
- FR-4: The CLI must detect added, changed, and removed design nodes by comparing content hashes
- FR-5: The CLI must export PNG images of changed nodes with before/after comparison
- FR-6: The CLI must generate `DESIGN_CHANGELOG.md` with human-readable diff including images
- FR-7: The CLI must generate `PR_BODY.md` suitable for GitHub PR descriptions
- FR-8: The CLI must optionally export LLM-optimized Markdown specs per node
- FR-9: The GitHub Action must create/update PRs when changes are detected
- FR-10: The GitHub Action must support scheduled, push, and manual triggers
- FR-11: Configuration must be loadable from multiple sources with clear precedence
- FR-12: All operations must support dry-run mode for safe testing

## Non-Goals (Out of Scope)

- **Figma plugin development** - This is a Node.js/CI tool, not a Figma plugin
- **Bidirectional sync** - We only sync Figma → Code, not Code → Figma
- **Design token extraction** - We track visual changes, not token values (use Tokens Studio for that)
- **Real-time sync** - This is batch/CI-based, not live webhook-driven
- **Support for non-React frameworks** - Directive syntax works anywhere, but examples focus on React/TSX
- **Visual regression testing** - We detect Figma changes, not screenshot comparison of rendered UI
- **Figma Variables API integration** - Focus on node properties, not Variables REST API

## Technical Considerations

### Package Structure
```
figma-sentinel/
├── packages/
│   ├── core/                 # Shared library (figma-sentinel)
│   │   ├── src/
│   │   │   ├── index.ts      # Main exports
│   │   │   ├── parser.ts
│   │   │   ├── figma-client.ts
│   │   │   ├── normalizer.ts
│   │   │   ├── storage.ts
│   │   │   ├── differ.ts
│   │   │   ├── image-exporter.ts
│   │   │   └── markdown-exporter.ts
│   │   └── package.json
│   ├── cli/                  # CLI wrapper (figma-sentinel-cli)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── commands/
│   │   └── package.json
│   └── action/               # GitHub Action
│       ├── action.yml
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── test-action.yml
├── examples/
│   ├── basic-setup/
│   └── monorepo-setup/
├── docs/
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### Naming Recommendation
Given the tool's purpose and personal scope:
- **npm packages:** 
  - `@khoavhd/figma-sentinel` (core + CLI combined)
  - `@khoavhd/figma-sentinel-action` (GitHub Action)
- **CLI command:** `figma-sentinel` or `fgsen` (short alias)
- **GitHub Action:** `khoavhd/figma-sentinel-action`
- **License:** MIT

### CLI Stack (Following shadcn/ui Pattern)

| Category | Package | Purpose |
|----------|---------|---------|
| **Argument parsing** | `commander` | Command and flag parsing |
| **Interactive prompts** | `prompts` | User input prompts for `init` command |
| **Spinners** | `ora` | Elegant terminal spinners for async operations |
| **Colors** | `kleur` | Terminal styling (tiny, fast, no deps) |
| **File system** | `fs-extra` | Enhanced fs operations (copy, ensure, etc.) |
| **Process execution** | `execa` | Run shell commands cleanly |
| **Glob matching** | `fast-glob` | File pattern matching (already used) |
| **Config loading** | `cosmiconfig` | Multi-source config discovery |

### Dependencies by Package

**@figma-sentinel/core:**
- `fast-glob` - File pattern matching
- `zod` - Schema validation for config and API responses
- Native `fetch` - HTTP requests (Node 18+)
- Native `crypto` - Hashing

**@figma-sentinel/cli:**
- `commander` - CLI framework
- `prompts` - Interactive prompts
- `ora` - Spinners
- `kleur` - Colors
- `cosmiconfig` - Config loading (package.json, .rc, .config.js)
- `fs-extra` - File operations
- `execa` - Shell command execution

**@figma-sentinel/action:**
- `@actions/core` - GitHub Action toolkit
- `@actions/github` - GitHub API client
- `@actions/exec` - Command execution

### Compatibility
- Node.js 18+ (for native fetch)
- Works with any file type containing comments (TSX, JSX, Vue, Svelte, Swift, Kotlin)
- GitHub Actions runner: ubuntu-latest, macos-latest, windows-latest

## Success Metrics

- Package downloaded 100+ times in first month
- Zero critical bugs reported in first 2 weeks
- Setup time < 5 minutes for new projects (measured via documentation feedback)
- GitHub Action runs successfully on first try for 90%+ of adopters
- Positive feedback from 3+ teams using it in production

## Open Questions - Resolved

1. ~~Should we support a `.figmasentinelignore` file?~~ **No** - Out of scope for initial release
2. ~~PR changelog as comment vs body?~~ **Body only** - Keep it simple
3. ~~Add `figma-sentinel diff <node-id>` command?~~ **Yes** - Added as US-016
4. ~~Figma Variables API integration?~~ **Yes** - Added as US-026 (future enhancement)
5. ~~Preferred license?~~ **MIT**
6. ~~npm scope?~~ **@khoavhd** (personal scope)
