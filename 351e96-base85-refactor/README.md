# ASCII85 Algorithm Refactor

## Quick Start

### Prerequisites

- Docker and Docker Compose
- No local Python installation required

### Running the Evaluation

1. **Build Docker containers**
   ```bash
   docker-compose build
   ```

2. **Run tests on original implementation** (Expected to fail)
   ```bash
   docker-compose run --rm test-before
   ```

3. **Run tests on refactored implementation** (Should pass all)
   ```bash
   docker-compose run --rm test-after
   ```

4. **Run complete evaluation**
   ```bash
   docker-compose run --rm evaluation
   ```