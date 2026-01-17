# PRD: Link Command - Add Figma Directives from URL

## Introduction

Add a `link` command to figma-sentinel CLI that allows users to add Figma directives (`@figma-file`, `@figma-node`) to source files by providing a Figma URL instead of manually typing the directives. This improves developer experience by eliminating the need to manually parse Figma URLs and copy file keys/node IDs.

This feature follows established CLI patterns from popular tools:
- **Vercel CLI** (`vercel link`): Links local directories to remote projects
- **Supabase CLI** (`supabase link`): Connects local projects to remote databases  
- **shadcn CLI** (`shadcn add`): Adds components with `-y/--yes`, `-o/--overwrite`, `-p/--path` flags
- **Storybook Connect**: Links Figma components to stories via URL pasting

## Goals

- Allow users to link Figma designs to source files using a simple CLI command
- Parse Figma URLs and extract file keys and node IDs automatically
- Insert directives at the top of target source files
- Handle existing directives gracefully with user confirmation
- Support batch linking for multiple files
- Integrate with the `init` command for guided setup
- Follow industry-standard CLI conventions (`--yes`, `--force`, `--path`)

## User Stories

### US-001: Parse Figma Design URL
**Description:** As a developer, I want the CLI to parse a Figma design URL so that I don't have to manually extract the file key and node ID.

**Acceptance Criteria:**
- [ ] Parse standard Figma design URLs: `https://www.figma.com/design/<fileKey>/<fileName>?node-id=<nodeId>`
- [ ] Extract `fileKey` from URL path
- [ ] Extract `nodeId` from URL query parameter (if present)
- [ ] Handle URL-encoded node IDs (e.g., `1-23` or `1%3A23`)
- [ ] Return clear error for invalid/unsupported URL formats
- [ ] Typecheck passes

### US-002: Basic Link Command
**Description:** As a developer, I want to run `figma-sentinel link <url> --file <path>` so that directives are automatically added to my source file.

**Acceptance Criteria:**
- [ ] Command accepts Figma URL as first positional argument (optional - prompts if missing)
- [ ] Command accepts `--file` or `-f` option for target file path
- [ ] Command accepts `--path` or `-p` as alias for `--file` (shadcn convention)
- [ ] Inserts `// @figma-file: <fileKey>` at top of file
- [ ] Inserts `// @figma-node: <nodeId>` below file directive (if node ID present in URL)
- [ ] Preserves all existing file content below inserted directives
- [ ] Shows success message with file path and linked node (similar to shadcn output style)
- [ ] **If URL has no node ID**: Show warning that file won't be tracked until nodes are added
- [ ] Typecheck passes

**Example Usage:**
```bash
# Full command
figma-sentinel link "https://figma.com/design/ABC123/MyFile?node-id=1-23" -f src/Button.tsx

# With path alias (shadcn style)
figma-sentinel link "https://figma.com/design/ABC123/MyFile?node-id=1-23" -p src/Button.tsx

# Interactive mode (no URL provided)
figma-sentinel link -f src/Button.tsx
# Prompts: "Enter Figma URL:"

# URL without node ID - shows warning
figma-sentinel link "https://figma.com/design/ABC123/MyFile" -f src/Button.tsx
# Output: ⚠ Warning: No node ID in URL. File linked but won't be tracked until you add @figma-node directives.
```

### US-003: Validate URL Format
**Description:** As a developer, I want the CLI to validate the Figma URL format so that I catch mistakes before modifying files.

**Acceptance Criteria:**
- [ ] Validate URL is a valid Figma design URL
- [ ] Check URL contains valid file key format
- [ ] Check node ID format is valid (if present)
- [ ] Display clear error message for invalid URLs
- [ ] Do not make API calls for validation
- [ ] Typecheck passes

### US-004: Handle Existing Directives with Confirmation
**Description:** As a developer, I want to be prompted when a file already has directives so that I don't accidentally overwrite them.

