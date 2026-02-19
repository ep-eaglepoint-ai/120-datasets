# J1W9QV - nearest neighbor

## Repository Before

```bash
docker compose run --rm -e PYTHONPATH=/app/repository_before app pytest -v --tb=no tests
```

## Repository After

```bash
docker compose run --rm -e PYTHONPATH=/app/repository_after app pytest -v tests
```

## Evaluation

```bash
docker compose run --rm app python evaluation/evaluation.py
```
