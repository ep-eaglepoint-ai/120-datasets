# Flight Booking System - Pydantic Refactor

## Commands

### Test repository_before/

```bash
docker compose run --rm -e REPO_PATH=repository_before app pytest tests/test_pydantic_models.py
```

### Test repository_after

```bash
docker compose run --rm -e REPO_PATH=repository_after app pytest tests/test_pydantic_models.py
```

### Generate evaluation report

```bash
docker compose run --rm app python evaluation/evaluation.py
```
