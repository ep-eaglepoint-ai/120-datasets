
import pytest
import math
import random
import sys
import os
import importlib.util

# ------------------------------------------------------------------------------
# DYNAMIC IMPORT PATCH
# ------------------------------------------------------------------------------
# We locate knn.py and check if it needs an in-memory fix for the NameError.
# This allows testing the immutable "repository_before" code.

knn_path = None
# Search sys.path to find where knn.py is located (e.g., /app/repository_before)
for path in sys.path:
    possible = os.path.join(path, "knn.py")
    if os.path.exists(possible):
        knn_path = possible
        break

if knn_path:
    with open(knn_path, "r") as f:
        source_code = f.read()

    # Check if this is the "before" code (missing the future import but using self-referencing types)
    if "from __future__ import annotations" not in source_code and "class KDNode" in source_code:
        print(f"PATCHING: Injecting __future__ annotations into {knn_path} (in-memory only)")

        # Prepend the required import to the source string
        patched_source = "from __future__ import annotations\n" + source_code

        # Manually create and load the module from the patched string
        spec = importlib.util.spec_from_loader("knn", loader=None)
        knn = importlib.util.module_from_spec(spec)
        sys.modules["knn"] = knn
        exec(patched_source, knn.__dict__)
    else:
        # If it's the "after" code or already correct, import normally
        import knn
else:
    # Fallback if file not found
    import knn

def brute_force_nearest_neighbor(points, query_point):
    """
    Ground truth implementation to verify correctness.
    Time Complexity: O(N)
    """
    if not points:
        return None, float("inf")

    best_point = None
    best_dist = float("inf")

    for p in points:
        dist = math.dist(p, query_point)
        if dist < best_dist:
            best_dist = dist
            best_point = p

    return best_point, best_dist

def get_tree_max_depth(node):
    """Helper to calculate the height of the generated KD-Tree."""
    if node is None:
        return 0
    return 1 + max(get_tree_max_depth(node.left), get_tree_max_depth(node.right))

def get_tree_size(node):
    """Helper to count nodes to ensure no data loss."""
    if node is None:
        return 0
    return 1 + get_tree_size(node.left) + get_tree_size(node.right)

# ------------------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------------------

def test_basic_correctness():
    """
    Verifies that the KD-Tree returns the exact same result as a linear search
    for a simple 2D dataset.
    """
    points = [
        [2.0, 3.0], [5.0, 4.0], [9.0, 6.0],
        [4.0, 7.0], [8.0, 1.0], [7.0, 2.0]
    ]
    # Important: The optimized build function sorts in-place.
    # We copy points for the check to keep original order for verification if needed.
    points_copy = [p[:] for p in points]

    root = knn.build_kdtree(points)

    query = [9.0, 2.0]
    result_point, result_dist, _ = knn.nearest_neighbour_search(root, query)

    # Ground truth
    expected_point, expected_dist = brute_force_nearest_neighbor(points_copy, query)

    assert result_point == expected_point
    assert math.isclose(result_dist, expected_dist, rel_tol=1e-9)

def test_high_dimensional_data():
    """
    "The implementation must handle high-dimensional data (k > 10)
    without significant performance degradation."
    """
    random.seed(42)
    dim = 20  # High dimensionality
    num_points = 1000
    points = [[random.random() for _ in range(dim)] for _ in range(num_points)]
    query = [random.random() for _ in range(dim)]

    points_copy = [p[:] for p in points]

    root = knn.build_kdtree(points)
    result_point, result_dist, visited = knn.nearest_neighbour_search(root, query)

    expected_point, expected_dist = brute_force_nearest_neighbor(points_copy, query)

    # Verify correctness in high dimensions
    assert result_point == expected_point
    assert math.isclose(result_dist, expected_dist, rel_tol=1e-9)

    # Even in 20 dimensions with 1000 points, we expect some pruning
    # (visited < num_points) usually, though high-dim suffers from curse of dimensionality.
    # We primarily ensure it doesn't crash and returns correct results.
    assert visited <= num_points

def test_median_selection_and_tree_balance():
    """
    1. "Median selection... must not exceed O(n)" -> implies balanced tree.
    3. "Avoid redundant computations"

    We verify O(n) median selection indirectly by checking the tree height.
    If the algorithm was O(n^2) or just sorting poorly, or if it failed to
    pivot correctly, the tree might degenerate to a linked list (depth N).
    With proper median selection, max depth should be approx log2(N).
    """
    sys.setrecursionlimit(5000) # Ensure test doesn't crash on recursion
    n = 2047 # 2^11 - 1, perfect complete tree size
    # Create sorted data which triggers worst-case O(N^2) in naive quicksort without random pivot
    points = [[float(i), float(i)] for i in range(n)]

    root = knn.build_kdtree(points)

    max_depth = get_tree_max_depth(root)

    # For N=2047, ideal depth is 11.
    # Allow small variance due to randomization in QuickSelect,
    # but it shouldn't be anywhere near N (2000).
    assert 10 <= max_depth <= 25, f"Tree is unbalanced! Depth {max_depth} for N={n}"

    # Verify no nodes were lost during in-place partitioning
    assert get_tree_size(root) == n

