## Commands

### Run the build image
```bash
docker compose build
```

## Run Coverage Contract
Verify that test suites meet the mandatory testing requirements:

### Verify repository_before (Expected: FAIL - Missing coverage)
```bash
docker compose run --rm verify-before pytest tests/test_coverage_contract.py -v
```
### Verify repository_before (Expected: PASS - Full required coverage)
```bash
docker compose run --rm verify-after pytest tests/test_coverage_contract.py -v
```

### Run evaluation
```bash
docker compose run --rm app python evaluation/evaluation.py
```

