# Contributing to Figma Sentinel

Thank you for your interest in contributing to Figma Sentinel! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18 or later
- pnpm 9 or later
- A Figma account with a personal access token (for testing)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/duckhoa-uit/figma-sentinel.git
   cd figma-sentinel
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build all packages**
   ```bash
   pnpm build
   ```

4. **Run tests**
   ```bash
   pnpm test
   ```

5. **Run type checking**
   ```bash
   pnpm typecheck
   ```

### Project Structure

```
figma-sentinel/
├── packages/
│   ├── core/          # Core library (@khoavhd/figma-sentinel-core)
│   ├── cli/           # CLI tool (@khoavhd/figma-sentinel)
│   └── action/        # GitHub Action (@khoavhd/figma-sentinel-action)
├── examples/          # Example workflows
└── scripts/           # Development scripts
```

### Available Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm typecheck` - Type check all packages
- `pnpm format` - Format code with Prettier
- `pnpm changeset` - Create a changeset for versioning

## Development Workflow

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards below

3. Write or update tests for your changes

4. Ensure all checks pass:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

5. Commit your changes with a descriptive message

6. Push your branch and create a Pull Request

### Coding Standards

- **TypeScript** - Use strict TypeScript with explicit types
- **ESM** - Use ES module imports with `.js` extensions
- **Testing** - Write tests using Vitest
- **Formatting** - Code is formatted with Prettier (run `pnpm format`)
- **Linting** - ESLint enforces code quality (run `pnpm lint`)

### Code Style Guidelines

- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for exported functions
- Use async/await over raw Promises
- Handle errors appropriately with try/catch
- Avoid `any` types - use proper TypeScript types

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @khoavhd/figma-sentinel-core test

# Run tests in watch mode
pnpm test -- --watch
```

### Writing Tests

- Place tests in `src/__tests__/*.test.ts`
- Place test fixtures in `src/__tests__/fixtures/`
- Mock external dependencies (Figma API, file system)
- Test both success and error cases

## Pull Request Process

1. **Create a changeset** if your changes affect the public API:
   ```bash
   pnpm changeset
   ```
   Follow the prompts to describe your changes.

2. **Fill out the PR template** with:
   - Description of changes
   - Related issues
   - Testing performed
   - Breaking changes (if any)

3. **Ensure CI passes** - All checks must be green

4. **Request review** - A maintainer will review your PR

5. **Address feedback** - Make requested changes if any

6. **Merge** - Once approved, a maintainer will merge your PR

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation.

When making changes that should be released:

1. Run `pnpm changeset`
2. Select the packages affected
3. Choose the bump type (patch, minor, major)
4. Write a summary of changes

The changeset file will be committed with your PR.

## Reporting Issues

- Use the GitHub issue tracker
- Search existing issues before creating new ones
- Provide a clear description and steps to reproduce
- Include version numbers and environment details

## Feature Requests

- Open a GitHub issue with the "enhancement" label
- Describe the use case and expected behavior
- Discuss before implementing large features

## Code of Conduct

Be respectful and inclusive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
