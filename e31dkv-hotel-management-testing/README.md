# E31DKV - Hotel Management Testing

### Run tests on repository_after

```bash
docker-compose run --rm app mvn -f tests/pom.xml test
```

### Run evaluation

```bash
docker-compose run --rm app python3 evaluation/evaluation.py
```
