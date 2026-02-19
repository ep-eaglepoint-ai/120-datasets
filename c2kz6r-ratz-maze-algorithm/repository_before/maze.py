def solve_maze(
    maze: list[list[int]],
    source_row: int,
    source_column: int,
    destination_row: int,
    destination_column: int,
) -> list[list[int]]:
    size = len(maze)
    if not (0 <= source_row <= size - 1 and 0 <= source_column <= size - 1) or (
        not (0 <= destination_row <= size - 1 and 0 <= destination_column <= size - 1)
    ):
        raise ValueError("Invalid source or destination coordinates")
    solutions = [[1 for _ in range(size)] for _ in range(size)]
    solved = run_maze(
        maze, source_row, source_column, destination_row, destination_column, solutions
    )
    if solved:
        return solutions
    else:
        raise ValueError("No solution exists!")

def run_maze(
    maze: list[list[int]],
    i: int,
    j: int,
    destination_row: int,
    destination_column: int,
    solutions: list[list[int]],
) -> bool:
    size = len(maze)
    if i == destination_row and j == destination_column and maze[i][j] == 0:
        solutions[i][j] = 0
        return True
    lower_flag = (not i < 0) and (not j < 0)
    upper_flag = (i < size) and (j < size)
    if lower_flag and upper_flag:
        block_flag = (solutions[i][j]) and (not maze[i][j])
        if block_flag:
            solutions[i][j] = 0
            if (
                run_maze(maze, i + 1, j, destination_row, destination_column, solutions)
                or run_maze(
                    maze, i, j + 1, destination_row, destination_column, solutions
                )
                or run_maze(
                    maze, i - 1, j, destination_row, destination_column, solutions
                )
                or run_maze(
                    maze, i, j - 1, destination_row, destination_column, solutions
                )
            ):
                return True
            solutions[i][j] = 1
            return False
    return False

if __name__ == "__main__":
    import random
    import sys
    import time

    sys.setrecursionlimit(1000000)

    SIZE = 20000
    random.seed(42)

    maze = [[0 for _ in range(SIZE)] for _ in range(SIZE)]

    for i in range(SIZE):
        for j in range(SIZE):
            if random.random() < 0.3:
                maze[i][j] = 1

    maze[0][0] = 0
    maze[SIZE-1][SIZE-1] = 0

    for i in range(SIZE):
        maze[i][0] = 0
    for j in range(SIZE):
        maze[SIZE-1][j] = 0

    if SIZE <= 100:
        print(f"Input Maze ({SIZE}x{SIZE}, 0 = path, 1 = wall):")
        for row in maze:
            print(''.join(['█' if cell == 1 else '·' for cell in row]))
    else:
        print(f"Maze size: {SIZE}x{SIZE} ({SIZE*SIZE:,} cells) - too large to print")

    print(f"\nSolving from (0,0) to ({SIZE-1},{SIZE-1})...")

    start_time = time.time()
    try:
        solution = solve_maze(maze, 0, 0, SIZE-1, SIZE-1)
        end_time = time.time()

        print(f"\nSolution found in {end_time - start_time:.4f} seconds!")
        if SIZE <= 100:
            print("(★ = path taken, · = open but not used, █ = wall)")
            for i, row in enumerate(solution):
                line = ''
                for j, cell in enumerate(row):
                    if cell == 0:
                        line += '★'
                    elif maze[i][j] == 1:
                        line += '█'
                    else:
                        line += '·'
                print(line)
        else:
            path_length = sum(row.count(0) for row in solution)
            print(f"Path length: {path_length:,} cells")
    except ValueError as e:
        print(f"Error: {e}")