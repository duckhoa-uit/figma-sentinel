# AGENTS.md

## Commands
- **Build**: `pnpm build` (all packages) or `pnpm -F @khoavhd/figma-sentinel-core build`
- **Test**: `pnpm test` (all) | Single file: `pnpm -F @khoavhd/figma-sentinel-core test src/__tests__/differ.test.ts`
- **Lint**: `pnpm lint` | Fix: `pnpm lint:fix`
- **Typecheck**: `pnpm typecheck`
- **Format**: `pnpm format` | Check: `pnpm format:check`

## Architecture
Monorepo (pnpm workspaces) with 3 packages:
- **core**: Figma API client, differ, storage, markdown/image exporters, config (Zod schemas)
- **cli**: Command-line interface for running sentinel
- **action**: GitHub Action wrapper

## Code Style
- TypeScript with strict mode, ES2022 target, NodeNext modules
- Prettier: single quotes, semicolons, 2-space indent, trailing commas (es5), 100 char width
- ESLint: no unused vars (prefix `_` to ignore), warn on `any`, prefer const, no console (except warn/error)
- Tests in `__tests__/` dirs using Vitest, named `*.test.ts`
- Exports via barrel files (`index.ts`)