**Acceptance Criteria:**
- [ ] Detect existing `@figma-file` directive in target file
- [ ] Detect existing `@figma-node` directive(s) in target file
- [ ] Prompt user with options: "Add node to existing", "Replace all", "Cancel"
- [ ] "Add node" appends new `@figma-node` line (only if same file key)
- [ ] "Replace" removes old directives and inserts new ones at top
- [ ] "Cancel" aborts without modifying file
- [ ] Show warning if file keys don't match when adding node
- [ ] Support `--yes` or `-y` flag to auto-confirm with default action (Vercel/shadcn convention)
- [ ] Support `--force` flag to skip confirmation and replace (shadcn `--overwrite` pattern)
- [ ] Typecheck passes

**Example Usage:**
```bash
# Skip confirmation prompts (auto-add if compatible, else replace)
figma-sentinel link <url> -f src/Button.tsx --yes

# Force replace existing directives
figma-sentinel link <url> -f src/Button.tsx --force
```

### US-005: Batch Link Multiple Files
**Description:** As a developer, I want to link multiple source files at once so that I can set up directives efficiently.

**Acceptance Criteria:**
- [ ] Support multiple `--file` arguments: `link <url> -f file1.tsx -f file2.tsx`
- [ ] Process each file independently
- [ ] Show progress for each file
- [ ] Continue processing remaining files if one fails
- [ ] Display summary: success count, failure count, skipped count
- [ ] Typecheck passes

### US-006: Interactive Mode
**Description:** As a developer, I want an interactive mode when no file is specified so that I can select files easily.

**Acceptance Criteria:**
- [ ] When `--file` not provided, enter interactive mode
- [ ] Prompt user to enter/paste Figma URL if not provided
- [ ] Check clipboard for Figma URL and offer to use it (if simple to implement)
- [ ] Show file picker or prompt for file path
- [ ] Validate inputs before proceeding
- [ ] Allow user to link additional files after first one
- [ ] Typecheck passes

### US-007: Integrate with Init Command
**Description:** As a developer, I want the init command to optionally help me link my first file so that setup is streamlined.

**Acceptance Criteria:**
- [ ] Add optional step to `init` command after config creation
- [ ] Ask "Would you like to link a Figma file now?"
- [ ] If yes, prompt for Figma URL and target file
- [ ] Use same linking logic as `link` command
- [ ] Typecheck passes

### US-008: Support Comment Style Detection
**Description:** As a developer, I want directives to use the appropriate comment style for the file type.

**Acceptance Criteria:**
- [ ] Use `//` for `.ts`, `.tsx`, `.js`, `.jsx`, `.swift`, `.kt`, `.go`, `.rs`
- [ ] Use `#` for `.py`, `.rb`, `.sh`, `.yaml`, `.yml`
- [ ] Use `/* */` for `.css`, `.scss`, `.less`
- [ ] Use `<!-- -->` for `.html`, `.vue`, `.svelte`
- [ ] Default to `//` for unknown extensions
- [ ] Typecheck passes

### US-009: Update README Documentation
**Description:** As a developer, I want the README to document the new `link` command so that I can discover and learn how to use it.

**Acceptance Criteria:**
- [ ] Add `figma-sentinel link` section to CLI Commands in README.md
- [ ] Include command syntax, options, and examples
- [ ] Update Quick Start section to show `link` as alternative to manual directives
- [ ] Add link command to the features list
- [ ] Typecheck passes (if any code examples)

**README Section to Add (after `### figma-sentinel variables`):**

