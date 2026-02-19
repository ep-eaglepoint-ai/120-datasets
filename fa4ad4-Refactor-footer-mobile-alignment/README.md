# Footer Mobile Alignment Refactoring

This dataset task involves refactoring a React application to fix mobile responsiveness issues and migrating the codebase to TypeScript.

## Folder Layout

- `repository_before/` - Original JavaScript implementation
- `repository_after/` - Refactored TypeScript implementation
- `tests/` - Structural verification tests
- `patches/` - Diff between before/after
- `evaluation/` - Evaluation runner

## Problem Statement

The goal is to refactor the project to:
1. **Fix Footer Mobile Alignment**: Center content with ~20% margins and reorder social icons.
2. **Migrate to TypeScript**: Convert all components to `.tsx`, add `tsconfig.json`, and ensure proper typing.

## Verification

Verification focuses on the **structural integrity** of the refactor rather than UI testing (which is assumed correct):

- **TypeScript Migration**: Checks that all source files are `.tsx` or `.ts`.
- **Configuration**: Checks for existence of `tsconfig.json`, `vite.config.ts`, etc.
- **Dependencies**: checks for TypeScript packages in `package.json`.

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before – expected failures)
```bash
docker compose run --rm app-before
```
*Expected: Failures due to missing TypeScript config and .jsx files.*

### Run tests (after – expected pass)
```bash
docker compose run --rm app-after
```
*Expected: All structural checks PASS.*

### Run evaluation
```bash
docker compose run --rm evaluation
```

## Run Locally

```bash
# Install dependencies
npm install
cd repository_before/demo-app && npm install
cd repository_after/demo-app && npm install

# Run verification
REPO=repository_after npm test
```