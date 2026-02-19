# Simulated Annealing for Function Optimization

A Python implementation of the Simulated Annealing algorithm to approximate the global optimum of the Rastrigin function.

## Problem Statement

A Python implementation of the simulated annealing algorithm must be developed to approximate the global optimum of a user-defined objective function by mimicking the metallurgical annealing process. The core components require methods to generate a neighboring solution from the current state, calculate an acceptance probability for worse solutions using the Metropolis criterion based on a gradually decreasing temperature, and execute a cooling schedule that reduces the temperature over iterations.

## Requirements

1. **Objective Function**: Defined as the Rastrigin function, a non-convex function with many local minima.
2. **Neighbor Generation**: Generates random perturbations of the current state.
3. **Acceptance Probability**: Uses `P = exp(-(E_new - E_old) / T)` for worse solutions.
4. **Cooling Schedule**: Exponential cooling `T = T * cooling_rate`.
5. **Optimization Loop**: Iterates until stopping conditions are met, tracking the best solution.

## Structure

- `repository_after/simulation.py`: Complete implementation of the algorithm.
- `tests/test_simulation.py`: comprehensive unit tests.
- `evaluation/evaluation.py`: Verification script to check convergence and correctness.

## Running the Project

### Using Docker

To ensure a consistent environment, use the provided Docker configuration.

**1. Build the Image**
Ensures all dependencies (including the newly added pytest) are installed.

```bash
docker compose build
```

**2. Run Unit Tests**
This will execute the pytest suite within the container.

```bash
docker compose run --rm app pytest tests/test_simulation.py -v
```

**3. Run Evaluation**
This will run the algorithm validation script, which verifies convergence over multiple runs and generates a report.

```bash
docker compose run --rm app python evaluation/evaluation.py
```

### Running Locally

If you prefer to run locally, ensure you have Python 3.11+ installed.

**1. Install Dependencies**

```bash
pip install -r requirements.txt
```

**2. Run Tests**

```bash
pytest tests/test_simulation.py -v
```

**3. Run Evaluation**

```bash
python evaluation/evaluation.py
```