```markdown
### `figma-sentinel link`

Link a Figma design to a source file by automatically adding directives from a Figma URL.

\`\`\`bash
figma-sentinel link [url] [options]

Options:
  -f, --file <path>   Target source file (required, can be repeated for batch)
  -p, --path <path>   Alias for --file
  -y, --yes           Skip confirmation prompts
  --force             Replace existing directives without confirmation
  -c, --cwd <dir>     Set working directory
\`\`\`

**Examples:**
\`\`\`bash
# Link a Figma node to a component file
figma-sentinel link "https://figma.com/design/ABC123/MyFile?node-id=1-23" -f src/Button.tsx

# Interactive mode (prompts for URL)
figma-sentinel link -f src/Button.tsx

# Link multiple files to the same design
figma-sentinel link "https://figma.com/design/ABC123/MyFile?node-id=1-23" -f src/Button.tsx -f src/Button.test.tsx

# Force replace existing directives
figma-sentinel link "https://figma.com/design/XYZ789/NewFile?node-id=4-56" -f src/Button.tsx --force
\`\`\`

**How it works:**
1. Paste a Figma URL (right-click any node → "Copy link")
2. The CLI extracts the file key and node ID automatically
3. Directives are inserted at the top of your source file:
   \`\`\`tsx
   // @figma-file: ABC123
   // @figma-node: 1-23
   
   export function Button() { ... }
   \`\`\`
```

**Quick Start Section Update:**

Add after step 1 ("Add Figma Directives to Your Code"):

```markdown
**Tip:** Use the `link` command to add directives automatically:
\`\`\`bash
figma-sentinel link "https://figma.com/design/ABC123/..." -f src/components/Button.tsx
\`\`\`
```

**Features List Update:**

Add to the Features section:
```markdown
- **Easy Linking**: Add directives from Figma URLs with `figma-sentinel link`
```

## Functional Requirements

- FR-1: The `link` command must accept a Figma URL as an optional positional argument
- FR-2: The `link` command must accept target files via `--file/-f` or `--path/-p` options
- FR-3: The system must parse Figma design URLs and extract file key and optional node ID
- FR-4: The system must validate URL format without making API calls
- FR-5: The system must insert directive comments at the very top of the target file
- FR-6: The system must detect existing directives and prompt for user confirmation
- FR-7: The system must support `--yes/-y` flag to auto-confirm default actions
- FR-8: The system must support `--force` flag to skip confirmation and replace
- FR-9: The system must use appropriate comment syntax based on file extension
- FR-10: The system must display clear success/error messages (shadcn-style output)
- FR-11: The `init` command must offer optional linking step after config creation
- FR-12: The system must support `--cwd` flag for working directory (Vercel convention)
- FR-13: **If URL has no node ID, show warning that file won't be tracked by `sync` command until `@figma-node` directives are added**

## Non-Goals

- No support for FigJam, prototype, or other non-design Figma URLs
- No Figma API validation (checking if file/node actually exists)
- No automatic file discovery (user must specify target files)
- No removal of directives / `unlink` command (users can manually remove)
- No support for `@figma-variables` directive (separate feature)
- No `--dry-run` flag (users can review changes in git)

## Technical Considerations

- Reuse existing URL parsing patterns from the codebase if available
- Use `prompts` library (already a dependency) for interactive prompts
- Follow existing CLI command structure (see `init.ts`, `sync.ts`)
- Add new command in `packages/cli/src/commands/link.ts`
- Export URL parser utilities from `packages/core` for reuse
- Consider adding URL parser to core package for potential use in other tools
- Use `commander.js` patterns consistent with shadcn CLI (already used in project)
- Output formatting should match existing CLI style (kleur, ora spinners)

## CLI Flag Summary (Industry Standards)

| Flag | Alias | Description | Source |
|------|-------|-------------|--------|
| `--file` | `-f` | Target file path | figma-sentinel |
| `--path` | `-p` | Alias for --file | shadcn |
| `--yes` | `-y` | Skip confirmation prompts | Vercel, shadcn |
| `--force` | | Overwrite existing directives | shadcn (`--overwrite`) |
| `--cwd` | `-c` | Working directory | Vercel, shadcn |

## Success Metrics

- Users can link a Figma design to a file in under 10 seconds
- Zero manual copying of file keys or node IDs required
- Clear feedback on success/failure for each file processed
- No accidental overwrites due to confirmation prompts

## Test Cases

