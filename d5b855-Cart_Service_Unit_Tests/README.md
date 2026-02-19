# CartService Unit Tests

## Docker Commands

### Run Program Unit Tests
Runs the Jest unit tests in `repository_after/`:
```bash
docker compose run --rm run_tests
```

### Run Metatests
Runs the metatests in `tests/` (verifies the unit tests):
```bash
docker compose run --rm run_metatest
```

### Run Evaluation (Generate Report)
Runs both and generates the evaluation report:
```bash
docker compose run --rm run_evaluation
```
