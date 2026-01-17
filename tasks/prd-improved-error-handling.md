# PRD: Improved Figma API Error Handling & User Notification System

## Introduction

This PRD addresses the need for a more robust, user-friendly, and standards-compliant error handling system for Figma Sentinel. Currently, error handling is functional but lacks comprehensive coverage of all Figma API error scenarios, doesn't fully utilize Figma's error response headers, and provides inconsistent notification patterns across CLI and GitHub Action packages.

**Problem Statement:** Users encounter Figma API errors without sufficient context for resolution. Rate limiting doesn't respect `Retry-After` headers, error messages are generic, and there's no structured way to surface actionable guidance to users.

## Goals

- Implement comprehensive handling for all Figma API error codes (400, 401, 403, 404, 429, 500)
- Utilize `Retry-After` header and rate limit metadata (`X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, `X-Figma-Upgrade-Link`)
- Create a unified error type system with typed error classes
- Provide actionable, context-aware error messages for each error scenario
- Implement configurable retry strategies with concurrency control
- Add structured logging with severity levels
- Create consistent error notification patterns for CLI (ora/kleur) and GitHub Action (@actions/core)
- Enable graceful degradation for partial failures

## User Stories

### US-001: Create Typed Error Classes
**Description:** As a developer, I want typed error classes so that errors are structured, identifiable, and contain rich metadata for handling.

**Acceptance Criteria:**
- [ ] Create `FigmaSentinelError` base class with `code`, `message`, `cause`, and `isRetryable` properties
- [ ] Create `FigmaRateLimitError` subclass with `retryAfterSec`, `planTier`, `rateLimitType`, `upgradeLink` from response headers
- [ ] Create `FigmaAuthenticationError` for 401/403 with token/permission guidance
- [ ] Create `FigmaNotFoundError` for 404 with file key validation hint
- [ ] Create `FigmaServerError` for 500 with timeout/size guidance
- [ ] Create `FigmaValidationError` for 400 with parameter validation context
- [ ] Create `FigmaNetworkError` for connection/timeout issues
- [ ] All errors export from `packages/core/src/errors.ts` barrel file
- [ ] Unit tests in `packages/core/src/__tests__/errors.test.ts` cover all error classes
- [ ] Tests verify error properties, inheritance, and `isRetryable` logic
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/errors.test.ts`

### US-002: Parse Figma API Error Responses
**Description:** As a developer, I want error responses parsed according to Figma's OpenAPI spec so that I can extract meaningful error information.

**Acceptance Criteria:**
- [ ] Handle `ErrorResponsePayloadWithErrMessage` format (`{status, err}`)
- [ ] Handle `ErrorResponsePayloadWithErrorBoolean` format (`{error: true, status, message}`)
- [ ] Extract error message from response body when available
- [ ] Parse rate limit headers: `Retry-After`, `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, `X-Figma-Upgrade-Link`
- [ ] Unit tests in `packages/core/src/__tests__/error-parser.test.ts` cover both response formats
- [ ] Tests verify header parsing with mock responses
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/error-parser.test.ts`

### US-003: Improve Retry Logic with Retry-After Support
**Description:** As a user, I want retry logic to respect Figma's `Retry-After` header so that I don't hammer the API unnecessarily or wait too long.

**Acceptance Criteria:**
- [ ] Read `Retry-After` header for 429 responses and use actual wait time
- [ ] Fall back to exponential backoff (current behavior) only when header is missing
- [ ] Add configurable `maxRetryDelayMs` (default: 1 hour) to abort if wait is too long
- [ ] Add configurable `maxRetries` via config (default: 3)
- [ ] Log retry attempts with remaining time and reason
- [ ] Unit tests in `packages/core/src/__tests__/fetch-retry.test.ts` cover retry scenarios
- [ ] Tests mock 429 responses with and without `Retry-After` header
- [ ] Tests verify max delay abort behavior
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/fetch-retry.test.ts`

### US-004: Add Concurrency Control
**Description:** As a user, I want request concurrency limited so that I'm less likely to hit rate limits in the first place.

**Acceptance Criteria:**
- [ ] Add `concurrency` config option (default: 5) for parallel API requests
- [ ] Use `p-limit` or similar for concurrency control in `fetchNodes`, `fetchVariables`, `exportImages`
- [ ] Document concurrency setting in README
- [ ] Unit tests verify concurrency limiting behavior
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test`

### US-005: Unified Logger Abstraction
**Description:** As a developer, I want a unified logger so that CLI and Action can receive consistent error notifications with appropriate severity levels.

**Acceptance Criteria:**
- [ ] Create `Logger` interface with `debug`, `info`, `warn`, `error` methods
- [ ] Implement `ConsoleLogger` for CLI using `kleur` colors (debug=gray, info=cyan, warn=yellow, error=red)
- [ ] Implement `ActionLogger` for GitHub Action using `@actions/core` methods
- [ ] Pass logger to core functions via options/config
- [ ] Default to `ConsoleLogger` if no logger provided
- [ ] Unit tests in `packages/core/src/__tests__/logger.test.ts` cover logger implementations
- [ ] Tests verify log level filtering and output format
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/logger.test.ts`

### US-006: Actionable Error Messages for Each Error Code
**Description:** As a user, I want error messages that tell me exactly what went wrong and how to fix it.

**Acceptance Criteria:**
- [ ] 400: "Invalid request: [detail]. Check Figma URL format or reduce request size."
- [ ] 401: "Authentication failed. Verify your FIGMA_TOKEN is valid and not expired."
- [ ] 403: "Access denied for file [key]. Check: 1) Token has file_read scope 2) You have view access to the file 3) For Variables API, Enterprise plan required."
- [ ] 404: "Figma file [key] not found. Verify the file key from your Figma URL."
- [ ] 429: "Rate limit exceeded. Waiting [X]s before retry. Tier: [tier], Type: [type]. Upgrade: [link]"
- [ ] 500: "Figma server error. Try reducing the number of nodes requested or try again later."
- [ ] Network: "Network error connecting to Figma API. Check your internet connection."
- [ ] Unit tests in `packages/core/src/__tests__/error-messages.test.ts` verify all message formats
- [ ] Tests cover all HTTP status codes and edge cases
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/error-messages.test.ts`

### US-007: CLI Error Notification Improvements
**Description:** As a CLI user, I want clear, color-coded error output with actionable guidance.

**Acceptance Criteria:**
- [ ] Rate limit retries show spinner with countdown: "Waiting 30s (rate limited)..."
- [ ] Partial failures show warning count after completion: "⚠ 2 nodes failed to fetch (see above)"
- [ ] Fatal errors show red error message with guidance
- [ ] Add `--verbose` flag to show debug-level logs (API URLs, headers, timing)
- [ ] Unit tests in `packages/cli/src/__tests__/sync.test.ts` cover error output scenarios
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-cli test`

### US-008: GitHub Action Error Notification Improvements
**Description:** As a GitHub Action user, I want errors to be properly categorized and visible in the workflow UI.

**Acceptance Criteria:**
- [ ] Rate limit retries log with `core.info` showing wait time
- [ ] Partial failures use `core.warning` with summary of affected nodes
- [ ] Fatal errors use `core.setFailed` with actionable message
- [ ] Add `error-on-partial-failure` input (default: false) to fail workflow on partial errors
- [ ] Set output `error-count` with number of failed operations
- [ ] Set output `error-details` with JSON array of error objects
- [ ] Unit tests in `packages/action/src/__tests__/index.test.ts` cover error handling
- [ ] Tests mock `@actions/core` methods and verify correct calls
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-action test`

### US-009: Error Aggregation and Summary
**Description:** As a user, I want to see a summary of all errors at the end rather than scattered throughout output.

**Acceptance Criteria:**
- [ ] Collect all non-fatal errors during execution
- [ ] At completion, display grouped error summary: by error type, by file key
- [ ] Include count of successful vs failed operations
- [ ] For GitHub Action, include summary in `GITHUB_STEP_SUMMARY`
- [ ] Unit tests in `packages/core/src/__tests__/error-aggregator.test.ts` cover aggregation logic
- [ ] Tests verify grouping and summary format
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/error-aggregator.test.ts`

### US-010: Fail-Fast Error Behavior
**Description:** As a user, I want the tool to stop immediately on any error so I can fix issues quickly without wasting API calls.

**Acceptance Criteria:**
- [ ] Stop execution immediately when any API error occurs (not just fatal errors)
- [ ] Return clear error message with context about what failed
- [ ] Exit code 1 for any error (CLI and GitHub Action)
- [ ] Include file key and node ID in error context when available
- [ ] Unit tests in `packages/core/src/__tests__/fail-fast.test.ts` cover fail-fast behavior
- [ ] Tests verify execution stops on first error
- [ ] Tests verify error context is preserved
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/fail-fast.test.ts`

### US-011: Error Event System for Future Notifications
**Description:** As a developer, I want an error event system so that future notification integrations (Slack, Telegram, Discord) can subscribe to errors.

**Acceptance Criteria:**
- [ ] Create `ErrorEventEmitter` class that emits typed error events
- [ ] Events include: `error`, `retry`, `rateLimited`, `completed`
- [ ] Each event payload includes error details, context, and timestamp
- [ ] Core functions accept optional `eventEmitter` in options
- [ ] Document event system in README with example for custom handlers
- [ ] Unit tests in `packages/core/src/__tests__/error-events.test.ts` cover event emission
- [ ] Tests verify all event types are emitted correctly
- [ ] Typecheck passes
- [ ] All tests pass: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/error-events.test.ts`

## Functional Requirements

- FR-1: The system must parse both Figma error response formats (ErrorResponsePayloadWithErrMessage, ErrorResponsePayloadWithErrorBoolean)
- FR-2: The system must respect `Retry-After` header value for 429 responses
- FR-3: The system must abort retries if `Retry-After` exceeds `maxRetryDelayMs` configuration
- FR-4: The system must limit concurrent API requests to `concurrency` configuration value
- FR-5: The system must provide typed error classes with metadata for programmatic handling
- FR-6: The system must surface upgrade link from `X-Figma-Upgrade-Link` header to users
- FR-7: The system must aggregate errors and display summary at completion
- FR-8: The system must fail fast on any error (no partial processing)
- FR-9: The system must use appropriate severity levels (debug/info/warn/error) for all log messages
- FR-10: The system must provide consistent error notification patterns for CLI and GitHub Action
- FR-11: The system must emit error events for future notification integrations (Slack, Telegram, Discord)

## Non-Goals

- No automatic token refresh or OAuth flow handling
- No custom rate limit negotiation with Figma API
- No error analytics or telemetry collection
- No GUI error dialogs or interactive troubleshooting
- No direct Slack/Telegram/Discord integration in this PRD (event system enables future plugins)

## Technical Considerations

### Dependencies
- Add `p-limit` package for concurrency control (similar to figma-export)
- Consider `p-retry` for more robust retry logic (optional)

### Error Response Parsing
Reference Figma's OpenAPI spec at [figma/rest-api-spec](https://github.com/figma/rest-api-spec):
```typescript
// Two response formats to handle:
interface ErrorWithErr {
  status: number;
  err: string;
}

interface ErrorWithMessage {
  error: true;
  status: number;
  message: string;
}
```

### Rate Limit Headers
From Figma docs, 429 responses include:
- `Retry-After: <seconds>` - How long to wait
- `X-Figma-Plan-Tier: enterprise | org | pro | starter | student`
- `X-Figma-Rate-Limit-Type: low | high` (low=Viewer/Collab, high=Dev/Full)
- `X-Figma-Upgrade-Link: <url>` - Upgrade page URL

### Config Schema Updates
```typescript
interface SentinelConfig {
  // ... existing fields
  api?: {
    maxRetries?: number;        // default: 3
    maxRetryDelayMs?: number;   // default: 3600000 (1 hour)
    concurrency?: number;       // default: 5
  };
  strictMode?: boolean;         // default: false (exit 1 on any error)
}
```

### Existing Patterns to Preserve
- Current `fetchWithRetry` pattern with exponential backoff as fallback
- Separate error arrays in `FetchResult`, `FetchVariablesResult`, `ImageExportResult`
- Non-blocking error handling (continue on partial failures)

## Success Metrics

- All Figma API error codes (400, 401, 403, 404, 429, 500) have specific, actionable error messages
- Rate limit retries respect `Retry-After` header when present
- Concurrency control reduces rate limit incidents in batch operations
- CLI and GitHub Action display consistent, appropriately-formatted error information
- Zero regressions in existing error handling functionality
- Unit tests cover all error scenarios

## Test Requirements

### Required Test Files
| Test File | Coverage |
|-----------|----------|
| `packages/core/src/__tests__/errors.test.ts` | Error classes, inheritance, properties |
| `packages/core/src/__tests__/error-parser.test.ts` | Response format parsing, header extraction |
| `packages/core/src/__tests__/fetch-retry.test.ts` | Retry logic, Retry-After support, max delay |
| `packages/core/src/__tests__/logger.test.ts` | Logger interface, ConsoleLogger, ActionLogger |
| `packages/core/src/__tests__/error-messages.test.ts` | Actionable message generation |
| `packages/core/src/__tests__/error-aggregator.test.ts` | Error collection and summary |
| `packages/core/src/__tests__/fail-fast.test.ts` | Fail-fast behavior, execution stop |
| `packages/core/src/__tests__/error-events.test.ts` | Event emission for notifications |
| `packages/cli/src/__tests__/sync.test.ts` | CLI error output, verbose flag |
| `packages/action/src/__tests__/index.test.ts` | Action error handling, outputs |

### Final Verification Gate
**The feature is ONLY considered complete when ALL of the following pass:**

```bash
# 1. All unit tests pass
pnpm test

# 2. Type checking passes
pnpm typecheck

# 3. Linting passes
pnpm lint

# 4. Build succeeds
pnpm build
```

### Test Coverage Expectations
- Error classes: 100% branch coverage
- Error parsing: All response formats covered
- Retry logic: Normal, rate-limited, and abort scenarios
- Logger: All severity levels and output formats
- Integration: End-to-end error propagation from API to user

### Mocking Strategy
- Use `vitest` mocking for `fetch` calls
- Mock `@actions/core` for GitHub Action tests
- Use fake timers for retry delay tests
- Create fixture files for error response payloads

## Open Questions

1. ~~Should we add a `--fail-fast` option?~~ **Resolved: Always fail fast, no option needed.**
2. ~~Should partial failures be surfaced as GitHub Action annotations?~~ **Resolved: Not needed since we fail fast.**
3. ~~Individual vs global retry configuration?~~ **Resolved: Keep global config only.**
4. ~~Is 1 hour max retry delay appropriate?~~ **Resolved: Keep global, not per-use-case.**
5. ~~Should we emit structured error events?~~ **Resolved: Yes, implement event system for future Slack/Telegram/Discord notifications.**
