# Trajectory: Simplex Algorithm Solver

## 1. Understanding the Problem Space

The goal was to create a **Linear Programming solver** using the **Simplex method** that could handle real-world problems.

**Key insight early on:**
Most introductory explanations only cover maximization problems with ≤ constraints and non-negative right-hand side values.
Once equality (=) and ≥ constraints appear, the standard simplex method **cannot start** because there is no obvious initial basic feasible solution.

- This realization led directly to the need for the **Two-Phase Simplex method** and **artificial variables**.

## 2. Foundational Research & Learning Path

Before writing any serious code, I collected and studied core concepts:

- How tableau structure is actually organized (coefficients matrix + objective row + RHS)
- Why and how artificial variables are introduced
- The exact meaning of "canonical form" (each basic variable has exactly one +1 in its column and zeros elsewhere)

- **YouTube Guide on Simplex Tableau:**
  A detailed walkthrough of setting up the tableau, determining basic feasible solutions, and performing row operations.
  https://youtu.be/9YKLXFqCy6E?si=rBa8g2PTHN2_zm2j

- **Medium Article on Linear Programming:**
  A structural reference for the tableau form and the iterative process of the Simplex method.
  https://medium.com/@minkyunglee_5476/linear-programming-simplex-method-with-tableau-form-b99f37654882

## 3. Input Standardization

Data is ingested as numpy arrays, but preprocessing is required to unify the logic:

- **Minimization** problems are mathematically converted to **Maximization** problems by negating the objective coefficients ($Min(Z) \leftrightarrow Max(-Z)$).
- Right-Hand Side (RHS) values are validated to ensuring non-negativity.

## 4. Tableau Construction & Variable Expansion

To convert inequalities into a system of linear equations (Standard Form), the solver dynamically generates variables:

- **Slack Variables ($s_i$):** Added for $\le$ constraints.
- **Surplus Variables ($s_i$):** Subtracted for $\ge$ constraints.
- **Artificial Variables ($a_i$):** Added for $=$ and $\ge$ constraints to create an initial identity matrix basis.

The tableau is constructed as a matrix `[Objective | Constraints | RHS]`, with dynamic column headers generated to track variable names.

## 5. Phase 1: Feasibility Search

If artificial variables are present, the solver initiates **Phase 1**:

- **Objective:** Minimize the sum of artificial variables (or Maximize the negative sum).
- **Setup:** The objective row is adjusted by subtracting constraint rows containing artificial variables to zero out their reduced costs in the basis.
- **Result:** If the optimal Phase 1 objective is non-zero, the problem is declared **Infeasible**. If zero, artificial columns are dropped, and the solver proceeds to Phase 2.

## 6. Phase 2: Optimization

With a valid Basic Feasible Solution (BFS) established:

- The **original objective function** is restored.
- **Canonical Form Restoration:** Row operations are applied to ensure that all basic variables have a coefficient of $0$ in the objective row before iterations begin.
- Standard Simplex iterations proceed to maximize the objective.

## 7. Pivot Selection Strategy

The solver iterates through adjacent vertices of the feasible region using:

- **Entering Variable (Column):** Selected using the most negative coefficient in the objective row (steepest ascent).
- **Leaving Variable (Row):** Selected using the **Minimum Ratio Test** (RHS divided by positive column coefficients).
- **Unbounded Detection:** If a pivot column has no positive coefficients, the solution is unbounded.

## 8. Gaussian Elimination (Row Operations)

Once a pivot element is selected:

1.  The pivot row is normalized (divided by the pivot element).
2.  All other rows (including the objective row) are adjusted via subtraction to create a column of zeros (except for the pivot).
3.  This effectively swaps a non-basic variable into the basis.

## 9. Solution Extraction

Upon convergence (no negative reduced costs):

- The solver scans the final tableau columns.
- Columns forming an **identity matrix** correspond to Basic Variables.
- Their values are mapped from the RHS column.
- Non-basic variables are set to $0$.
- The final objective value is inverted back if the original problem was a Minimization.
