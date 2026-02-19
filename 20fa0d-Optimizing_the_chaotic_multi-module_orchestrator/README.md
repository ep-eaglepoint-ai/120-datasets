
## Commands:
```bash
# Build and run BEFORE test
docker build -t chaotic-eval . && docker run --rm chaotic-eval npm run test:before
```

```bash
# Build and run AFTER test
docker build -t chaotic-eval . && docker run --rm chaotic-eval npm run test:after
```

```bash
# Run Evaluation
docker run --rm -v $(pwd)/evaluation:/app/evaluation chaotic-eval npm run evaluate
```