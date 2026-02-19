

### Run tests (before – expected failures)
```bash
docker compose up --build --exit-code-from test-before test-before


### Run tests (after – expected all pass)
```bash
docker compose up --build --exit-code-from test-after test-after


### Run evaluation (compares both implementations)
```bash
docker compose up --build --exit-code-from evaluate evaluate
```
