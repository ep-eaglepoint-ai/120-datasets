# Trajectory - Dependency Cycle Detector

Goal: Build a Java cycle-detection function for task dependency graphs that scales to large inputs with linear time and memory.

1. Audit (The "Current State")

Identify the specific inputs, bottlenecks, or existing conditions before starting.

Target: Dependency configuration modeled as a directed graph (tasks = nodes, “A depends on B” = directed edge A → B)

Problems/Inputs:

- Real-world configurations can be large and disconnected; a correct solution must analyze all components, not just the component reachable from an arbitrary start node.
- Invalid configurations may include:
  - Simple cycles (A → B → A)
  - Longer cycles (A → … → A)
  - Self-dependencies (A → A)
- Naive strategies (enumerating paths or using an adjacency matrix) violate performance/memory constraints.

2. Define the Contract (The "Rules")

Set the non-negotiable constraints and guarantees before writing logic.

Constraints:

- Runtime must be linear: O(V + E)
- Additional memory must be linear: O(V + E)
- No brute-force path enumeration
- No adjacency matrix

Guarantees:

- All cyclic configurations are detected (rejected).
- All acyclic configurations are accepted.
- Disconnected graphs are handled correctly (cycle detection is global, not per-start-node).
- A task depending on itself is treated as a cycle.

3. Structural Design (The "Skeleton")

Rework the foundation to support the contract.

Data/Model Changes:

- Use an adjacency list (not a matrix) to represent edges efficiently.
- Track indegree counts per node to support a linear-time cycle check.
- Treat tasks that only appear as dependencies (not as “map keys”) as real nodes; otherwise the analysis can be incomplete.

Architecture:

- Choose an iterative, linear algorithm that works on disconnected graphs:
  - Kahn’s topological sort (queue-based)
  - Rationale: if a directed graph has a cycle, it is impossible to remove all nodes by repeatedly removing indegree-0 nodes.
- Add a fast-path check for the explicit self-dependency case (A → A).

4. Execution Pipeline (The "Implementation")

The specific steps to transform inputs into outputs based on the structure.

Step A (Input normalization):

- Interpret each “task depends on dep” as an edge task → dep.
- Build the full node set from both task keys and dependency values.
- If any dependency equals its task (A depends on A), immediately classify as cyclic.

Step B (Cycle detection logic):

- Build:
  - adjacency list for outgoing edges
  - indegree count for each node
- Initialize a queue with all nodes whose indegree is 0.
- Repeatedly pop from the queue and decrement neighbors’ indegrees.
- Count how many nodes were processed.

Step C (Decision):

- If processed node count != total node count, there exists at least one cycle.
- Otherwise, the graph is acyclic.

5. Verification (The "Proof")

Measurable signals that the contract was met.

Success Metrics:

- Correctness cases:
  - Self-dependency is detected as cyclic.
  - Cycles in any component (including disconnected ones) are detected.
  - Acyclic disconnected graphs are accepted.
  - Nodes that appear only as dependencies do not break correctness.
- Performance cases:
  - Large acyclic graphs complete quickly without recursion/stack overflow.
  - Large cyclic graphs are detected without non-linear blowups.

Validation Method:

- Unit tests cover each requirement and edge case explicitly.
- Large-input tests use time bounds to guard against accidental quadratic behavior.
