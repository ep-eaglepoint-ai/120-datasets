# Spam Filter Optimization

## Commands

Run the tests and evaluation using Docker Compose:

```bash
# Run before optimization tests (expect some tests to fail due to implementation differences)
docker-compose run --rm app python -m pytest tests/test_before.py -v

# Run after optimization tests (expect all tests to pass)
docker-compose run --rm app python -m pytest tests/test_after.py -v

# Run evaluation to generate a report and check success
docker-compose run --rm app python evaluation/evaluation.py
```
