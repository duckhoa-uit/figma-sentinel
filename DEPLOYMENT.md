# Deployment Plan - Figma Sentinel

## Project Status

All **27 user stories completed** ✅

| Package | Version | Status |
|---------|---------|--------|
| `@khoavhd/figma-sentinel-core` | 1.0.0 | Ready |
| `@khoavhd/figma-sentinel` (CLI) | 1.0.0 | Ready |
| `@duckhoa-uit/figma-sentinel` | 1.0.0 | Ready |

**Test Results:** 248 tests passing  
**Build:** All packages compile successfully  
**TypeScript:** Strict mode, no errors

---

## Pre-Deployment Checklist

### 1. npm Account Setup
- [ ] Create npm account at https://www.npmjs.com/signup (if needed)
- [ ] Verify email address
- [ ] Enable 2FA for security
- [ ] Create access token: npm.com → Access Tokens → Generate New Token (Classic) → Automation

### 2. GitHub Repository Setup
- [ ] Create repository: `github.com/duckhoa-uit/figma-sentinel`
- [ ] Add secrets:
  - `NPM_TOKEN`: Your npm automation token
  - `FIGMA_TOKEN`: (for testing the action)

### 3. Local Preparation
```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami

# Verify package names are available
npm view @khoavhd/figma-sentinel-core
npm view @khoavhd/figma-sentinel
# (should return 404 if available)
```

---

## Deployment Steps

### Option A: Automated Release (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "feat: initial release of Figma Sentinel packages"
git push origin main
```

2. **Create Changeset**
```bash
pnpm changeset

# Select all packages
# Choose "major" for 1.0.0 release
# Add summary: "Initial release of Figma Sentinel - Design change tracking from Figma"
```

3. **Commit Changeset**
```bash
git add .changeset/*.md
git commit -m "chore: add changeset for initial release"
git push origin main
```

4. **GitHub Actions Will:**
   - Create a "Release PR" with version bumps
   - Merge PR → packages published automatically

### Option B: Manual Release

1. **Build All Packages**
```bash
pnpm build
```

2. **Version Packages**
```bash
pnpm changeset version
```

3. **Publish Packages (in order)**
```bash
# Core first (other packages depend on it)
cd packages/core
npm publish --access public

# CLI second
cd ../cli
npm publish --access public

# Action last
cd ../action
npm publish --access public
```

---

## Post-Deployment Verification

### 1. Verify npm Packages
```bash
npm view @khoavhd/figma-sentinel-core
npm view @khoavhd/figma-sentinel

# Test installation
npx @khoavhd/figma-sentinel --help
```

### 2. Verify GitHub Action
Test in a sample repository:
```yaml
# .github/workflows/test-sentinel.yml
name: Test Figma Sentinel
on: workflow_dispatch
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: duckhoa-uit/figma-sentinel@v1
        with:
          figma-token: ${{ secrets.FIGMA_TOKEN }}
          dry-run: true
```

### 3. Create GitHub Release
- Tag: `v1.0.0`
- Title: `🎨 Figma Sentinel v1.0.0`
- Auto-generate release notes

---

## Package Registry URLs (After Publish)

| Package | npm URL |
|---------|---------|
| Core | https://www.npmjs.com/package/@khoavhd/figma-sentinel-core |
| CLI | https://www.npmjs.com/package/@khoavhd/figma-sentinel |
| Action | https://github.com/duckhoa-uit/figma-sentinel-action |

---

## Rollback Plan

If issues are found after release:

```bash
# Deprecate problematic version
npm deprecate @khoavhd/figma-sentinel@1.0.0 "Critical bug, use 1.0.1"

# Unpublish (only within 72 hours)
npm unpublish @khoavhd/figma-sentinel@1.0.0

# Publish hotfix
pnpm changeset  # patch version
pnpm changeset version
cd packages/core && npm publish --access public
```

---

## Success Metrics

- [ ] Packages downloadable via `npm install`
- [ ] `npx @khoavhd/figma-sentinel --help` works
- [ ] GitHub Action runs in test workflow
- [ ] README visible on npm package pages
