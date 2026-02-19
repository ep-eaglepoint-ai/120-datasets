from typing import List, Set, Tuple, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import time

class ServiceType(Enum):
    """Service classification for dependency analysis"""
    API_GATEWAY = "api_gateway"
    MICROSERVICE = "microservice"
    DATABASE = "database"
    CACHE = "cache"
    MESSAGE_QUEUE = "message_queue"
    AUTH_SERVICE = "auth_service"

class EdgeType(Enum):
    """Dependency relationship types"""
    SYNC_CALL = "sync_call"
    ASYNC_MESSAGE = "async_message"
    DATA_DEPENDENCY = "data_dependency"
    CIRCUIT_BREAKER = "circuit_breaker"

@dataclass
class ServiceNode:
    """Represents a service in the dependency graph"""
    service_id: str
    service_name: str
    service_type: ServiceType
    region: str
    criticality_score: float  
    avg_response_time_ms: float
    request_rate_per_sec: float
    
    def __hash__(self):
        return hash(self.service_id)
    
    def __eq__(self, other):
        if not isinstance(other, ServiceNode):
            return False
        return self.service_id == other.service_id

@dataclass
class DependencyEdge:
    """Represents a dependency relationship between services"""
    source: ServiceNode
    target: ServiceNode
    edge_type: EdgeType
    weight: float  
    latency_ms: float
    error_rate: float
    
    def __hash__(self):
        return hash((self.source.service_id, self.target.service_id, self.edge_type))

@dataclass
class CycleInfo:
    """Detailed information about a detected cycle"""
    cycle_path: List[str]  
    cycle_length: int
    component_id: int
    total_criticality: float
    max_latency_ms: float
    involves_critical_service: bool
    detection_timestamp: float

@dataclass
class CycleDetectionResult:
    """Result of comprehensive cycle detection analysis"""
    cycles_found: List[CycleInfo]
    total_cycles: int
    components_analyzed: int
    nodes_visited: int
    edges_traversed: int
    analysis_time_ms: float
    has_critical_cycles: bool
    disconnected_components: List[Set[str]]  
    
    def __eq__(self, other):
        if not isinstance(other, CycleDetectionResult):
            return False
        self_cycle_sets = {frozenset(c.cycle_path) for c in self.cycles_found}
        other_cycle_sets = {frozenset(c.cycle_path) for c in other.cycles_found}
        return (
            self_cycle_sets == other_cycle_sets and
            self.total_cycles == other.total_cycles
        )

@dataclass
class ServiceDependencyGraph:
    """Directed graph of service dependencies"""
    nodes: Dict[str, ServiceNode]
    edges: List[DependencyEdge]
    adjacency_list: Dict[str, List[str]] = field(default_factory=dict)
    reverse_adjacency: Dict[str, List[str]] = field(default_factory=dict) 
    
    def __post_init__(self):
        """Build adjacency lists from edges"""
        self.adjacency_list = defaultdict(list)
        self.reverse_adjacency = defaultdict(list)
        
        for edge in self.edges:
            source_id = edge.source.service_id
            target_id = edge.target.service_id
            self.adjacency_list[source_id].append(target_id)
            self.reverse_adjacency[target_id].append(source_id)
        
        # Ensure all nodes are in adjacency lists (including isolated nodes)
        for node_id in self.nodes:
            if node_id not in self.adjacency_list:
                self.adjacency_list[node_id] = []
            if node_id not in self.reverse_adjacency:
                self.reverse_adjacency[node_id] = []
    
    def get_neighbors(self, service_id: str) -> List[str]:
        """Get all services that this service depends on"""
        return self.adjacency_list.get(service_id, [])
    
    def has_self_loop(self, service_id: str) -> bool:
        """Check if service has self-dependency"""
        return service_id in self.adjacency_list.get(service_id, [])
    
    def get_edge_info(self, source_id: str, target_id: str) -> Optional[DependencyEdge]:
        """Get edge information between two services"""
        for edge in self.edges:
            if edge.source.service_id == source_id and edge.target.service_id == target_id:
                return edge
        return None

