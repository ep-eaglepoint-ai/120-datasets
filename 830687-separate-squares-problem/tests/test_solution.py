import pytest
import sys
import os
from pathlib import Path

# Respect PYTHONPATH environment variable to determine which repository to test
# PYTHONPATH is set by docker-compose to either /app/repository_before or /app/repository_after
pythonpath = os.environ.get("PYTHONPATH", "")
if pythonpath:
    # Use the path specified in PYTHONPATH
    repo_path = Path(pythonpath)
    if repo_path.exists():
        sys.path.insert(0, str(repo_path))
else:
    # Fallback: add both paths if PYTHONPATH is not set
    sys.path.insert(0, str(Path(__file__).parent.parent / "repository_before"))
    sys.path.insert(0, str(Path(__file__).parent.parent / "repository_after"))


def get_solution_module():
    try:
        from solution import find_split_line
        return find_split_line
    except ImportError:
        pytest.fail("Could not import find_split_line from solution module")


class TestBasicCases:
    def test_single_square(self):
        find_split_line = get_solution_module()
        squares = [[0, 0, 10]]
        result = find_split_line(squares)
        assert abs(result - 5.0) < 1e-4
    
    def test_two_squares_stacked(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [0, 10, 10]
        ]
        result = find_split_line(squares)
        assert abs(result - 10.0) < 1e-4
    
    def test_two_squares_side_by_side(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [10, 0, 10]
        ]
        result = find_split_line(squares)
        assert abs(result - 5.0) < 1e-4
    
    def test_empty_input(self):
        find_split_line = get_solution_module()
        result = find_split_line([])
        assert result == 0.0


class TestOverlappingCases:
    def test_two_overlapping_squares(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [5, 5, 10]
        ]
        result = find_split_line(squares)
        assert 5.0 <= result <= 10.0
    
    def test_fully_contained_square(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 20],
            [5, 5, 5]
        ]
        result = find_split_line(squares)
        assert abs(result - 10.0) < 1e-3
    
    def test_three_overlapping_squares(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [5, 0, 10],
            [2, 5, 10]
        ]
        result = find_split_line(squares)
        assert 0.0 <= result <= 15.0


class TestComplexGeometries:
    def test_grid_of_squares(self):
        find_split_line = get_solution_module()
        squares = []
        for i in range(3):
            for j in range(3):
                squares.append([i * 2, j * 2, 1])
        result = find_split_line(squares)
        assert 2.0 <= result <= 4.0
    
    def test_l_shaped_configuration(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 5],
            [0, 5, 5],
            [5, 0, 5]
        ]
        result = find_split_line(squares)
        assert 0.0 <= result <= 10.0
    
    def test_many_small_squares(self):
        find_split_line = get_solution_module()
        squares = []
        for i in range(10):
            for j in range(10):
                squares.append([i, j, 0.5])
        result = find_split_line(squares)
        assert 2.0 <= result <= 7.0


class TestEdgeCases:
    def test_single_point_square(self):
        find_split_line = get_solution_module()
        squares = [[0, 0, 0.001]]
        result = find_split_line(squares)
        assert abs(result - 0.0005) < 1e-3
    
    def test_very_large_square(self):
        find_split_line = get_solution_module()
        squares = [[0, 0, 1000]]
        result = find_split_line(squares)
        assert abs(result - 500.0) < 0.1
    
    def test_negative_coordinates(self):
        find_split_line = get_solution_module()
        squares = [[-10, -10, 20]]
        result = find_split_line(squares)
        assert abs(result - 0.0) < 1e-3
    
    def test_precision_requirement(self):
        find_split_line = get_solution_module()
        squares = [[0, 0, 100]]
        result = find_split_line(squares)
        expected = 50.0
        assert abs(result - expected) < 1e-4


class TestFunctionalCorrectness:
    def test_area_conservation(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [8, 8, 10]
        ]
        result = find_split_line(squares)
        assert 0.0 <= result <= 18.0
    
    def test_deterministic_output(self):
        find_split_line = get_solution_module()
        squares = [
            [0, 0, 10],
            [5, 5, 10],
            [10, 0, 10]
        ]
        result1 = find_split_line(squares)
        result2 = find_split_line(squares)
        assert abs(result1 - result2) < 1e-10


def test_import_successful():
    find_split_line = get_solution_module()
    assert callable(find_split_line)
