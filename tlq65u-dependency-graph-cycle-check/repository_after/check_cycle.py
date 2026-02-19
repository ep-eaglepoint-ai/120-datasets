def hasCycle(numTasks: int, dependencies: list[tuple[int, int]]) -> bool:
    """
    Detects if a cycle exists in a directed graph of task dependencies
    using Kahn's Algorithm for Topological Sorting.
    """
    # Initialize adjacency list and in-degree array
    # adj: O(V + E) space
    # in_degree: O(V) space
    adj = [[] for _ in range(numTasks)]
    in_degree = [0] * numTasks

    # Build the graph
    # Time: O(E)
    for u, v in dependencies:
        adj[u].append(v)
        in_degree[v] += 1

    # Initialize queue with nodes that have 0 in-degree (no dependencies)
    # Using a list as a stack/queue is efficient O(1) for append/pop
    zero_in_degree = [i for i in range(numTasks) if in_degree[i] == 0]

    processed_count = 0

    # Process nodes
    # Time: O(V + E) - each node popped once, each edge traversed once
    while zero_in_degree:
        u = zero_in_degree.pop()
        processed_count += 1

        for v in adj[u]:
            in_degree[v] -= 1
            if in_degree[v] == 0:
                zero_in_degree.append(v)

    # If we processed fewer nodes than exist in the graph,
    # the remaining nodes are part of a cycle (or dependent on a cycle).
    return processed_count != numTasks