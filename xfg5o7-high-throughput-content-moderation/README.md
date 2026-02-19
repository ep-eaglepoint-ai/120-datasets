# XFG5O7 - High-Throughput Content Moderation

## Running Tests

Test against `repository_before` (legacy implementation):

```bash
docker compose run --rm -e REPO_PATH=repository_before app
```

Test against `repository_after` (optimized implementation):

```bash
docker compose run --rm -e REPO_PATH=repository_after app
```

## Generate Evaluation Report

```bash
docker compose run --rm app node evaluation/evaluation.js
```