Tests should be placed in `packages/core/src/__tests__/` and `packages/cli/src/__tests__/` following existing patterns (Vitest, `*.test.ts`).

### Test Coverage Matrix

| Requirement | Test Suite | Covered |
|-------------|------------|---------|
| US-001: Parse Figma URL | TC-001 | ✅ |
| US-002: Basic link command | TC-003, TC-005, TC-008 | ✅ |
| US-003: Validate URL format | TC-001 | ✅ |
| US-004: Handle existing directives | TC-004, TC-006 | ✅ |
| US-005: Batch link | TC-005, TC-008 | ✅ |
| US-006: Interactive mode | TC-009 | ✅ |
| US-007: Init integration | TC-010 | ✅ |
| US-008: Comment style detection | TC-002 | ✅ |
| FR-1: URL as positional arg | TC-005 | ✅ |
| FR-2: --file/-f and --path/-p | TC-005 | ✅ |
| FR-7: --yes/-y flag | TC-005, TC-006 | ✅ |
| FR-8: --force flag | TC-005, TC-006 | ✅ |
| FR-12: --cwd flag | TC-005 | ✅ |
| FR-13: Warning for no node ID | TC-008 | ✅ |

### TC-001: URL Parser Tests (`packages/core/src/__tests__/url-parser.test.ts`)

**Covers:** US-001, US-003, FR-3, FR-4

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Parse valid design URL with node | `https://www.figma.com/design/ABC123/MyFile?node-id=1-23` | `{ fileKey: 'ABC123', nodeId: '1-23' }` |
| Parse valid design URL without node | `https://www.figma.com/design/ABC123/MyFile` | `{ fileKey: 'ABC123', nodeId: null }` |
| Parse legacy file URL with node | `https://www.figma.com/file/ABC123/MyFile?node-id=1-23` | `{ fileKey: 'ABC123', nodeId: '1-23' }` |
| Parse legacy file URL without node | `https://www.figma.com/file/ABC123/MyFile` | `{ fileKey: 'ABC123', nodeId: null }` |
| Parse URL-encoded node ID | `https://www.figma.com/design/ABC123/MyFile?node-id=1%3A23` | `{ fileKey: 'ABC123', nodeId: '1:23' }` |
| Parse URL with extra query params | `https://www.figma.com/design/ABC123/MyFile?node-id=1-23&t=abc` | `{ fileKey: 'ABC123', nodeId: '1-23' }` |
| Reject invalid URL (not Figma) | `https://example.com/design/ABC123` | `Error: Invalid Figma URL` |
| Reject FigJam URL | `https://www.figma.com/board/ABC123/MyBoard` | `Error: FigJam URLs not supported` |
| Reject prototype URL | `https://www.figma.com/proto/ABC123/MyProto` | `Error: Prototype URLs not supported` |
| Reject malformed URL | `not-a-url` | `Error: Invalid URL format` |

### TC-002: Comment Style Detection Tests (`packages/core/src/__tests__/comment-style.test.ts`)

**Covers:** US-008, FR-9

| Test Case | File Extension | Expected Comment Style |
|-----------|----------------|------------------------|
| TypeScript file | `.ts` | `// @figma-file: ...` |
| TSX file | `.tsx` | `// @figma-file: ...` |
| JavaScript file | `.js` | `// @figma-file: ...` |
| JSX file | `.jsx` | `// @figma-file: ...` |
| Python file | `.py` | `# @figma-file: ...` |
| Ruby file | `.rb` | `# @figma-file: ...` |
| Shell script | `.sh` | `# @figma-file: ...` |
| YAML file | `.yaml` | `# @figma-file: ...` |
| CSS file | `.css` | `/* @figma-file: ... */` |
| SCSS file | `.scss` | `/* @figma-file: ... */` |
| HTML file | `.html` | `<!-- @figma-file: ... -->` |
| Vue file | `.vue` | `<!-- @figma-file: ... -->` |
| Svelte file | `.svelte` | `<!-- @figma-file: ... -->` |
| Unknown extension | `.xyz` | `// @figma-file: ...` (default) |

