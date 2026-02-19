import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class DependencyCycleDetectorTest {

    @Test
    void emptyGraphIsAcyclic() {
        assertFalse(DependencyCycleDetector.containsCycle(Map.of()));
    }

    @Test
    void singleNodeNoDependenciesIsAcyclic() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of());
        assertFalse(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void selfDependencyIsCycle() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of("A"));
        assertTrue(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void twoNodeCycleIsDetected() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of("B"));
        deps.put("B", List.of("A"));
        assertTrue(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void longerCycleIsDetected() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of("B"));
        deps.put("B", List.of("C"));
        deps.put("C", List.of("D"));
        deps.put("D", List.of("B")); // cycle B -> C -> D -> B
        assertTrue(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void disconnectedAcyclicGraphIsAccepted() {
        Map<String, List<String>> deps = new HashMap<>();

        // Component 1: A -> B -> C
        deps.put("A", List.of("B"));
        deps.put("B", List.of("C"));
        deps.put("C", List.of());

        // Component 2: X -> Y, Z isolated
        deps.put("X", List.of("Y"));
        deps.put("Z", List.of());

        assertFalse(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void cycleInDisconnectedComponentIsDetected() {
        Map<String, List<String>> deps = new HashMap<>();

        // Acyclic component
        deps.put("A", List.of("B"));
        deps.put("B", List.of());

        // Cyclic component
        deps.put("X", List.of("Y"));
        deps.put("Y", List.of("X"));

        assertTrue(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void dependencyNodeNotDeclaredAsKeyIsHandled() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of("B")); // B never appears as a key
        assertFalse(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void nullDependencyCollectionTreatedAsEmpty() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", null);
        deps.put("B", List.of("A"));
        assertFalse(DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void nullTaskIdIsRejected() {
        Map<String, List<String>> deps = new HashMap<>();
        deps.put(null, List.of("A"));
        assertThrows(IllegalArgumentException.class, () -> DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void nullDependencyIdIsRejected() {
        Map<String, List<String>> deps = new HashMap<>();
        java.util.ArrayList<String> listWithNull = new java.util.ArrayList<>();
        listWithNull.add(null);
        deps.put("A", listWithNull);
        assertThrows(IllegalArgumentException.class, () -> DependencyCycleDetector.containsCycle(deps));
    }

    @Test
    void scalesToLargeInputChainWithoutCycle() {
        int n = 50_000;
        Map<String, List<String>> deps = new HashMap<>(n * 2);

        for (int i = 0; i < n - 1; i++) {
            deps.put("T" + i, List.of("T" + (i + 1)));
        }
        deps.put("T" + (n - 1), List.of());

        boolean hasCycle = assertTimeoutPreemptively(
                Duration.ofSeconds(5),
                () -> DependencyCycleDetector.containsCycle(deps)
        );
        assertFalse(hasCycle);
    }

    @Test
    void scalesToLargeInputWithCycle() {
        int n = 30_000;
        Map<String, List<String>> deps = new HashMap<>(n * 2);

        for (int i = 0; i < n - 1; i++) {
            deps.put("T" + i, List.of("T" + (i + 1)));
        }
        deps.put("T" + (n - 1), List.of("T" + (n - 10)));

        boolean hasCycle = assertTimeoutPreemptively(
                Duration.ofSeconds(5),
                () -> DependencyCycleDetector.containsCycle(deps)
        );
        assertTrue(hasCycle);
    }

    @Test
    void diamondDependencyIsAcyclic() {
        // Diamond structure:
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("Top", List.of("Left", "Right"));
        deps.put("Left", List.of("Bottom"));
        deps.put("Right", List.of("Bottom"));
        deps.put("Bottom", List.of());

        assertFalse(DependencyCycleDetector.containsCycle(deps),
            "Diamond graph (multiple paths to same node) should be acyclic");
    }

    @Test
    void duplicateDependencyDefinitionsAreHandled() {
        // A -> B declared twice. This is not a cycle, just redundancy.
        Map<String, List<String>> deps = new HashMap<>();
        deps.put("A", List.of("B", "B"));
        deps.put("B", List.of());

        assertFalse(DependencyCycleDetector.containsCycle(deps),
            "Duplicate dependency entries should not cause cycle detection errors");
    }

    @Test
    void scalesToHighDegreeNode() {
        int n = 50000;
        Map<String, List<String>> deps = new HashMap<>();

        List<String> leaves = new java.util.ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            String leaf = "Leaf" + i;
            leaves.add(leaf);
            deps.put(leaf, List.of());
        }

        deps.put("Center", leaves);

        boolean hasCycle = assertTimeoutPreemptively(
                Duration.ofSeconds(5),
                () -> DependencyCycleDetector.containsCycle(deps)
        );
        assertFalse(hasCycle);
    }
}
