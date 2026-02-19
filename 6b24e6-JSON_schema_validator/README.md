# JSON Schema Validator - Bug Fix Challenge

**Task Type:** Bug Fixing  
**Difficulty:** Medium  
**Language:** JavaScript (Node.js)  
**Tests:** 12 independent test cases

## Overview

This task presents a JSON Schema validator with bugs. The challenge is to identify and fix the bugs while maintaining the exact public API.

## Directory Structure

```
schema-validator-task/
├── repository_before/          # Buggy implementation
│   └── SchemaValidator.js      # 144 lines with bugs
│
├── repository_after/           # Fixed implementation  
│   └── SchemaValidator.js      # 283 lines, bugs fixed
│
├── tests/                      # Test suite
│   └── test_all.js             # 12 independent tests
│
├── evaluation/                 # Evaluation system
│   ├── evaluation.js           # Standard evaluation script (Node.js)
│   └── reports/                # Generated reports
│       └── latest.json         # Latest evaluation results
│
├── trajectory/                 # Solution analysis
│   └── trajectory.md           # Detailed analysis
│
├── Dockerfile                  # Docker image
├── docker-compose.yml          # Docker Compose config
├── setup.sh                    # Setup verification
├── run_before.sh               # Command 1: Test buggy version
├── run_after.sh                # Command 2: Test fixed version
└── run_evaluation.sh           # Command 3: Run evaluation
```

## Three Commands Execution

### 1. Run BEFORE (Buggy) Version

```bash
# Local
./run_before.sh

# Docker
docker run --rm schema-validator sh ./run_before.sh

# Expected: 11/12 tests pass (1 bug demonstrated)
```

### 2. Run AFTER (Fixed) Version

```bash
# Local
./run_after.sh

# Docker
docker run --rm schema-validator sh ./run_after.sh

# Expected: 12/12 tests pass (all bugs fixed)
```

### 3. Run Evaluation (Comparison)

```bash
# Local
./run_evaluation.sh

# Docker
docker run --rm schema-validator sh ./run_evaluation.sh

# Generates: evaluation/reports/latest.json
# Expected: Success = true, Fixed 1 bug
```

## Docker Setup

### Build Image
```bash
docker build -t schema-validator .
```

### Run with Docker
```bash
docker run --rm schema-validator sh ./setup.sh
docker run --rm schema-validator sh ./run_before.sh
docker run --rm schema-validator sh ./run_after.sh
docker run --rm schema-validator sh ./run_evaluation.sh
```

### Run with Docker Compose
```bash
docker-compose run --rm schema-validator sh ./setup.sh
docker-compose run --rm schema-validator sh ./run_before.sh
docker-compose run --rm schema-validator sh ./run_after.sh
docker-compose run --rm schema-validator sh ./run_evaluation.sh
```

## The 12 Tests

Each test is independent and covers core JSON Schema validation:

1. **Basic type validation - string**
2. **Basic type validation - number**
3. **Object with required properties**
4. **Array with items schema**
5. **Number with minimum constraint**
6. **Number with maximum constraint**
7. **oneOf validation**
8. **anyOf validation**
9. **allOf validation**
10. **Nested object validation**
11. **Array with uniqueItems**
12. **Type object should reject null** (this fails in buggy version)

## Test Results

### Buggy Version (run_before.sh)
```
Passed: 11
Failed: 1
Total: 12
❌ Some tests failed! (Bug demonstrated)
```

### Fixed Version (run_after.sh)
```
Passed: 12
Failed: 0
Total: 12
✅ All tests passed!
```

### Evaluation Report (run_evaluation.sh)
```json
{
  "success": true,
  "comparison": {
    "passed_gate": true,
    "improvement_summary": "Fixed 1 bug(s). After: 12/12 tests pass."
  },
  "before": {
    "metrics": {
      "pass_rate": 91.67,
      "passed_count": 11,
      "failed_count": 1
    }
  },
  "after": {
    "metrics": {
      "pass_rate": 100.0,
      "passed_count": 12,
      "failed_count": 0
    }
  }
}
```

Report location: `evaluation/reports/latest.json`


## Requirements

- **Node.js**: >= 14.0.0
- **Docker** (optional): >= 20.10
- **No external dependencies**: Pure Node.js only

## Key Bug Example

The buggy version incorrectly accepts `null` for `type: "object"`:

```javascript
// Buggy version (repository_before/SchemaValidator.js)
case 'object': return typeof data === 'object';
// BUG: typeof null === 'object' in JavaScript!

// Fixed version (repository_after/SchemaValidator.js)
case 'object': return typeof data === 'object' && !Array.isArray(data) && data !== null;
// ✅ Correctly rejects null
```

## Files Summary

| Component | Files | Description |
|-----------|-------|-------------|
| repository_before | 1 | Buggy code (144 lines) |
| repository_after | 1 | Fixed code (283 lines) |
| tests | 1 | 12 independent tests |
| evaluation | 1 | Standard evaluation script |
| trajectory | 1 | Solution analysis |
| scripts | 4 | setup, run_before, run_after, run_evaluation |
| docker | 2 | Docker setup |

**Total: 12 files** (+ generated reports)

## Usage Examples

### Setup
```bash
./setup.sh
```

### Run Before (Buggy) Version
```bash
./run_before.sh
```

### Run After (Fixed) Version
```bash
./run_after.sh
```

### Run in Docker
```bash
docker build -t schema-validator .
docker run --rm schema-validator sh ./setup.sh
docker run --rm schema-validator sh ./run_before.sh
docker run --rm schema-validator sh ./run_after.sh
```

## License

MIT License - ByteDance Training Project