### TC-003: Directive Insertion Tests (`packages/core/src/__tests__/directive-inserter.test.ts`)

**Covers:** US-002, FR-5

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Insert into empty file | Empty `.tsx` file | File contains only directives |
| Insert into file with content | File with existing code | Directives at top, original content preserved below |
| Insert file + node directives | URL has node ID | Both `@figma-file` and `@figma-node` inserted |
| Insert file directive only | URL has no node ID | Only `@figma-file` inserted |
| Preserve file permissions | File with specific mode | File permissions unchanged after edit |
| Handle file with BOM | UTF-8 BOM file | BOM preserved, directives after BOM |

### TC-004: Existing Directive Detection Tests (`packages/core/src/__tests__/directive-detector.test.ts`)

**Covers:** US-004, FR-6

| Test Case | File Content | Expected Detection |
|-----------|--------------|-------------------|
| Detect existing file directive | `// @figma-file: XYZ789` | `{ hasFileDirective: true, fileKey: 'XYZ789' }` |
| Detect existing node directives | `// @figma-node: 1-23\n// @figma-node: 4-56` | `{ nodeIds: ['1-23', '4-56'] }` |
| No directives present | `const x = 1;` | `{ hasFileDirective: false, nodeIds: [] }` |
| Directive in block comment | `/* @figma-file: ABC */` | `{ hasFileDirective: true, fileKey: 'ABC' }` |
| Directive in middle of file | Code before directive | Correctly detects directive location |

### TC-005: Link Command Integration Tests (`packages/cli/src/__tests__/link.test.ts`)

**Covers:** US-002, US-005, FR-1, FR-2, FR-7, FR-8, FR-12

| Test Case | Command | Expected Behavior |
|-----------|---------|-------------------|
| Basic link command | `link <url> -f file.tsx` | Directives added, success message |
| Link with path alias | `link <url> -p file.tsx` | Same as `-f`, directives added |
| Missing file option | `link <url>` | Enters interactive mode or prompts for file |
| Non-existent file | `link <url> -f missing.tsx` | Error: File not found |
| Invalid URL | `link bad-url -f file.tsx` | Error: Invalid Figma URL |
| With --yes flag | `link <url> -f file.tsx --yes` | Skips confirmation, applies default |
| With --force flag | `link <url> -f file.tsx --force` | Replaces existing directives |
| With --cwd flag | `link <url> -f file.tsx --cwd ./src` | Resolves file path relative to cwd |
| Batch link | `link <url> -f a.tsx -f b.tsx` | Both files linked, summary shown |
| Partial batch failure | `link <url> -f a.tsx -f missing.tsx` | a.tsx linked, missing.tsx error, summary |

### TC-006: Conflict Resolution Tests (`packages/cli/src/__tests__/link-conflicts.test.ts`)

**Covers:** US-004, FR-6, FR-7, FR-8

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Same file key, add node | Existing `@figma-file: ABC`, new URL has ABC | Prompts to add node |
| Different file key | Existing `@figma-file: ABC`, new URL has XYZ | Prompts with warning, offers replace |
| --yes with same key | Same file key scenario + `--yes` | Auto-adds node without prompt |
| --yes with different key | Different file key + `--yes` | Auto-replaces without prompt |
| --force always replaces | Any existing directive + `--force` | Replaces without prompt |
| Cancel option | User selects cancel | File unchanged, exit code 0 |
| Node already exists | Adding duplicate node ID | Skips duplicate, shows info message |

### TC-007: Edge Cases Tests (`packages/core/src/__tests__/link-edge-cases.test.ts`)

