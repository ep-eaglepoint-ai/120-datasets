# DD2552 - Inventory Allocation

### Run tests (before are expected failures)
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_before:/app app pytest -v tests/ --tb=short
```

### Run tests (after are expected all pass)
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_after:/app app pytest -v tests/ --tb=short
```

### Run evaluation (compares both implementations)
```bash
docker compose run --rm app python evaluation/evaluation.py
```
