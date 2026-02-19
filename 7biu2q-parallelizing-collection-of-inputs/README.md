# 7BIU2Q - parallelizing-collection-of-inputs

### Run tests (before are expected failures)
```bash
docker-compose run --rm run_before
```

### Run tests (after are expected all pass)
```bash
docker-compose run --rm -e TEST_IMPLEMENTATION=after app pytest tests/ -v --tb=no
```

### Run evaluation (compares both implementations)
```bash
docker-compose run --rm app python evaluation/evaluation.py
```
