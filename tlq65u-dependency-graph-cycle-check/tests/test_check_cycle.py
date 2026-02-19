import unittest
import sys
import os
from repository_after.check_cycle import hasCycle

class TestHasCycle(unittest.TestCase):

    def test_simple_acyclic(self):
        """Return false if no cycles exist (Linear chain 0->1->2)."""
        numTasks = 3
        deps = [(0, 1), (1, 2)]
        self.assertFalse(hasCycle(numTasks, deps))

    def test_simple_cycle(self):
        """Return true if cycle exists (0->1->0)."""
        numTasks = 2
        deps = [(0, 1), (1, 0)]
        self.assertTrue(hasCycle(numTasks, deps))

    def test_self_loop(self):
        """A task depending on itself is a cycle."""
        numTasks = 1
        deps = [(0, 0)]
        self.assertTrue(hasCycle(numTasks, deps))

    def test_disconnected_graph_with_cycle(self):
        """Handle disconnected graphs and independent cycles."""
        # 0->1 (ok), 2->3->2 (cycle)
        numTasks = 4
        deps = [(0, 1), (2, 3), (3, 2)]
        self.assertTrue(hasCycle(numTasks, deps))

    def test_disconnected_graph_no_cycle(self):
        """Handle disconnected graphs validly."""
        # 0->1, 2->3
        numTasks = 4
        deps = [(0, 1), (2, 3)]
        self.assertFalse(hasCycle(numTasks, deps))

    def test_diamond_graph_no_cycle(self):
        """Brute force path enum check (Diamond shape should not flag cycle)."""
        # 0->1, 0->2, 1->3, 2->3
        numTasks = 4
        deps = [(0, 1), (0, 2), (1, 3), (2, 3)]
        self.assertFalse(hasCycle(numTasks, deps))

    def test_no_edges(self):
        """Work even if graph has no edges."""
        numTasks = 5
        deps = []
        self.assertFalse(hasCycle(numTasks, deps))

    def test_duplicate_dependencies_no_cycle(self):
        """Duplicate dependencies must not affect correctness."""
        # 0->1 appearing twice is technically valid DAG
        numTasks = 2
        deps = [(0, 1), (0, 1)]
        self.assertFalse(hasCycle(numTasks, deps))

    def test_duplicate_dependencies_cycle(self):
        """Duplicate dependencies must not mask cycles."""
        numTasks = 2
        deps = [(0, 1), (1, 0), (0, 1)]
        self.assertTrue(hasCycle(numTasks, deps))

    def test_large_line_graph_stack_safety(self):
        """Large graph, deep recursion safety."""
        # 0->1->2...->9999
        # If implemented with standard recursion, this hits RecursionError ~1000
        numTasks = 10000
        deps = [(i, i + 1) for i in range(numTasks - 1)]
        self.assertFalse(hasCycle(numTasks, deps))

    def test_large_cycle(self):
        """Linear time complexity check (logic verification)."""
        # 0->1->...->9999->0
        numTasks = 10000
        deps = [(i, i + 1) for i in range(numTasks - 1)]
        deps.append((numTasks - 1, 0))
        self.assertTrue(hasCycle(numTasks, deps))

    def test_single_node_no_edge(self):
        """Edge case: 1 node, no deps."""
        self.assertFalse(hasCycle(1, []))

    def test_complex_cycle(self):
        """Test a cycle buried deep in dependencies."""
        # 0->1->2, 2->3, 3->4, 4->2 (cycle 2-3-4), 5->6
        numTasks = 7
        deps = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 2), (5, 6)]
        self.assertTrue(hasCycle(numTasks, deps))

if __name__ == '__main__':
    unittest.main()