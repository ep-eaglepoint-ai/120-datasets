# 0DVSTL - high-Fidelity-Ledger-Testing

## Quick start

Run tests:
```bash
docker compose run --rm app python -m pytest repository_after/test_ledger_processor.py -v
```

Run meta-tests:
```bash
docker compose run --rm app python -m pytest tests/test_meta_validation.py -v
```

Run evaluation:
```bash
docker compose run --rm app python evaluation/evaluation.py
```
