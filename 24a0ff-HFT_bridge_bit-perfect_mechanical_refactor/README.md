# HFT Bridge Bit-Perfect Mechanical Refactor

This repository demonstrates an HFT bridge implementation with a focus on bit-perfect mechanical refactoring. The `repository_before` directory represents the initial state, while `repository_after` contains the completed implementation.

## Requirements

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/)

## Quick Start

### 1. Run Tests for `repository_before` (Legacy)
Runs the unified test suite against the original code. This is expected to **FAIL** on structural compliance but **PASS** on behavioral parity.
```bash
docker compose up before --build
```

### 2. Run Tests for `repository_after` (Refactored)
Runs the unified test suite against the refactored code. This is expected to **PASS** all tests.
```bash
docker compose up after --build
```

### 3. Run Full Evaluation
Builds the image, runs both test targets, and generates a machine-readable report.
```bash
docker compose up evaluate --build
```

## Projects

| Directory            | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `repository_before/` | Initial state with legacy HFT bridge logic            |
| `repository_after/`  | Refactored implementation with bit-perfect parity     |
| `tests/`             | Unified verification suite for mechanical compliance  |
| `evaluation/`        | Evaluation engine and automated report generator      |

