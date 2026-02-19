# Offline-First Task Management Architecture

## Commands

### Build Docker images

```bash
docker-compose build
```

### Test legacy implementation (should fail)

```bash
docker-compose run --rm tests-before
```

### Test refactored implementation (should pass)

```bash
docker-compose run --rm tests-after
```

### Generate evaluation report

```bash
docker-compose run --rm evaluation
```
