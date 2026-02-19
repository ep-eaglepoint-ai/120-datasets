# Trajectory

### 1. Audit the Original Code (Identify Scaling Problems)

I audited the original implementation. It utilized **Recursive Depth-First Search (DFS)**. It relied on the system call stack for backtracking, created a full $N \times N$ `solutions` matrix, and did not guarantee the shortest path.

- **Recursion Limit:** On mazes larger inputs, it crashed with `RecursionError`.
- **Sub-optimal Paths:** DFS prioritizes depth; it often returned winding, inefficient paths instead of the direct route.
- **Memory Overhead:** Maintaining a separate solution grid doubled the memory footprint.

I understood about Recursion vs. Iteration limits:\_
[Python Recursion Limits and Stack Overflow](https://docs.python.org/3/library/sys.html#sys.setrecursionlimit)

### 2. Define a Performance Contract First

I defined strict performance and functional conditions before writing code:

- **Optimality:** The solution _must_ return the shortest possible path (mandating BFS).
- **Scalability:** Must handle large grids without stack overflow (mandating Iterative approach).
- **Strict Return Signature:** Must return `([], 0)` if no solution exists, not raise an Exception.
- **Input Validity:** Fail fast on empty inputs, walls at endpoints, or out-of-bounds coordinates.

### 3. Rework the Data Model for Efficiency

I replaced the implicit Call Stack with an explicit `collections.deque` and removed the auxiliary `solutions` matrix.

- **In-Place Modification:** Instead of a `visited` set or matrix, I modified the input `maze` in-place (marking cells as `-1`) to track visited status. This significantly reduced memory pressure.
- **Parent Tracking:** Introduced a `parents` dictionary `{child_coord: parent_coord}` to enable $O(L)$ path reconstruction without re-traversing the grid.

### 4. Rebuild the Search as a Projection-First Pipeline (BFS)

The search pipeline was shifted from DFS (Stack) to BFS (Queue).

- **Level-Order Traversal:** By exploring all neighbors at distance $d$ before $d+1$, we guarantee that the first time we see the destination, we have found the shortest path.
- **Early Exit:** The algorithm terminates the moment the destination is identified, rather than exploring the remaining graph.

### 5. Move Filters to the Entry Point (Validation)

All "filters" (edge case checks) were moved to the very beginning of the function.

- Checking for Empty Mazes, Out-of-Bounds, and Start/End Walls happens _before_ any queue allocation. This prevents wasted cycles on invalid states.

### 6. Use `deque` Instead of Recursion / Lists

I implemented the frontier using `collections.deque`.

- `popleft()` is $O(1)$, whereas popping from the start of a standard list is $O(N)$. This is critical for BFS performance.

### 7. Stable Path Reconstruction

I implemented a deterministic backtracking loop.

- Once the destination is found, the `parents` dictionary is traversed in reverse (Destination $\rightarrow$ Source).
- This ensures the path returned is exactly the one discovered by BFS, maintaining the optimality guarantee.

### 8. Eliminate N+1 Redundancy in Checks

I optimized the neighbor expansion loop.

- Boundary checks (`in_bounds`) and Wall checks (`maze[nr][nc] == 0`) are combined.
- Cells are marked as visited (`-1`) _immediately_ upon being added to the queue, preventing the same node from being added multiple times by different neighbors (eliminating duplicate processing).

### 9. Normalize for strict Return Types

The final logic branch was normalized to handle the "No Solution" state.

- Instead of letting the function finish and return `None` or crash, specific logic checks if the destination was reached.
- If not reached, it strictly returns `([], 0)` to satisfy the contract defined in Step 2.

### 10. Result: Measurable Performance Gains + Predictable Signals

The solution consistently solves large input mazes in under a limited second (vs. crash on original). It uses constant stack space, linear heap memory relative to visited nodes, and guarantees mathematical optimality for path length.

---