**Covers:** Various edge cases, error handling

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| File with shebang | `#!/usr/bin/env node` at top | Directive inserted after shebang |
| File with pragma | `'use strict';` at top | Directive inserted before pragma |
| Read-only file | File without write permission | Error: Permission denied |
| Very large file | 10MB+ file | Handles efficiently, no memory issues |
| Binary file | `.png` file | Error: Cannot add directives to binary file |
| Symlinked file | Symlink to real file | Modifies real file, not symlink |
| File in .gitignore | Ignored file | Still links (no git awareness needed) |

### TC-008: Output Format Tests (`packages/cli/src/__tests__/link-output.test.ts`)

**Covers:** US-002, FR-10, FR-13

| Test Case | Scenario | Expected Output Pattern |
|-----------|----------|------------------------|
| Success single file | Link succeeds | `✔ Linked src/Button.tsx to ABC123 (node: 1-23)` |
| Success no node | Link without node ID | `✔ Linked src/Button.tsx to ABC123` + `⚠ Warning: No node ID. File won't be tracked until you add @figma-node directives.` |
| Error invalid URL | Bad URL provided | `✖ Invalid Figma URL: ...` |
| Error file not found | Missing file | `✖ File not found: src/Missing.tsx` |
| Error permission denied | Read-only file | `✖ Permission denied: src/ReadOnly.tsx` |
| Batch summary success | All files succeed | `✔ Linked 3 files successfully` |
| Batch summary mixed | Some succeed, some fail | `Linked 2 files, 1 failed, 1 skipped` |
| Batch with warnings | Some files without nodes | Summary includes warning count: `2 files linked (1 warning)` |
| Spinner during operation | Long operation | Shows spinner with status text |

### TC-009: Interactive Mode Tests (`packages/cli/src/__tests__/link-interactive.test.ts`)

**Covers:** US-006

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Prompt for URL | No URL provided | Prompts "Enter Figma URL:" |
| Prompt for file | No file provided | Prompts for file path |
| Clipboard detection | Figma URL in clipboard | Offers "Use URL from clipboard?" |
| Clipboard non-Figma | Non-Figma URL in clipboard | Does not offer clipboard |
| Validate URL input | User enters invalid URL | Shows error, prompts again |
| Validate file input | User enters non-existent file | Shows error, prompts again |
| Link another prompt | After successful link | Asks "Link another file?" |
| Exit on cancel | User cancels prompt | Exits gracefully, exit code 0 |

### TC-010: Init Integration Tests (`packages/cli/src/__tests__/init-link.test.ts`)

**Covers:** US-007, FR-11

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Offer link after init | Init completes | Prompts "Would you like to link a Figma file now?" |
| Accept link offer | User selects yes | Enters link flow |
| Decline link offer | User selects no | Completes init without linking |
| Link succeeds in init | User completes link | Shows success, init complete |
| Link cancelled in init | User cancels link | Init still completes successfully |
| Skip with --yes | `init --yes` | Skips link prompt, completes init |

## Open Questions

- Should we support Figma file URLs (`figma.com/file/...`) in addition to design URLs?
  - **Decision:** Yes, support legacy `file/` URLs. They use the same format as `design/` URLs and can include `node-id` query parameter. If no `node-id` is present, only the `@figma-file` directive is added (user can add nodes later).

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Support `figma.com/file/...` URLs? | ✅ Yes | Same format as design URLs, extract `node-id` from query param if present |
| Add `--dry-run` flag? | ❌ No | Keep command simple; users can review file changes in git |
| Support clipboard auto-detect? | ✅ Yes (if simple) | Nice UX improvement, implement if straightforward |
| Add `unlink` command? | ❌ No | Out of scope; users can manually remove directives |

## Research References

- [Vercel CLI `link` command](https://vercel.com/docs/cli/link) - Links local directories to remote projects
- [Supabase CLI `link` command](https://supabase.com/docs/reference/cli/supabase-link) - Connects local to remote databases
- [shadcn CLI `add` command](https://ui.shadcn.com/docs/cli) - Adds components with standard flags
- [Storybook Connect plugin](https://www.chromatic.com/docs/figma-plugin/) - Links Figma components to stories via URL
