# 3TXGYR - Comprehensive Test Suite for EDI Claims Parser

## Commands

### Run meta tests on repository_after

```bash
docker compose run --rm -e REPO_PATH=repository_after app
```

### Generate evaluation report

```bash
docker compose run --rm app go run evaluation/evaluation.go
```
