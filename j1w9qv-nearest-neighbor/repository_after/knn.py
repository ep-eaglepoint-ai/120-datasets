from __future__ import annotations
import random
import math

Point = list[float]
KDNodeOptional = "KDNode | None"

class KDNode:
    """
    Optimized Node class using __slots__ for memory efficiency.
    REDUCES MEMORY: Prevents creation of __dict__ for every node.
    """
    __slots__ = ('point', 'left', 'right')

    def __init__(
        self,
        point: Point,
        left: KDNodeOptional = None,
        right: KDNodeOptional = None,
    ) -> None:
        self.point = point
        self.left = left
        self.right = right

def _squared_euclidean_distance(p1: Point, p2: Point) -> float:
    """
    Calculates squared euclidean distance.
    OPTIMIZATION: Manual loop avoids overhead of zip() and function calls.
    """
    d = 0.0
    # Optimization: accessing len once is marginally faster in tight loops
    n = len(p1)
    for i in range(n):
        diff = p1[i] - p2[i]
        d += diff * diff
    return d

def _quick_select(points: list[Point], start: int, end: int, k_target: int, axis: int) -> None:
    """
    Partially sorts the list in-place such that the element at k_target
    is in its correct sorted position.

    COMPLEXITY: O(N) average time.
    """
    while True:
        if start == end:
            return

        # Randomized pivot prevents O(N^2) worst-case on sorted data
        pivot_idx = random.randint(start, end)
        pivot_val = points[pivot_idx][axis]

        # Swap pivot to end
        points[pivot_idx], points[end] = points[end], points[pivot_idx]

        # Lomuto partition scheme
        store_idx = start
        for i in range(start, end):
            if points[i][axis] < pivot_val:
                points[store_idx], points[i] = points[i], points[store_idx]
                store_idx += 1

        # Move pivot to its final place
        points[end], points[store_idx] = points[store_idx], points[end]

        # Optimization: Iterative tail-call elimination logic
        if k_target == store_idx:
            return
        elif k_target < store_idx:
            end = store_idx - 1
        else:
            start = store_idx + 1

def build_kdtree(points: list[Point]) -> KDNodeOptional:
    """
    Builds a balanced KD-Tree.

    COMPLEXITY: O(N log N) time, O(N) space.
    OPTIMIZATION: Modifies the input list in-place to avoid O(N) slicing memory overhead.
    """
    if not points:
        return None

    k_dims = len(points[0])

    def _build(start: int, end: int, axis: int) -> KDNodeOptional:
        if start > end:
            return None

        if start == end:
            return KDNode(points[start])

        # Median index
        median_idx = (start + end) // 2

        # Rearrange points so median is correct, left is smaller, right is larger
        # This guarantees a balanced tree (Height = log N)
        _quick_select(points, start, end, median_idx, axis)

        # Calculate next axis once
        next_axis = (axis + 1) % k_dims

        return KDNode(
            point=points[median_idx],
            # Pass indices to avoid list slicing (Memory Optimization)
            left=_build(start, median_idx - 1, next_axis),
            right=_build(median_idx + 1, end, next_axis),
        )

    # Start with full range and 0-th axis
    return _build(0, len(points) - 1, 0)

def nearest_neighbour_search(
    root: KDNodeOptional, query_point: Point
) -> tuple[Point | None, float, int]:
    """
    Finds the nearest neighbor.

    COMPLEXITY: O(log N) average time.
    """
    if root is None:
        return None, float("inf"), 0

    k_dims = len(query_point)
    best_point: Point | None = None
    best_dist_sq = float("inf")
    nodes_visited = 0

    def _search(node: KDNode, axis: int) -> None:
        nonlocal best_point, best_dist_sq, nodes_visited

        nodes_visited += 1

        # 1. Update best if current node is closer
        dist_sq = _squared_euclidean_distance(query_point, node.point)
        if dist_sq < best_dist_sq:
            best_dist_sq = dist_sq
            best_point = node.point

        # 2. Determine which side to visit first
        diff = query_point[axis] - node.point[axis]
        next_axis = (axis + 1) % k_dims

        if diff <= 0:
            nearer, further = node.left, node.right
        else:
            nearer, further = node.right, node.left

        # 3. Recurse into nearer subtree
        if nearer is not None:
            _search(nearer, next_axis)

        # 4. Pruning Logic:
        # Only search the further subtree if the splitting plane intersects
        # the "best distance" hypersphere.
        # Math: We check (coordinate_diff)^2 < best_dist_squared
        if further is not None:
            if (diff * diff) < best_dist_sq:
                _search(further, next_axis)

    _search(root, 0)

    # Return actual Euclidean distance (sqrt) at the very end
    return best_point, math.sqrt(best_dist_sq), nodes_visited

