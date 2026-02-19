# Optimizing Hourly Unique Visitor Aggregation from Large Event Lists in Python


### Run pytest against repository_before (baseline):**
```bash
docker compose run --rm app env REPO_PATH=repository_before python -m pytest tests -v
```

### Run pytest against repository_after (optimized):**
```bash
docker compose run --rm app env REPO_PATH=repository_after python -m pytest tests -v
```

### Generate evaluation report
```bash
docker compose run --rm app python evaluation/evaluation.py
```
