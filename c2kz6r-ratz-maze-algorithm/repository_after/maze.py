from collections import deque
from typing import List, Tuple

def solve_maze(
    maze: List[List[int]],
    source_row: int,
    source_column: int,
    destination_row: int,
    destination_column: int,
) -> Tuple[List[Tuple[int, int]], int]:
    """
    Iterative BFS maze solver.
    Modifies the maze in-place to mark visited cells.
    Returns (path_list, path_length).
    """

    # 1. Edge case checks
    if not maze or not maze[0]:
        raise ValueError("Maze is empty")

    rows, cols = len(maze), len(maze[0])

    def in_bounds(r, c):
        return 0 <= r < rows and 0 <= c < cols

    if not in_bounds(source_row, source_column) or not in_bounds(
        destination_row, destination_column
    ):
        raise ValueError("Invalid source or destination coordinates")

    if maze[source_row][source_column] == 1:
        raise ValueError("Source is a wall")

    if maze[destination_row][destination_column] == 1:
        raise ValueError("Destination is a wall")

    if (source_row, source_column) == (destination_row, destination_column):
        return [(source_row, source_column)], 1

    # 2. BFS setup
    queue = deque()
    queue.append((source_row, source_column))

    # Dictionary to track path: child -> parent
    parents = {(source_row, source_column): None}

    # Mark source as visited in-place (using -1 or any non-0/1 value)
    maze[source_row][source_column] = -1

    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    found = False

    # 3. BFS loop
    while queue:
        r, c = queue.popleft()

        if r == destination_row and c == destination_column:
            found = True
            break  # Early termination

        for dr, dc in directions:
            nr, nc = r + dr, c + dc

            if in_bounds(nr, nc) and maze[nr][nc] == 0:
                maze[nr][nc] = -1  # Mark visited immediately
                parents[(nr, nc)] = (r, c)
                queue.append((nr, nc))

    # 4. Path reconstruction
    if not found:
        return [], 0

    path = []
    cur = (destination_row, destination_column)

    while cur is not None:
        path.append(cur)
        cur = parents[cur]

    path.reverse()
    return path, len(path)