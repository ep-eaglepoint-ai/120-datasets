# Django Blog API - N+1 Query Optimization

## Commands

### Test repository_before/

```bash
docker compose run --rm -e REPO_PATH=repository_before app pytest tests/
```

### Test repository_after

```bash
docker compose run --rm -e REPO_PATH=repository_after app pytest tests/
```

### Generate evaluation report

```bash
docker compose run --rm app python evaluation/evaluation.py
```
