# Enterprise-Grade Theming System


### Run tests on repository_before (expected to fail)

```bash
docker compose run --rm tests-before
```

### Run tests on repository_after (expected to pass)

```bash
docker compose run --rm tests-after
```

### Run evaluation (compares both implementations)

```bash
docker compose run --rm evaluation
```
