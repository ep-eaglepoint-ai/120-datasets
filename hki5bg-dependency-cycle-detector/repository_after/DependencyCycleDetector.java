import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Detects cycles in a directed dependency graph.
 *
 * <p>Interpretation: if task A depends on task B, there is a directed edge A -> B.
 * A configuration is invalid if any directed cycle exists, including self-dependencies.
 *
 * <p>Algorithm: Kahn's topological sort. Runs in O(V + E) time and O(V + E) memory.
 */
public final class DependencyCycleDetector {

    private DependencyCycleDetector() {
        // utility class
    }

    /**
     * Returns true if the dependency configuration contains any cycles.
     *
     * @param dependencies map from task -> collection of tasks it depends on.
     *                     A null collection is treated as empty.
     * @return true if there is a cycle; false otherwise
     * @throws IllegalArgumentException if a task id or dependency id is null
     */
    public static boolean containsCycle(Map<String, ? extends Collection<String>> dependencies) {
        Objects.requireNonNull(dependencies, "dependencies");

        Map<String, List<String>> adjacency = new HashMap<>();
        Map<String, Integer> indegree = new HashMap<>();
        Set<String> allNodes = new HashSet<>();

        for (Map.Entry<String, ? extends Collection<String>> entry : dependencies.entrySet()) {
            String task = entry.getKey();
            if (task == null) {
                throw new IllegalArgumentException("Task id must not be null");
            }
            allNodes.add(task);

            Collection<String> deps = entry.getValue();
            if (deps == null) {
                deps = List.of();
            }

            List<String> out = adjacency.computeIfAbsent(task, k -> new ArrayList<>());
            for (String dep : deps) {
                if (dep == null) {
                    throw new IllegalArgumentException("Dependency id must not be null (task=" + task + ")");
                }
                if (task.equals(dep)) {
                    return true;
                }

                out.add(dep);
                allNodes.add(dep);

                // Ensure dep is present in maps.
                indegree.put(dep, indegree.getOrDefault(dep, 0) + 1);
                indegree.putIfAbsent(task, indegree.getOrDefault(task, 0));
                adjacency.computeIfAbsent(dep, k -> new ArrayList<>());
            }
        }

        // Include isolated tasks (keys with empty deps) that might not have been put into adjacency.
        for (String node : allNodes) {
            adjacency.computeIfAbsent(node, k -> new ArrayList<>());
            indegree.putIfAbsent(node, 0);
        }

        // Initialize queue with all nodes having indegree 0.
        Deque<String> queue = new ArrayDeque<>();
        for (Map.Entry<String, Integer> entry : indegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        int processed = 0;
        while (!queue.isEmpty()) {
            String node = queue.removeFirst();
            processed++;

            for (String neighbor : adjacency.get(node)) {
                int newDegree = indegree.get(neighbor) - 1;
                indegree.put(neighbor, newDegree);
                if (newDegree == 0) {
                    queue.addLast(neighbor);
                }
            }
        }

        // If we couldn't process every node, some nodes are part of a cycle.
        return processed != indegree.size();
    }
}
