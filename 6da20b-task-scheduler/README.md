
# Task Scheduler

## Running Individual Services

To run the different services, use the following commands:

- **Run tests on the BEFORE version (buggy):**
	```bash
	docker compose run --rm test-before
	```

- **Run tests on the AFTER version (fixed):**
	```bash
	docker compose run --rm test-after
	```

- **Run full evaluation (compares before and after):**
	```bash
	docker compose run --rm evaluation
	```