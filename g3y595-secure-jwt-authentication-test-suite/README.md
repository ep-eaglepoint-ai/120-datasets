# G3Y595 - Secure JWT Authentication Test Suite

### Meta tests against `repository_before`

```bash
docker compose run --rm meta-before
```

### Meta tests against `repository_after`

```bash
docker compose run --rm meta-after
```

### Evaluation (meta before + meta after, report.json)

```bash
docker compose run --rm evaluation
```
