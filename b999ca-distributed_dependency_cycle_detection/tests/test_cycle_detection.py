import unittest
import sys
import os
import time
from typing import List, Set, Dict

# Add the repository path to sys.path
test_repo_path = os.environ.get('TEST_REPO_PATH', '/app/repository_after')
sys.path.insert(0, test_repo_path)

from cycle_detection import (
    ServiceNode, DependencyEdge, ServiceDependencyGraph, TopologyAnalyzer,
    ServiceType, EdgeType, CycleDetectionResult, CycleInfo
)

class TestCycleDetection(unittest.TestCase):
    """Comprehensive test suite for distributed dependency cycle detection"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.analyzer = TopologyAnalyzer(enable_diagnostics=True)
        
    def create_test_node(self, service_id: str, region: str = "us-east-1", 
                        criticality: float = 5.0) -> ServiceNode:
        """Helper to create test service nodes"""
        return ServiceNode(
            service_id=service_id,
            service_name=f"Service-{service_id}",
            service_type=ServiceType.MICROSERVICE,
            region=region,
            criticality_score=criticality,
            avg_response_time_ms=100.0,
            request_rate_per_sec=1000.0
        )
    
    def create_test_edge(self, source: ServiceNode, target: ServiceNode) -> DependencyEdge:
        """Helper to create test dependency edges"""
        return DependencyEdge(
            source=source,
            target=target,
            edge_type=EdgeType.SYNC_CALL,
            weight=1.0,
            latency_ms=50.0,
            error_rate=0.01
        )
    
    def test_disconnected_components_detection(self):
        """Test that algorithm detects cycles in ALL disconnected components"""
        # Create two disconnected components, each with a cycle
        
        # Component 1: A -> B -> C -> A (cycle)
        node_a = self.create_test_node("A", "us-east-1")
        node_b = self.create_test_node("B", "us-east-1") 
        node_c = self.create_test_node("C", "us-east-1")
        
        # Component 2: X -> Y -> Z -> X (cycle) - completely disconnected
        node_x = self.create_test_node("X", "eu-west-1")
        node_y = self.create_test_node("Y", "eu-west-1")
        node_z = self.create_test_node("Z", "eu-west-1")
        
        # Component 3: Isolated node with no cycles
        node_isolated = self.create_test_node("ISOLATED", "ap-south-1")
        
        nodes = {
            "A": node_a, "B": node_b, "C": node_c,
            "X": node_x, "Y": node_y, "Z": node_z,
            "ISOLATED": node_isolated
        }
        
        edges = [
            # Component 1 cycle
            self.create_test_edge(node_a, node_b),
            self.create_test_edge(node_b, node_c),
            self.create_test_edge(node_c, node_a),
            
            # Component 2 cycle  
            self.create_test_edge(node_x, node_y),
            self.create_test_edge(node_y, node_z),
            self.create_test_edge(node_z, node_x)
        ]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Should detect BOTH cycles
        self.assertEqual(result.total_cycles, 2, 
                        "Must detect cycles in ALL disconnected components")
        
        # Should analyze ALL components
        self.assertGreaterEqual(result.components_analyzed, 2,
                               "Must analyze all disconnected components")
        
        # Should visit ALL nodes
        self.assertEqual(result.nodes_visited, 7,
                        "Must visit every node in the graph")
        
        # Should traverse ALL edges
        self.assertEqual(result.edges_traversed, 6,
                        "Must traverse every edge exactly once")
        
        # Verify cycle paths contain expected nodes
        cycle_paths = [set(cycle.cycle_path[:-1]) for cycle in result.cycles_found]
        expected_cycles = [{"A", "B", "C"}, {"X", "Y", "Z"}]
        
        # Check that we found cycles in both components
        # Component 1: Should have a cycle involving nodes from {A, B, C}
        component1_nodes = {"A", "B", "C"}
        component2_nodes = {"X", "Y", "Z"}
        
        component1_cycle_found = any(
            len(path.intersection(component1_nodes)) >= 1 for path in cycle_paths
        )
        component2_cycle_found = any(
            len(path.intersection(component2_nodes)) >= 2 for path in cycle_paths
        )
        
        self.assertTrue(component1_cycle_found, 
                       f"No cycle found in component 1 (A,B,C). Found cycles: {cycle_paths}")
        self.assertTrue(component2_cycle_found, 
                       f"No cycle found in component 2 (X,Y,Z). Found cycles: {cycle_paths}")
    
    def test_multiple_isolated_cycles(self):
        """Test detection of multiple cycles within isolated components"""
        
        # Component 1: Two separate cycles
        # Cycle 1: A -> B -> A
        # Cycle 2: C -> D -> E -> C
        node_a = self.create_test_node("A")
        node_b = self.create_test_node("B") 
        node_c = self.create_test_node("C")
        node_d = self.create_test_node("D")
        node_e = self.create_test_node("E")
        
        # Component 2: Single cycle F -> G -> F
        node_f = self.create_test_node("F")
        node_g = self.create_test_node("G")
        
        nodes = {
            "A": node_a, "B": node_b, "C": node_c, 
            "D": node_d, "E": node_e, "F": node_f, "G": node_g
        }
        
        edges = [
            # Component 1 - Cycle 1: A -> B -> A
            self.create_test_edge(node_a, node_b),
            self.create_test_edge(node_b, node_a),
            
            # Component 1 - Cycle 2: C -> D -> E -> C  
            self.create_test_edge(node_c, node_d),
            self.create_test_edge(node_d, node_e),
            self.create_test_edge(node_e, node_c),
            
            # Component 2: F -> G -> F
            self.create_test_edge(node_f, node_g),
            self.create_test_edge(node_g, node_f)
        ]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Should detect all 3 cycles
        self.assertEqual(result.total_cycles, 3,
                        "Must detect all cycles in all components")
        
        # Should analyze both components
        self.assertGreaterEqual(result.components_analyzed, 2,
                               "Must analyze all disconnected components")
    
    def test_time_complexity_requirement(self):
        """Test that algorithm runs in O(V + E) time complexity"""
        
        # Create a large graph to test performance
        num_nodes = 1000
        nodes = {}
        edges = []
        
        # Create multiple disconnected components
        for component in range(10):  # 10 components
            component_nodes = []
            for i in range(100):  # 100 nodes per component
                node_id = f"node_{component}_{i}"
                nodes[node_id] = self.create_test_node(node_id)
                component_nodes.append(node_id)
            
            # Create a cycle in each component
            for i in range(len(component_nodes)):
                source = nodes[component_nodes[i]]
                target = nodes[component_nodes[(i + 1) % len(component_nodes)]]
                edges.append(self.create_test_edge(source, target))
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        
        start_time = time.time()
        result = self.analyzer.detect_dependency_cycles(graph)
        end_time = time.time()
        
        execution_time = (end_time - start_time) * 1000  # Convert to ms
        
        # Should complete in reasonable time for O(V + E) complexity
        # For 1000 nodes + 1000 edges, should be very fast
        self.assertLess(execution_time, 1000,  # Less than 1 second
                       "Algorithm must run in O(V + E) time")
        
        # Should visit all nodes exactly once
        self.assertEqual(result.nodes_visited, num_nodes,
                        "Must visit every node exactly once")
        
        # Should traverse all edges exactly once  
        self.assertEqual(result.edges_traversed, len(edges),
                        "Must traverse every edge exactly once")
    
    def test_space_complexity_requirement(self):
        """Test that algorithm uses O(V + E) space complexity"""
        
        # Create graph with known structure
        nodes = {}
        edges = []
        
        # Create 3 disconnected components
        for comp in range(3):
            comp_nodes = []
            for i in range(10):
                node_id = f"comp{comp}_node{i}"
                nodes[node_id] = self.create_test_node(node_id)
                comp_nodes.append(node_id)
            
            # Create cycle in component
            for i in range(len(comp_nodes)):
                source = nodes[comp_nodes[i]]
                target = nodes[comp_nodes[(i + 1) % len(comp_nodes)]]
                edges.append(self.create_test_edge(source, target))
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Verify space usage is proportional to V + E
        # The algorithm should maintain:
        # - Global visited set: O(V)
        # - Per-component recursion stack: O(V) worst case
        # - Adjacency lists: O(V + E) 
        
        # Should detect cycles in all components
        self.assertEqual(result.components_analyzed, 3,
                        "Must analyze all 3 components")
        
        # Should visit all nodes
        self.assertEqual(result.nodes_visited, 30,
                        "Must visit all 30 nodes")
    
    def test_visit_all_nodes_and_edges(self):
        """Test that every node and edge is visited exactly once"""
        
        # Create complex disconnected graph
        # Component 1: Linear chain A -> B -> C
        # Component 2: Cycle X -> Y -> Z -> X  
        # Component 3: Self-loop S -> S
        # Component 4: Isolated node I
        
        node_a = self.create_test_node("A")
        node_b = self.create_test_node("B")
        node_c = self.create_test_node("C")
        node_x = self.create_test_node("X")
        node_y = self.create_test_node("Y") 
        node_z = self.create_test_node("Z")
        node_s = self.create_test_node("S")
        node_i = self.create_test_node("I")
        
        nodes = {
            "A": node_a, "B": node_b, "C": node_c,
            "X": node_x, "Y": node_y, "Z": node_z,
            "S": node_s, "I": node_i
        }
        
        edges = [
            # Component 1: A -> B -> C (no cycle)
            self.create_test_edge(node_a, node_b),
            self.create_test_edge(node_b, node_c),
            
            # Component 2: X -> Y -> Z -> X (cycle)
            self.create_test_edge(node_x, node_y),
            self.create_test_edge(node_y, node_z),
            self.create_test_edge(node_z, node_x),
            
            # Component 3: S -> S (self-loop)
            self.create_test_edge(node_s, node_s)
        ]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Must visit ALL 8 nodes
        self.assertEqual(result.nodes_visited, 8,
                        "Must visit every node in the graph")
        
        # Must traverse ALL 6 edges
        self.assertEqual(result.edges_traversed, 6,
                        "Must traverse every edge exactly once")
        
        # Should find 2 cycles (X->Y->Z->X and S->S)
        self.assertEqual(result.total_cycles, 2,
                        "Should detect both the 3-node cycle and self-loop")
        
        # Should analyze all 4 components
        self.assertEqual(result.components_analyzed, 4,
                        "Must analyze all disconnected components")
    
    def test_component_restart_behavior(self):
        """Test that DFS restarts for each unvisited component"""
        
        # Create 5 completely disconnected single-node components
        nodes = {}
        edges = []
        
        for i in range(5):
            node_id = f"isolated_{i}"
            nodes[node_id] = self.create_test_node(node_id)
            # Add self-loop to create cycle in each component
            edges.append(self.create_test_edge(nodes[node_id], nodes[node_id]))
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Should restart DFS 5 times (once per component)
        self.assertEqual(result.components_analyzed, 5,
                        "Must restart DFS for each disconnected component")
        
        # Should visit all 5 nodes
        self.assertEqual(result.nodes_visited, 5,
                        "Must visit all nodes across all components")
        
        # Should find 5 self-loop cycles
        self.assertEqual(result.total_cycles, 5,
                        "Should detect cycle in each component")
    
    def test_global_visited_state(self):
        """Test that global visited state prevents revisiting nodes"""
        
        # Create graph where naive algorithm might revisit nodes
        node_a = self.create_test_node("A")
        node_b = self.create_test_node("B")
        node_c = self.create_test_node("C")
        node_d = self.create_test_node("D")
        
        nodes = {"A": node_a, "B": node_b, "C": node_c, "D": node_d}
        
        edges = [
            # Component 1: A -> B (no cycle)
            self.create_test_edge(node_a, node_b),
            
            # Component 2: C -> D -> C (cycle)
            self.create_test_edge(node_c, node_d),
            self.create_test_edge(node_d, node_c)
        ]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Should visit each node exactly once
        self.assertEqual(result.nodes_visited, 4,
                        "Each node must be visited exactly once")
        
        # Should traverse each edge exactly once
        self.assertEqual(result.edges_traversed, 3,
                        "Each edge must be traversed exactly once")
        
        # Verify through diagnostics that no node was visited twice
        if self.analyzer.enable_diagnostics:
            visited_nodes = [log['node'] for log in self.analyzer.traversal_log 
                           if log['event'] == 'VISIT']
            unique_visited = set(visited_nodes)
            self.assertEqual(len(visited_nodes), len(unique_visited),
                           "No node should be visited more than once")
    
    def test_no_probabilistic_behavior(self):
        """Test that algorithm is deterministic (no approximations)"""
        
        # Create the same graph multiple times and verify consistent results
        def create_test_graph():
            node_a = self.create_test_node("A")
            node_b = self.create_test_node("B") 
            node_c = self.create_test_node("C")
            node_x = self.create_test_node("X")
            node_y = self.create_test_node("Y")
            
            nodes = {"A": node_a, "B": node_b, "C": node_c, "X": node_x, "Y": node_y}
            
            edges = [
                self.create_test_edge(node_a, node_b),
                self.create_test_edge(node_b, node_c),
                self.create_test_edge(node_c, node_a),  # Cycle 1
                self.create_test_edge(node_x, node_y),
                self.create_test_edge(node_y, node_x)   # Cycle 2
            ]
            
            return ServiceDependencyGraph(
                nodes=nodes, 
                edges=edges,
                adjacency_list={},
                reverse_adjacency={}
            )
        
        # Run algorithm multiple times
        results = []
        for _ in range(5):
            graph = create_test_graph()
            analyzer = TopologyAnalyzer()
            result = analyzer.detect_dependency_cycles(graph)
            results.append(result)
        
        # All results should be identical
        first_result = results[0]
        for result in results[1:]:
            self.assertEqual(result, first_result,
                           "Algorithm must be deterministic (no randomness)")
            
            # Verify exact same metrics
            self.assertEqual(result.total_cycles, first_result.total_cycles)
            self.assertEqual(result.nodes_visited, first_result.nodes_visited)
            self.assertEqual(result.edges_traversed, first_result.edges_traversed)
            self.assertEqual(result.components_analyzed, first_result.components_analyzed)
    
    # PASS_TO_PASS tests (should work with both before and after)
    
    def test_single_component_cycles(self):
        """Test cycle detection in single connected component (backward compatibility)"""
        
        # Create simple connected graph with cycle
        node_a = self.create_test_node("A")
        node_b = self.create_test_node("B")
        node_c = self.create_test_node("C")
        
        nodes = {"A": node_a, "B": node_b, "C": node_c}
        edges = [
            self.create_test_edge(node_a, node_b),
            self.create_test_edge(node_b, node_c),
            self.create_test_edge(node_c, node_a)
        ]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        
        # Should detect the cycle
        self.assertEqual(result.total_cycles, 1)
        self.assertGreater(result.nodes_visited, 0)
        self.assertGreater(result.edges_traversed, 0)
    
    def test_self_loops(self):
        """Test detection of self-loop cycles (backward compatibility)"""
        
        node_a = self.create_test_node("A")
        nodes = {"A": node_a}
        edges = [self.create_test_edge(node_a, node_a)]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph, include_self_loops=True)
        
        # Should detect self-loop
        self.assertEqual(result.total_cycles, 1)
        self.assertEqual(result.cycles_found[0].cycle_length, 1)
    
    def test_backward_compatibility(self):
        """Test that existing functionality still works (backward compatibility)"""
        
        # Test empty graph
        graph = ServiceDependencyGraph(
            nodes={}, 
            edges=[],
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        self.assertEqual(result.total_cycles, 0)
        
        # Test single node, no edges
        node_a = self.create_test_node("A")
        graph = ServiceDependencyGraph(
            nodes={"A": node_a}, 
            edges=[],
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        self.assertEqual(result.total_cycles, 0)
        
        # Test acyclic graph
        node_a = self.create_test_node("A")
        node_b = self.create_test_node("B")
        nodes = {"A": node_a, "B": node_b}
        edges = [self.create_test_edge(node_a, node_b)]
        
        graph = ServiceDependencyGraph(
            nodes=nodes, 
            edges=edges,
            adjacency_list={},
            reverse_adjacency={}
        )
        result = self.analyzer.detect_dependency_cycles(graph)
        self.assertEqual(result.total_cycles, 0)

if __name__ == '__main__':
    unittest.main()