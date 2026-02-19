# LCXBI7 - Go-Linearizable-Sequence-Lease-Manager

### 1. Run Tests for `repository_before`

```bash
docker compose run --rm tests go test -v ./tests -tags=before
```

### 2. Run Tests for `repository_after`

```bash
docker compose run --rm tests go test -v ./tests -tags=after
```

### 3. Run Evaluations

```bash
docker compose run --rm tests go run evaluation/evaluation.go
```
