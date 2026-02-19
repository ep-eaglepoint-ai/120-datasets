class KDNode:
    def __init__(
        self,
        point: list[float],
        left: KDNode | None = None,
        right: KDNode | None = None,
    ) -> None:
        self.point = point
        self.left = left
        self.right = right

def build_kdtree(points: list[list[float]], depth: int = 0) -> KDNode | None:
    if not points:
        return None
    k = len(points[0])
    axis = depth % k
    points.sort(key=lambda point: point[axis])
    median_idx = len(points) // 2
    left_points = points[:median_idx]
    right_points = points[median_idx + 1 :]
    return KDNode(
        point=points[median_idx],
        left=build_kdtree(left_points, depth + 1),
        right=build_kdtree(right_points, depth + 1),
    )

       
def nearest_neighbour_search(
    root: KDNode | None, query_point: list[float]
) -> tuple[list[float] | None, float, int]:
    nearest_point: list[float] | None = None
    nearest_dist: float = float("inf")
    nodes_visited: int = 0

    def search(node: KDNode | None, depth: int = 0) -> None:
        nonlocal nearest_point, nearest_dist, nodes_visited
        if node is None:
            return
        nodes_visited += 1
        current_point = node.point
        current_dist = sum(
            (query_coord - point_coord) ** 2
            for query_coord, point_coord in zip(query_point, current_point)
        )
        if nearest_point is None or current_dist < nearest_dist:
            nearest_point = current_point
            nearest_dist = current_dist
        k = len(query_point)
        axis = depth % k
        if query_point[axis] <= current_point[axis]:
            nearer_subtree = node.left
            further_subtree = node.right
        else:
            nearer_subtree = node.right
            further_subtree = node.left
        search(nearer_subtree, depth + 1)
        if (query_point[axis] - current_point[axis]) ** 2 < nearest_dist:
            search(further_subtree, depth + 1)
    search(root, 0)
    return nearest_point, nearest_dist, nodes_visited