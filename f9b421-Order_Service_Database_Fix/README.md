# Order Service Reliability Fix

## Commands

### Repository Before

```bash
docker compose run --rm app node tests/test-before-repository-suite.js

```

### Repository After

```bash
docker compose run --rm app node tests/test-after-repository-suite.js

```

### Evaluation

```bash
docker compose run --rm app node evaluation/evaluation.js
```
