## Commands

### Run the build image
```bash
docker compose build
```

### Run tests
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_after app pytest -q
```

### Run evaluation
```bash
docker compose run --rm app python evaluation/evaluation.py
```
