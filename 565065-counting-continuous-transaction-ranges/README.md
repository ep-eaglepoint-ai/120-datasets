# Transaction Range Counter - Performance Optimization

## Docker Commands

```bash
# Run tests against repository_before (O(n³) implementation)
docker compose run --rm test-before

# Run tests against repository_after (O(n log n) implementation)
docker compose run --rm test-after

# Run evaluation and generate reports
docker compose run --rm evaluation
```
