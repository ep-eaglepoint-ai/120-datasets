# SongList Component Refactoring

## Commands

### Test legacy implementation (should fail most tests)

```bash
docker compose run --rm songlist-test-before
```

### Test refactored implementation (should pass all tests)

```bash
docker compose run --rm songlist-test-after
```

### Generate evaluation report

```bash
docker compose run --rm songlist-evaluate
```