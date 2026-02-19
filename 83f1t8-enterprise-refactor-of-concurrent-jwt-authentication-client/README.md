# 83F1T8 - Enterprise Refactor of Concurrent JWT Authentication Client

### 1. Run Tests for `repository_before`

```bash
docker compose run --rm -e TARGET_REPO=before app
```

### 2. Run Tests for `repository_after`

```bash
docker compose run --rm -e TARGET_REPO=after app
```

### 3. Run Evaluations

```bash
docker compose run --rm app npm run evaluate
```