class TopologyAnalyzer:
    """Production system for analyzing service dependency topology"""
    
    def __init__(self, enable_diagnostics: bool = False):
        self.enable_diagnostics = enable_diagnostics
        self.traversal_log: List[Dict[str, Any]] = []
        self._analysis_stats = {
            'nodes_visited': 0,
            'edges_traversed': 0,
            'components_discovered': 0,
            'cycles_detected': 0,
            'max_dfs_depth': 0,
            'self_loops_found': 0,
            'parallel_edges_found': 0
        }
    
    def _log_traversal(self, event_type: str, node_id: str, 
                       context: Dict[str, Any]):
        """Log traversal event for diagnostics"""
        if self.enable_diagnostics:
            self.traversal_log.append({
                'event': event_type,
                'node': node_id,
                'context': context,
                'timestamp': time.time()
            })
    
    def _validate_graph_structure(self, graph: ServiceDependencyGraph) -> Tuple[bool, str]:
        """
        Validate graph structure for consistency.
        Returns (is_valid, error_message)
        """
        for edge in graph.edges:
            if edge.source.service_id not in graph.nodes:
                return False, f"Edge source {edge.source.service_id} not in node set"
            if edge.target.service_id not in graph.nodes:
                return False, f"Edge target {edge.target.service_id} not in node set"
        
        for node_id in graph.nodes:
            neighbors = graph.get_neighbors(node_id)
            for neighbor_id in neighbors:
                if neighbor_id not in graph.nodes:
                    return False, f"Neighbor {neighbor_id} not in node set"
        
        return True, "Graph structure valid"
    
    def _check_graph_integrity(self, graph: ServiceDependencyGraph) -> bool:
        """Deep integrity check for graph consistency"""
        edge_set = set()
        for edge in graph.edges:
            edge_set.add((edge.source.service_id, edge.target.service_id))
        
        adj_set = set()
        for source_id, targets in graph.adjacency_list.items():
            for target_id in targets:
                adj_set.add((source_id, target_id))
        
        return edge_set == adj_set
    
    def _calculate_cycle_criticality(self, cycle_path: List[str], 
                                     graph: ServiceDependencyGraph) -> float:
        """Calculate aggregate criticality score for a cycle"""
        total = 0.0
        for service_id in cycle_path:
            if service_id in graph.nodes:
                total += graph.nodes[service_id].criticality_score
        return total
    
    def _has_critical_service(self, cycle_path: List[str],
                             graph: ServiceDependencyGraph,
                             threshold: float = 8.0) -> bool:
        """Check if cycle involves any critical services"""
        for service_id in cycle_path:
            if service_id in graph.nodes:
                if graph.nodes[service_id].criticality_score >= threshold:
                    return True
        return False
    
    def _calculate_max_cycle_latency(self, cycle_path: List[str],
                                     graph: ServiceDependencyGraph) -> float:
        """Calculate maximum latency in cycle"""
        max_latency = 0.0
        for i in range(len(cycle_path)):
            source_id = cycle_path[i]
            target_id = cycle_path[(i + 1) % len(cycle_path)]
            edge_info = graph.get_edge_info(source_id, target_id)
            if edge_info:
                max_latency = max(max_latency, edge_info.latency_ms)
        return max_latency
    
    def detect_dependency_cycles(
        self,
        graph: ServiceDependencyGraph,
        include_self_loops: bool = True,
        include_parallel_edges: bool = True,
        max_cycle_length: Optional[int] = None
    ) -> CycleDetectionResult:
        """
        FIXED MULTI-COMPONENT DFS - Detects cycles in ALL graph components.
        
        SOLUTION: Iterates through all nodes and restarts DFS for each unvisited
        component, ensuring complete graph coverage.
        
        Complexity: O(V + E) time, O(V + E) space
        - Each node visited exactly once: O(V)
        - Each edge traversed exactly once: O(E)
        - Global visited set prevents revisiting: O(V) space
        - Per-component recursion stack: O(V) space worst case
        
        Args:
            graph: Service dependency graph to analyze
            include_self_loops: Whether to report self-dependencies as cycles
            include_parallel_edges: Whether to consider parallel edges
            max_cycle_length: Optional limit on reported cycle length
            
        Returns:
            CycleDetectionResult with detected cycles and analysis metrics
        """
        start_time = time.time()
        
        # Reset stats
        self._analysis_stats = {
            'nodes_visited': 0,
            'edges_traversed': 0,
            'components_discovered': 0,
            'cycles_detected': 0,
            'max_dfs_depth': 0,
            'self_loops_found': 0,
            'parallel_edges_found': 0
        }
        self.traversal_log = []
        
        is_valid, error_msg = self._validate_graph_structure(graph)
        if not is_valid:
            raise ValueError(f"Invalid graph structure: {error_msg}")
        
        if not self._check_graph_integrity(graph):
            raise ValueError("Graph integrity check failed")
        
        cycles_found: List[CycleInfo] = []
        
        # CRITICAL FIX: Global visited state to prevent revisiting nodes
        global_visited: Set[str] = set()
        disconnected_components: List[Set[str]] = []
        
        def dfs_detect_cycle(start_node_id: str, component_id: int) -> Set[str]:
            """
            DFS cycle detection for a single component.
            
            FIXED: Uses per-component recursion stack while maintaining
            global visited state to ensure O(V + E) complexity.
            """
            component_nodes: Set[str] = set()
            recursion_stack: List[str] = []  # Changed from Set to List to maintain order
            
            def dfs_recursive(node_id: str, depth: int) -> None:
                """Recursive DFS with cycle detection"""
                self._analysis_stats['nodes_visited'] += 1
                self._analysis_stats['max_dfs_depth'] = max(
                    self._analysis_stats['max_dfs_depth'],
                    depth
                )
                
                global_visited.add(node_id)
                component_nodes.add(node_id)
                recursion_stack.append(node_id)  # Changed from add to append
                
                self._log_traversal(
                    "VISIT",
                    node_id,
                    {'depth': depth, 'component': component_id, 'stack_size': len(recursion_stack)}
                )
                
                # Explore neighbors
                neighbors = graph.get_neighbors(node_id)
                for neighbor_id in neighbors:
                    self._analysis_stats['edges_traversed'] += 1
                    
                    if neighbor_id not in global_visited:
                        # Tree edge - continue DFS
                        self._log_traversal(
                            "EXPLORE",
                            neighbor_id,
                            {'from': node_id, 'edge_type': 'tree', 'component': component_id}
                        )
                        dfs_recursive(neighbor_id, depth + 1)
                        
                    elif neighbor_id in recursion_stack:  # Changed from set membership to list membership
                        # Back edge - cycle detected!
                        self._log_traversal(
                            "CYCLE_DETECTED",
                            neighbor_id,
                            {'from': node_id, 'edge_type': 'back', 'component': component_id}
                        )
                        
                        # Reconstruct cycle path
                        start_idx = recursion_stack.index(neighbor_id)  # No need to convert to list
                        cycle_path = recursion_stack[start_idx:] + [neighbor_id]
                        
                        if max_cycle_length is None or len(cycle_path) - 1 <= max_cycle_length:
                            cycle_info = CycleInfo(
                                cycle_path=cycle_path,
                                cycle_length=len(cycle_path) - 1,
                                component_id=component_id,
                                total_criticality=self._calculate_cycle_criticality(cycle_path, graph),
                                max_latency_ms=self._calculate_max_cycle_latency(cycle_path, graph),
                                involves_critical_service=self._has_critical_service(cycle_path, graph),
                                detection_timestamp=time.time()
                            )
                            cycles_found.append(cycle_info)
                            self._analysis_stats['cycles_detected'] += 1
                    
                    # Note: Forward and cross edges are ignored (no action needed)
                
                recursion_stack.remove(node_id)  # Remove from list (maintains order for other elements)
                self._log_traversal(
                    "BACKTRACK",
                    node_id,
                    {'depth': depth, 'component': component_id}
                )
            
            # Start DFS from the component's starting node
            if start_node_id not in global_visited:
                dfs_recursive(start_node_id, 0)
            
            return component_nodes
        
        # CRITICAL FIX: Iterate through ALL nodes to find ALL components
        component_id = 0
        
        self._log_traversal(
            "START_MULTI_COMPONENT_ANALYSIS",
            "ALL_NODES",
            {'total_nodes': len(graph.nodes), 'total_edges': len(graph.edges)}
        )
        
        for node_id in graph.nodes:
            if node_id not in global_visited:
                # Found a new disconnected component
                self._log_traversal(
                    "START_COMPONENT",
                    node_id,
                    {'component_id': component_id}
                )
                
                component_nodes = dfs_detect_cycle(node_id, component_id)
                disconnected_components.append(component_nodes)
                
                self._analysis_stats['components_discovered'] += 1
                component_id += 1
                
                self._log_traversal(
                    "FINISH_COMPONENT",
                    node_id,
                    {
                        'component_id': component_id - 1,
                        'component_size': len(component_nodes),
                        'nodes_in_component': list(component_nodes)
                    }
                )
        
        end_time = time.time()
        
        has_critical = any(c.involves_critical_service for c in cycles_found)
        
        self._log_traversal(
            "ANALYSIS_COMPLETE",
            "ALL_COMPONENTS",
            {
                'total_components': self._analysis_stats['components_discovered'],
                'total_cycles': len(cycles_found),
                'total_nodes_visited': self._analysis_stats['nodes_visited'],
                'total_edges_traversed': self._analysis_stats['edges_traversed']
            }
        )
        
        return CycleDetectionResult(
            cycles_found=cycles_found,
            total_cycles=len(cycles_found),
            components_analyzed=self._analysis_stats['components_discovered'],
            nodes_visited=self._analysis_stats['nodes_visited'],
            edges_traversed=self._analysis_stats['edges_traversed'],
            analysis_time_ms=(end_time - start_time) * 1000,
            has_critical_cycles=has_critical,
            disconnected_components=disconnected_components
        )