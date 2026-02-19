# IoT Event Processing Pipeline – Performance Optimization

### Run tests on repository_before
```bash
docker-compose run --rm -e TEST_TARGET=before app npm run test:before
```

### Run tests on repository_after
```bash
docker-compose run --rm -e TEST_TARGET=after app npm run test:after
```

### Generate evaluation report
```bash
docker-compose run --rm app npx ts-node evaluation/evaluation.ts
```

