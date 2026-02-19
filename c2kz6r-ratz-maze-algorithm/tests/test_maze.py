import sys
import pytest
import importlib.util
import os
from unittest.mock import MagicMock

# ==========================================
# 1. ROBUST MODULE LOADING
# ==========================================
def load_maze_module():
    """
    Dynamically loads the maze module based on PYTHONPATH.
    Uses mocks if the module crashes on import.
    """
    impl = os.getenv("PYTHONPATH", "")
    if "repository_before" in impl:
        path = "/app/repository_before/maze.py"
    else:
        path = "/app/repository_after/maze.py"

    if not os.path.exists(path):
        try:
            return importlib.import_module("maze")
        except ImportError:
            m = MagicMock()
            m.solve_maze.side_effect = Exception("Maze module not found")
            return m

    spec = importlib.util.spec_from_file_location("maze", path)
    if spec is None:
        return importlib.import_module("maze")

    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        # If the module itself has syntax errors or bad imports, mock it
        m = MagicMock()
        m.solve_maze.side_effect = e
        return m

@pytest.fixture
def maze_solver():
    return load_maze_module()

# ==========================================
# 2. ALGORITHM & ARCHITECTURE TESTS
# ==========================================

def test_bfs_optimality_trap(maze_solver):
    """
    Trap Maze: Tests for Shortest Path (BFS).
    Legacy Code: Returns a list (grid) instead of a tuple (path, length).
    """
    size = 20
    maze = [[0 for _ in range(size)] for _ in range(size)]

    try:
        result = maze_solver.solve_maze(maze, 0, 0, 0, 4)

        # 1. Check Return Type safely
        if not isinstance(result, tuple):
             pytest.fail(f"Architecture Mismatch: Expected tuple (path, length), got {type(result)}. Legacy DFS code detected.")

        path, length = result

        # 2. Check Logic
        if length != 5:
            pytest.fail(f"Optimality Failure: Path length is {length}, expected 5. (Likely DFS used instead of BFS)")

    except TypeError:
        # Catches "cannot unpack non-iterable"
        pytest.fail("Signature Mismatch: Solver returned raw Grid/List instead of (path, length) Tuple.")
    except Exception as e:
        pytest.fail(f"Solver crashed during execution: {e}")

def test_maze_is_modified_in_place(maze_solver):
    """
    Memory Efficiency: Checks for in-place modification.
    """
    maze = [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ]
    original_snapshot = [row[:] for row in maze]

    try:
        maze_solver.solve_maze(maze, 0, 0, 2, 2)
    except Exception:
        # Ignore crashes here, we just want to check side effects
        pass

    if maze == original_snapshot:
        pytest.fail("Memory Requirement Failed: Maze was not modified in-place. Must use input grid for visited tracking.")

def test_recursion_limit_safe(maze_solver):
    """
    Scalability: Checks for Stack Overflow (RecursionError).
    """
    size = 1000
    maze = [[0] * size for _ in range(size)]

    try:
        maze_solver.solve_maze(maze, 0, 0, size-1, size-1)
    except RecursionError:
        pytest.fail("Architecture Mismatch: RecursionError detected. Solution uses System Stack (DFS) instead of Iterative Queue (BFS).")
    except Exception:
        # Other errors are fine for this specific test, as long as it wasn't RecursionError
        pass

def test_no_solution_returns_empty(maze_solver):
    """
    Contract: Impossible maze returns ([], 0).
    Legacy Code: Raises ValueError.
    """
    maze = [[0, 1, 0], [1, 1, 0], [0, 0, 0]]

    try:
        result = maze_solver.solve_maze(maze, 0, 0, 0, 2)

        if not isinstance(result, tuple):
             pytest.fail("Architecture Mismatch: Returned Grid instead of empty path tuple.")

        path, length = result
        if path != [] or length != 0:
            pytest.fail(f"Logic Error: Expected ([], 0), got ({path}, {length})")

    except ValueError as e:
        pytest.fail(f"Contract Violation: Raised ValueError ({e}) instead of returning ([], 0).")
    except Exception as e:
        pytest.fail(f"Solver crashed: {e}")

# ==========================================
# 3. EDGE CASES & VALIDATION
# ==========================================

def test_source_equals_destination(maze_solver):
    maze = [[0]]
    try:
        result = maze_solver.solve_maze(maze, 0, 0, 0, 0)

        if not isinstance(result, tuple):
            pytest.fail("Architecture Mismatch: Return type invalid.")

        path, length = result
        assert length == 1
    except Exception as e:
        pytest.fail(f"Edge Case Failed: {e}")

def test_walls_raise_error(maze_solver):
    maze = [[1, 0], [0, 1]]
    try:
        with pytest.raises(ValueError, match="Source"):
            maze_solver.solve_maze(maze, 0, 0, 0, 1)
        with pytest.raises(ValueError, match="Destination"):
            maze_solver.solve_maze(maze, 0, 1, 1, 1)
    except AssertionError:
        pytest.fail("Input Validation Failed: Did not raise ValueError for walls.")
    except Exception as e:
         pytest.fail(f"Unexpected crash checking walls: {e}")

def test_out_of_bounds_raises(maze_solver):
    maze = [[0]]
    try:
        with pytest.raises(ValueError):
            maze_solver.solve_maze(maze, -1, 0, 0, 0)
        with pytest.raises(ValueError):
            maze_solver.solve_maze(maze, 0, 0, 5, 5)
    except AssertionError:
        pytest.fail("Input Validation Failed: Did not raise ValueError for bounds.")
    except Exception as e:
         pytest.fail(f"Unexpected crash checking bounds: {e}")

def test_empty_maze_raises(maze_solver):
    try:
        with pytest.raises(ValueError, match="empty"):
            maze_solver.solve_maze([], 0, 0, 0, 0)
    except AssertionError:
        pytest.fail("Input Validation Failed: Did not raise ValueError for empty maze.")
    except IndexError:
        pytest.fail("Implementation Error: Crashed with IndexError instead of clean ValueError.")
    except Exception as e:
         pytest.fail(f"Unexpected crash checking empty maze: {e}")