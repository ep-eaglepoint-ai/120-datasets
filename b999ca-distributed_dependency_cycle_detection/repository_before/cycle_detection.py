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
    adjacency_list: Dict[str, List[str]] 
    reverse_adjacency: Dict[str, List[str]] 
    
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
        NAIVE SINGLE-SOURCE DFS - Detects cycles in CONNECTED graphs only.
        
        CRITICAL BUG: Assumes graph is connected. Only explores reachable nodes
        from first node, missing entire disconnected components.
        
        WARNING: Silently fails on disconnected graphs - reports "no cycles"
        even when isolated components contain cycles.
        
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
        visited: Set[str] = set()
        recursion_stack: Set[str] = set()
        
        def dfs_detect_cycle(node_id: str, depth: int) -> None:
            """
            DFS cycle detection - ONLY explores reachable nodes.
            
            BUG: Does not restart DFS for disconnected components.
            """
            self._analysis_stats['nodes_visited'] += 1
            self._analysis_stats['max_dfs_depth'] = max(
                self._analysis_stats['max_dfs_depth'],
                depth
            )
            
            visited.add(node_id)
            recursion_stack.add(node_id)
            
            self._log_traversal(
                "VISIT",
                node_id,
                {'depth': depth, 'stack_size': len(recursion_stack)}
            )
            
            if include_self_loops and graph.has_self_loop(node_id):
                self._analysis_stats['self_loops_found'] += 1
                cycle_info = CycleInfo(
                    cycle_path=[node_id, node_id],
                    cycle_length=1,
                    component_id=0, 
                    total_criticality=graph.nodes[node_id].criticality_score,
                    max_latency_ms=0.0,
                    involves_critical_service=self._has_critical_service([node_id], graph),
                    detection_timestamp=time.time()
                )
                cycles_found.append(cycle_info)
                self._analysis_stats['cycles_detected'] += 1
            
            neighbors = graph.get_neighbors(node_id)
            for neighbor_id in neighbors:
                self._analysis_stats['edges_traversed'] += 1
                
                if neighbor_id not in visited:
                    self._log_traversal(
                        "EXPLORE",
                        neighbor_id,
                        {'from': node_id, 'edge_type': 'tree'}
                    )
                    dfs_detect_cycle(neighbor_id, depth + 1)
                    
                elif neighbor_id in recursion_stack:
                    self._log_traversal(
                        "CYCLE_DETECTED",
                        neighbor_id,
                        {'from': node_id, 'edge_type': 'back'}
                    )
                    
                    cycle_path = [neighbor_id]
                    temp_stack = list(recursion_stack)
                    
                    start_idx = temp_stack.index(neighbor_id)
                    cycle_path = temp_stack[start_idx:] + [neighbor_id]
                    
                    if max_cycle_length is None or len(cycle_path) - 1 <= max_cycle_length:
                        cycle_info = CycleInfo(
                            cycle_path=cycle_path,
                            cycle_length=len(cycle_path) - 1,
                            component_id=0,  
                            total_criticality=self._calculate_cycle_criticality(cycle_path, graph),
                            max_latency_ms=self._calculate_max_cycle_latency(cycle_path, graph),
                            involves_critical_service=self._has_critical_service(cycle_path, graph),
                            detection_timestamp=time.time()
                        )
                        cycles_found.append(cycle_info)
                        self._analysis_stats['cycles_detected'] += 1
            
            recursion_stack.remove(node_id)
            self._log_traversal(
                "BACKTRACK",
                node_id,
                {'depth': depth}
            )

        if graph.nodes:
            first_node = next(iter(graph.nodes.keys()))
            self._log_traversal(
                "START_DFS",
                first_node,
                {'total_nodes': len(graph.nodes)}
            )
            dfs_detect_cycle(first_node, 0)
            self._analysis_stats['components_discovered'] = 1  # BUG: Assumes 1 component
        
        end_time = time.time()
        
        has_critical = any(c.involves_critical_service for c in cycles_found)
        disconnected_components = [set(visited)] if visited else []
        
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