def test_memory_allocations():
    """
    "Minimize memory allocations... avoid creating unnecessary intermediate data structures"

    This checks that the original list objects are preserved in the tree nodes,
    confirming we are using the objects in-place rather than deep copying them repeatedly.
    """
    p1 = [1.0, 2.0]
    p2 = [3.0, 4.0]
    p3 = [5.0, 6.0]
    points = [p1, p2, p3]

    root = knn.build_kdtree(points)

    # Traverse tree and check object identity
    # The node.point should be exactly the same object as one of the input lists
    # (not a copy)
    found_ids = set()
    def traverse(node):
        if not node: return
        found_ids.add(id(node.point))
        traverse(node.left)
        traverse(node.right)

    traverse(root)

    assert id(p1) in found_ids
    assert id(p2) in found_ids
    assert id(p3) in found_ids

def test_distance_calculations():
    """
    "All distance calculations must avoid unnecessary mathematical operations
    (e.g., no square roots when squared distances suffice)"

    However, the final return of the function MUST be Euclidean distance (sqrt).
    We assume the implementation uses squared distance internally (which we can't easily
    mock without changing code), but we MUST verify the final output is Sqrt, not Squared.
    """
    points = [[0.0, 0.0], [4.0, 3.0]] # 3-4-5 triangle
    root = knn.build_kdtree(points)

    query = [0.0, 0.0]
    # Nearest is [0,0] dist 0
    _, dist, _ = knn.nearest_neighbour_search(root, query)
    assert dist == 0.0

    query_far = [8.0, 6.0]
    # Nearest is [4,3].
    # Diff is (4, 3). Squared dist is 16+9=25. Euclidean is 5.
    _, dist, _ = knn.nearest_neighbour_search(root, query_far)

    assert dist == 5.0, "Function returned squared distance instead of Euclidean distance"

def test_branch_pruning():
    """
    "Nearest neighbor search must implement effective branch pruning"

    We construct a scenario where pruning is guaranteed to happen.
    Points clustered far apart. Query falls deep inside one cluster.
    The algorithm should NOT visit the other cluster.
    """
    # Cluster A: around (0,0)
    cluster_a = [[random.uniform(0,1), random.uniform(0,1)] for _ in range(100)]
    # Cluster B: around (1000, 1000)
    cluster_b = [[random.uniform(999,1000), random.uniform(999,1000)] for _ in range(100)]

    points = cluster_a + cluster_b
    root = knn.build_kdtree(points)

    # Query in Cluster A
    query = [0.5, 0.5]

    _, _, nodes_visited = knn.nearest_neighbour_search(root, query)

    total_nodes = len(points) # 200

    # In a naive search, we visit 200.
    # In a pruned search, we should only look at Cluster A nodes roughly.
    # It should be significantly less than 200.
    assert nodes_visited < total_nodes * 0.7, \
        f"Pruning failed: visited {nodes_visited} out of {total_nodes} nodes"

def test_edge_cases():
    """
    Clean code handling and General Robustness.
    """
    # 1. Empty input
    root = knn.build_kdtree([])
    assert root is None
    pt, dist, visited = knn.nearest_neighbour_search(root, [1.0, 1.0])
    assert pt is None
    assert dist == float("inf")
    assert visited == 0

    # 2. Single Point
    root = knn.build_kdtree([[1.0, 1.0]])
    pt, dist, _ = knn.nearest_neighbour_search(root, [1.0, 1.0])
    assert pt == [1.0, 1.0]
    assert dist == 0.0

    # 3. Duplicate points
    # The algorithm should handle duplicates gracefully (usually partitioning them to one side)
    points = [[1.0, 1.0], [1.0, 1.0], [2.0, 2.0]]
    root = knn.build_kdtree(points)
    pt, dist, _ = knn.nearest_neighbour_search(root, [1.0, 1.0])
    assert pt == [1.0, 1.0]
    assert dist == 0.0

    # 4. Exact match query
    points = [[10.0, 10.0], [20.0, 20.0]]
    root = knn.build_kdtree(points)
    pt, dist, _ = knn.nearest_neighbour_search(root, [20.0, 20.0])
    assert pt == [20.0, 20.0]
    assert dist == 0.0
