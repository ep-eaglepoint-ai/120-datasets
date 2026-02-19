# Rate Limiter Optimization

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before )
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_before app pytest -v tests/
```

### Run tests (after)
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_after app pytest -v tests/
```

### Run evaluation (compares both implementations)
```bash
docker compose run --rm app python evaluation/evaluation.py
```