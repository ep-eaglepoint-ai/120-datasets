import pytest
from repository_after.self_intersecting_polygon_area import (
    expand_movements,
    steps_to_vertices,
    shoelace_area,
    total_enclosed_area
)

def test_expand_movements_basic():
    movements = [("UP", 2), ("RIGHT", 1)]
    steps = expand_movements(movements)
    assert steps == ["UP", "UP", "RIGHT"]


def test_steps_to_vertices_basic():
    steps = ["UP", "RIGHT", "DOWN"]
    vertices = steps_to_vertices(steps)
    assert vertices == [
        (0, 0),
        (0, 1),
        (1, 1),
        (1, 0)
    ]


def test_shoelace_rectangle():
    rectangle = [
        (0, 0),
        (4, 0),
        (4, 3),
        (0, 3)
    ]
    assert shoelace_area(rectangle) == 12

def test_shoelace_triangle():
    triangle = [
        (0, 0),
        (4, 0),
        (0, 3)
    ]
    assert shoelace_area(triangle) == 6



def test_simple_square():
    movements = [
        ("UP", 2),
        ("RIGHT", 2),
        ("DOWN", 2),
        ("LEFT", 2)
    ]
    # 2x2 square
    assert total_enclosed_area(movements) == 4



def test_nested_loops():
    movements = [
        ("UP", 6),
        ("RIGHT", 6),
        ("DOWN", 6),
        ("LEFT", 6),   # outer square 6x6 = 36
        ("UP", 2),
        ("RIGHT", 2),
        ("DOWN", 2),
        ("LEFT", 2)    # inner square 2x2 = 4
    ]
    # Total area = 36 + 4 = 40
    assert total_enclosed_area(movements) == 40



def test_figure8_loop():
    movements = [
        ("UP", 2),
        ("RIGHT", 2),
        ("DOWN", 2),
        ("RIGHT", 2),
        ("UP", 2),
        ("LEFT", 2),
        ("DOWN", 2),
        ("LEFT", 2)
    ]
    # Two loops, each 2x2 square
    assert total_enclosed_area(movements) == 8


def test_overlapping_edges():
    movements = [
        ("UP", 2),
        ("RIGHT", 2),
        ("DOWN", 2),
        ("LEFT", 2),
        ("UP", 1),
        ("RIGHT", 2)
    ]
    # Should detect enclosed 2x2 square correctly
    assert total_enclosed_area(movements) == 4


def test_touching_vertex_no_area():
    movements = [
        ("UP", 2),
        ("RIGHT", 1),
        ("DOWN", 1),
        ("LEFT", 1)
    ]
    # No loop fully closed
    assert total_enclosed_area(movements) == 0

def test_empty_movements():
    assert total_enclosed_area([]) == 0


def test_invalid_direction():
    movements = [("DIAGONAL", 3)]
    with pytest.raises(ValueError):
        total_enclosed_area(movements)
