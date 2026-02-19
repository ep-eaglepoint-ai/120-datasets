# Cart Service Bug Fix

```bash
# Run tests against buggy implementation (repository_before)
docker compose run --rm before

# Run tests against fixed implementation (repository_after)
docker compose run --rm after

# Run full evaluation with JSON report
docker compose run --rm evaluation
```
