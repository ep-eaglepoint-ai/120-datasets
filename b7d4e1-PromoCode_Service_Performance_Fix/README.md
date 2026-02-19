# Promo Code Service Performance Fix

## Commands

### Repository Before

```bash
docker compose run --rm app node tests/test-promo-service-before.js
```

### Repository After

```bash
docker compose run --rm app node tests/test-promo-service-after.js

```

### Evaluation

```bash
docker compose run --rm app node evaluation/evaluation.js
```

## Generate patch

```bash
git diff --no-index repository_before repository_after > patches/task_001.patch
```
