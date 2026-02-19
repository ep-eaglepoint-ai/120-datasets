# Correct Functional Bugs in Legacy JavaScript Code


### Running the Evaluation


1. **Build Docker containers**
   ```bash
   docker-compose build
   ```

2. **Run tests on original implementation** (Expected to fail)
   ```bash
   docker-compose run --rm test-before
   ```

3. **Run tests on fixed implementation** (Should pass all)
   ```bash
   docker-compose run --rm test-after
   ```

4. **Run complete evaluation**
   ```bash
   docker-compose run --rm evaluation
   ```
