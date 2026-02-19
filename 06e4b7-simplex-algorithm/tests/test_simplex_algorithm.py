from repository_after.simplex_algorithm import SimplexSolver
import unittest
import numpy as np

class TestSimplexSolver(unittest.TestCase):

    def test_standard_maximization(self):
        """Tests standard maximization, pivoting, and solution extraction."""
        c = [3, 2]
        A = [[2, 1], [2, 3], [3, 1]]
        b = [18, 42, 24]
        constraints = ['<=', '<=', '<=']

        solver = SimplexSolver(c, A, b, constraints, 'max')
        result = solver.solve()

        # Validates optimality (Req 7) and value extraction (Req 8)
        self.assertAlmostEqual(result['x1'], 3.0)
        self.assertAlmostEqual(result['x2'], 12.0)
        self.assertAlmostEqual(result['objective_value'], 33.0)
        # Validates Dict return (Req 11)
        self.assertIsInstance(result, dict)

    def test_standard_minimization(self):
        """Tests minimization logic."""
        c = [-3, -2]
        A = [[2, 1], [2, 3], [3, 1]]
        b = [18, 42, 24]
        constraints = ['<=', '<=', '<=']

        solver = SimplexSolver(c, A, b, constraints, 'min')
        result = solver.solve()

        self.assertAlmostEqual(result['objective_value'], -33.0)

    def test_two_phase_mixed_constraints(self):
        """
        Tests Two-Stage Simplex (Req 6) and handling of
        Decision, Slack, and Artificial variables (Req 3).
        """
        c = [2, 3]
        A = [[0.5, 0.25], [1, 3], [1, 1]]
        b = [4, 20, 10]
        constraints = ['<=', '>=', '=']

        solver = SimplexSolver(c, A, b, constraints, 'min')
        result = solver.solve()

        # Artificial vars allow finding this specific feasible region intersection
        self.assertAlmostEqual(result['x1'], 5.0)
        self.assertAlmostEqual(result['x2'], 5.0)

    def test_input_validation(self):
        """Tests input validation (Req 1)."""
        c = [1]
        A = [[1]]
        # Error: Negative RHS
        b = [-5]
        constraints = ['<=']

        # Should raise ValueError immediately on initialization
        with self.assertRaises(ValueError):
            SimplexSolver(c, A, b, constraints)

    def test_unbounded_problem(self):
        """
        Tests pivot selection correctness. If Ratio Test fails
        (no positive denominator), problem is unbounded.
        """
        c = [1]
        A = [[1]]
        b = [5]
        constraints = ['>='] # x1 >= 5, max x1 -> Unbounded

        solver = SimplexSolver(c, A, b, constraints, 'max')

        with self.assertRaisesRegex(ValueError, "Unbounded"):
            solver.solve()

    def test_infeasible_problem(self):
        """Tests that Two-Stage method detects infeasibility."""
        c = [1]
        A = [[1], [1]]
        b = [5, 10]
        constraints = ['<=', '>='] # x1 <= 5 AND x1 >= 10 -> Impossible

        solver = SimplexSolver(c, A, b, constraints, 'max')
        with self.assertRaisesRegex(ValueError, "Infeasible"):
            solver.solve()

    def test_max_iterations_limit(self):
        """Tests protection against infinite cycling (Req 9)."""
        c = [3, 2]
        A = [[2, 1], [2, 3], [3, 1]]
        b = [18, 42, 24]
        constraints = ['<=', '<=', '<=']

        # Force max_iter to 1 to trigger the limit exception intentionally
        solver = SimplexSolver(c, A, b, constraints, 'max', max_iter=1)

        with self.assertRaisesRegex(ValueError, "Max iterations"):
            solver.solve()

    def test_variable_labels(self):
        """Tests generation of column labels (Req 10)."""
        c = [1, 1]
        A = [[1, 0], [0, 1]]
        b = [2, 2]
        constraints = ['<=', '<=']

        solver = SimplexSolver(c, A, b, constraints, 'max')
        result = solver.solve()

        # Decision vars
        self.assertIn('x1', result)
        self.assertIn('x2', result)
        # Slack vars (generated automatically for <=)
        self.assertIn('s1', result)
        self.assertIn('s2', result)

if __name__ == '__main__':
    unittest.main()