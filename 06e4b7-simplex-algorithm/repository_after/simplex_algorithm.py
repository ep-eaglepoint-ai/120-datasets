import numpy as np
from typing import Dict, List, Optional, Tuple

class SimplexSolver:
    """
    An implementation of the Two-Phase Simplex Algorithm for Linear Programming.
    Handles maximization and minimization, and <=, >=, = constraints.
    """

    def __init__(self,
                 c: List[float],
                 A: List[List[float]],
                 b: List[float],
                 constraints: List[str],
                 objective: str = 'max',
                 max_iter: int = 1000):
        """
        Args:
            c: Coefficients for the objective function.
            A: Constraint coefficients matrix.
            b: Right Hand Side (RHS) values.
            constraints: List of constraint types ('<=', '>=', '=').
            objective: 'max' or 'min'.
            max_iter: Maximum iterations to prevent cycling.
        """
        self.c = np.array(c, dtype=np.float64)
        self.A = np.array(A, dtype=np.float64)
        self.b = np.array(b, dtype=np.float64)
        self.constraints = constraints
        self.objective_type = objective.lower()
        self.max_iter = max_iter
        self.epsilon = 1e-9

        # Validation
        if not (len(self.b) == len(self.constraints) == self.A.shape[0]):
            raise ValueError("Dimensions of A, b, and constraints do not match.")
        if np.any(self.b < 0):
            raise ValueError("RHS values (b) must be non-negative.")

        # State
        self.tableau = None
        self.col_headers = []
        self.num_decision_vars = len(self.c)
        self.num_slack = 0
        self.num_artificial = 0

    def _initialize_tableau(self) -> Tuple[int, List[int]]:
        """
        Constructs the initial tableau with Slack, Surplus, and Artificial variables.
        Returns total variables count and indices of artificial columns.
        """
        n_constraints = len(self.constraints)
        n_vars = self.num_decision_vars

        slack_cols = []
        artificial_cols = []
        self.col_headers = [f"x{i+1}" for i in range(n_vars)]

        for i, c_type in enumerate(self.constraints):
            if c_type == '<=':
                col = np.zeros(n_constraints); col[i] = 1.0
                slack_cols.append(col)
                self.col_headers.append(f"s{len(slack_cols)}")
            elif c_type == '>=':
                s_col = np.zeros(n_constraints); s_col[i] = -1.0
                slack_cols.append(s_col)
                self.col_headers.append(f"s{len(slack_cols)}")

                a_col = np.zeros(n_constraints); a_col[i] = 1.0
                artificial_cols.append(a_col)
                self.col_headers.append(f"a{len(artificial_cols)}")
            elif c_type == '=':
                a_col = np.zeros(n_constraints); a_col[i] = 1.0
                artificial_cols.append(a_col)
                self.col_headers.append(f"a{len(artificial_cols)}")
            else:
                raise ValueError(f"Unknown constraint type: {c_type}")

        self.num_slack = len(slack_cols)
        self.num_artificial = len(artificial_cols)

        # Build A matrix
        A_extended = self.A.copy()
        if slack_cols:
            A_extended = np.hstack([A_extended, np.array(slack_cols).T])
        if artificial_cols:
            A_extended = np.hstack([A_extended, np.array(artificial_cols).T])

        # Build Tableau
        total_rows = n_constraints + 1
        total_cols = A_extended.shape[1] + 1
        self.tableau = np.zeros((total_rows, total_cols), dtype=np.float64)
        self.tableau[1:, :-1] = A_extended
        self.tableau[1:, -1] = self.b

        # Calculate Artificial Indices (they are at the end before RHS)
        start_art = self.num_decision_vars + self.num_slack
        art_indices = list(range(start_art, start_art + self.num_artificial))

        return A_extended.shape[1], art_indices

    def _get_pivot_column(self) -> Optional[int]:
        """Returns index of the most negative coefficient in objective row."""
        obj_row = self.tableau[0, :-1]
        min_val = np.min(obj_row)
        if min_val >= -self.epsilon:
            return None
        return np.argmin(obj_row)

    def _get_pivot_row(self, col_idx: int) -> Optional[int]:
        """Returns index of the row with minimum positive ratio."""
        n_rows = self.tableau.shape[0]
        min_ratio = float('inf')
        pivot_row_idx = None

        for i in range(1, n_rows):
            rhs = self.tableau[i, -1]
            coef = self.tableau[i, col_idx]
            if coef > self.epsilon:
                ratio = rhs / coef
                if ratio < min_ratio:
                    min_ratio = ratio
                    pivot_row_idx = i
        return pivot_row_idx

    def _perform_pivot(self, row_idx: int, col_idx: int):
        """Gaussian elimination on the tableau."""
        pivot_val = self.tableau[row_idx, col_idx]
        self.tableau[row_idx, :] /= pivot_val

        n_rows = self.tableau.shape[0]
        for i in range(n_rows):
            if i != row_idx:
                factor = self.tableau[i, col_idx]
                self.tableau[i, :] -= factor * self.tableau[row_idx, :]

    def _solve_phase(self) -> int:
        """Runs the simplex loop. Returns: 0=Optimal, 1=Unbounded, 2=MaxIter."""
        for _ in range(self.max_iter):
            pivot_col = self._get_pivot_column()
            if pivot_col is None:
                return 0
            pivot_row = self._get_pivot_row(pivot_col)
            if pivot_row is None:
                return 1
            self._perform_pivot(pivot_row, pivot_col)
        return 2

    def solve(self) -> Dict[str, float]:
        total_vars, art_indices = self._initialize_tableau()

        # === PHASE 1 ===
        if self.num_artificial > 0:
            self.tableau[0, :] = 0.0

            # Minimize Sum(Artificials) -> Maximize -Sum(Artificials)
            # 1. Subtract rows containing artificial variables from objective row.
            for i in range(1, self.tableau.shape[0]):
                for art_idx in art_indices:
                    # Check if this row has the artificial variable (coeff is 1)
                    if abs(self.tableau[i, art_idx] - 1.0) < self.epsilon:
                        self.tableau[0, :] -= self.tableau[i, :]
                        break

            # Force artificial columns in objective row to 0.
            self.tableau[0, art_indices] = 0.0

            status = self._solve_phase()
            if status == 1: raise ValueError("Unbounded in Phase 1 (Unexpected).")
            if status == 2: raise ValueError("Max iterations in Phase 1.")

            # Check feasibility (Objective value should be ~0)
            if abs(self.tableau[0, -1]) > 1e-5:
                raise ValueError("Problem is Infeasible.")

            # Remove artificial columns
            self.tableau = np.delete(self.tableau, art_indices, axis=1)
            self.col_headers = [h for i, h in enumerate(self.col_headers) if i not in art_indices]

        # Restore original objective function
        self.tableau[0, :] = 0.0
        coeffs = self.c if self.objective_type == 'max' else -self.c

        # Place original coefficients (negated for tableau)
        for i in range(len(coeffs)):
            self.tableau[0, i] = -coeffs[i]

        # Restore canonical form (Zero out basic variables in objective row)
        num_cols = self.tableau.shape[1] - 1
        for col in range(num_cols):
            # Check if column is basic (unit vector)
            col_vec = self.tableau[1:, col]
            if np.sum(np.abs(col_vec) > self.epsilon) == 1: # Only one non-zero
                row_indices = np.where(np.abs(col_vec - 1.0) < self.epsilon)[0]
                if len(row_indices) == 1:
                    row_idx = row_indices[0] + 1
                    # Elimination
                    obj_coef = self.tableau[0, col]
                    if abs(obj_coef) > self.epsilon:
                        self.tableau[0, :] -= obj_coef * self.tableau[row_idx, :]

        status = self._solve_phase()
        if status == 1: raise ValueError("Problem is Unbounded.")
        if status == 2: raise ValueError("Max iterations in Phase 2.")

        return self._extract_solution()

    def _extract_solution(self) -> Dict[str, float]:
        solution = {label: 0.0 for label in self.col_headers}
        n_cols = self.tableau.shape[1] - 1

        for j in range(n_cols):
            col_vec = self.tableau[1:, j]
            # Identify basic variables
            if np.sum(np.abs(col_vec) > self.epsilon) == 1:
                ones = np.where(np.abs(col_vec - 1.0) < self.epsilon)[0]
                if len(ones) == 1:
                    row_idx = ones[0] + 1
                    solution[self.col_headers[j]] = self.tableau[row_idx, -1]

        # Objective value
        optimal_z = self.tableau[0, -1]
        if self.objective_type == 'min':
            optimal_z = -optimal_z

        solution['objective_value'] = optimal_z
        return solution