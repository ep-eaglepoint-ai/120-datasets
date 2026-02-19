# Trajectory: Dependency Graph Cycle Check

**Subject:** Efficiently detecting circular dependencies in large-scale build systems (≤ 105 tasks)

## 1. Audit (The Context & Scaling Risks)

**Goal:** Identify why naive approaches fail and establish the constraints for the build system.

- **The Context**
  We are building a scheduler for a system with up to **100,000 tasks**.
  Tasks depend on each other (A → B means A must complete before B can start).

- **The Problem**
  A cycle (A → B → A) creates a deadlock.
  Cycle detection **must** happen before any task execution begins.

- **Scaling Risks Identified**

  - **Recursion Depth**
    Standard DFS (using call stack recursion) crashes on a linear chain of ~10,000 nodes
    → Python’s default recursion limit → `RecursionError`

  - **Memory Explosion**
    Adjacency Matrix for 105 nodes requires ~1010 integers
    → ≈ 40 GB RAM (completely unacceptable)

  - **Time Complexity**
    Naïve O(N²) path checking or Floyd-Warshall style approaches time out
    with up to ~2×10⁵ edges

## 2. Define the Performance Contract

**Goal:** Set non-negotiable boundaries for any acceptable solution.

- **Time Complexity**
  Must be **linear** — **O(V + E)**

- **Space Complexity**
  Must be **linear in vertices** — **O(V)**
  (sparse representation only — no dense matrix)

- **Stack Safety**
  **Iterative only**.
  No recursive function calls whose depth depends on graph depth.

- **Correctness Invariants**

  - Must correctly handle disconnected sub-graphs (forest / multiple components)
  - Must detect self-loops (`A → A`)
  - Must tolerate (and correctly ignore) duplicate edges without crashing or wrong results

## 3. Rework the Data Model

**Goal:** Structure the data to satisfy the O(V) space contract.

- **Adjacency List**
  `adj = [[] for _ in range(num_tasks)]`
  `adj[u].append(v)` means task u must finish before v can start

- **In-Degree Array**
  `in_degree = [0] * num_tasks`
  Counts how many unfinished prerequisites each task still has

- **Queue**
  Simple list (or `collections.deque`) holding nodes that currently have **zero** unsatisfied dependencies
  (ready to be "processed" / "completed")

## 4. Execution (Kahn’s Algorithm)

**Goal:** Implement the logic using an iterative "peeling" strategy (Topological Sort).

### Step 1: Graph Construction (O(E))

Iterate through dependencies once. Populate `adj` and increment `in_degree`.

**Optimization:** Ignore duplicate edge handling logic if it doesn't affect count correctness, or rely on the algorithm's robustness (Kahn's handles duplicates naturally by just incrementing counters).

### Step 2: Initialization (O(V))

Scan `in_degree` to find all nodes with 0 dependencies. These are our starting points.

### Step 3: Iterative Processing (O(V + E))

While the queue is not empty:

- Pop a node `u`.
- Increment `processed_count`.
- For every neighbor `v` of `u`:
  - Decrement `in_degree[v]`.
  - If `in_degree[v]` becomes 0, add `v` to the queue.

**Why this works:** We simulate "completing" tasks. If a cycle exists, the nodes in the cycle will never reach in-degree 0 and will never be added to the queue.

### Step 4: The Verdict

- If `processed_count == numTasks`, the graph is a DAG (Directed Acyclic Graph).
- If `processed_count < numTasks`, a cycle exists (the remaining nodes are locked in a dependency loop).
