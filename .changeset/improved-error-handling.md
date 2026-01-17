---
"@khoavhd/figma-sentinel-core": minor
"@khoavhd/figma-sentinel": minor
"@khoavhd/figma-sentinel-action": minor
---

feat: Improved Figma API Error Handling & User Notification System

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
