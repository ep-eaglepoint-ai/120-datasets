# Multi-Component Dependency Cycle Detection

## Commands (Docker)

### Build the Image
```bash
docker-compose build
```

### Run Tests
```bash
docker-compose run --rm test-before
docker-compose run --rm test-after
```

### Run Evaluation (Recommended)
```bash
docker-compose run --rm evaluation
```
