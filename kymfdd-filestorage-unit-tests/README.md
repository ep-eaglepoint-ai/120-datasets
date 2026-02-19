# FileStorage Unit Testing

### Run meta tests against repository_before
```bash
docker compose run --rm -e REPO_PATH=repository_before app
```

### Run meta tests against repository_after
```bash
docker compose run --rm -e REPO_PATH=repository_after app
```

### Generate evaluation report
```bash
docker compose run --rm app python evaluation/evaluation.py
```

