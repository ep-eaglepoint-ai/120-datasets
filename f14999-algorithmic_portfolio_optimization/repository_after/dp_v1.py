from typing import List, Tuple, Dict, Set, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import time
from decimal import Decimal

class ConstraintType(Enum):
    """Defines constraint types."""
    EXACT_SUM = "exact_sum"
    MIN_SUM = "min_sum"
    MAX_SUM = "max_sum"
    RANGE_SUM = "range_sum"
    EXACT_COUNT = "exact_count"
    MIN_COUNT = "min_count"
    MAX_COUNT = "max_count"

@dataclass
class Asset:
    """Represents a financial asset."""
    symbol: str
    value: Decimal
    weight: Decimal
    sector: str
    risk_score: float
    liquidity_tier: int
    regulatory_class: str
    
    def __hash__(self):
        return hash(self.symbol)

@dataclass
class PortfolioConstraint:
    """Defines a constraint for portfolio subsets."""
    constraint_type: ConstraintType
    attribute: str  # Which asset attribute to sum (value/weight/risk_score)
    target_value: Optional[Decimal] = None
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    target_count: Optional[int] = None
    min_count: Optional[int] = None
    max_count: Optional[int] = None
    
    def validate(self, subset: List[Asset]) -> bool:
        """Checks if the subset meets the constraint."""
        if self.attribute == 'count':
            count = len(subset)
            if self.constraint_type == ConstraintType.EXACT_COUNT:
                return count == self.target_count
            elif self.constraint_type == ConstraintType.MIN_COUNT:
                return count >= self.min_count
            elif self.constraint_type == ConstraintType.MAX_COUNT:
                return count <= self.max_count
        else:
            # Sum numeric attribute.
            total = sum(getattr(asset, self.attribute) for asset in subset)
            
            if self.constraint_type == ConstraintType.EXACT_SUM:
                return abs(total - self.target_value) < Decimal('0.0001')
            elif self.constraint_type == ConstraintType.MIN_SUM:
                return total >= self.min_value
            elif self.constraint_type == ConstraintType.MAX_SUM:
                return total <= self.max_value
            elif self.constraint_type == ConstraintType.RANGE_SUM:
                return self.min_value <= total <= self.max_value
        
        return False

@dataclass
class SubsetSearchResult:
    """Container for search results and metrics."""
    valid_subsets: List[Tuple[Asset, ...]]
    total_explored: int
    total_valid: int
    exploration_time_ms: float
    pruned_branches: int
    constraint_validations: int
    max_recursion_depth: int
    
    def __eq__(self, other):
        if not isinstance(other, SubsetSearchResult):
            return False
        return (
            set(self.valid_subsets) == set(other.valid_subsets) and
            self.total_valid == other.total_valid
        )

class PortfolioOptimizer:
    """Optimizer for portfolio selection."""
    
    def __init__(self, enable_logging: bool = False):
        self.enable_logging = enable_logging
        self.exploration_log: List[Dict[str, Any]] = []
        self._global_stats = {
            'nodes_explored': 0,
            'validations_performed': 0,
            'branches_pruned': 0,
            'max_depth_reached': 0
        }
    
    def _log_exploration(self, depth: int, current_subset: Tuple[Asset, ...], 
                         decision: str, reason: str):
        """Logs exploration decisions."""
        if self.enable_logging:
            self.exploration_log.append({
                'depth': depth,
                'subset_symbols': tuple(a.symbol for a in current_subset),
                'subset_size': len(current_subset),
                'decision': decision,
                'reason': reason,
                'timestamp': time.time()
            })
    
    def _validate_constraints(self, subset: List[Asset], 
                            constraints: List[PortfolioConstraint]) -> Tuple[bool, str]:
        """Validates constraints for a subset."""
        self._global_stats['validations_performed'] += 1
        
        if not subset:
            return False, "Empty subset"
        
        for constraint in constraints:
            if not constraint.validate(subset):
                return False, f"Failed constraint: {constraint.constraint_type.value} on {constraint.attribute}"
        
        return True, "All constraints satisfied"
    
    def _calculate_subset_score(self, subset: List[Asset]) -> Decimal:
        """Calculates the optimization score."""
        if not subset:
            return Decimal('0')
        
        # Weighted scoring formula: value * weight / risk_score
        total_value = sum(a.value for a in subset)
        avg_weight = sum(a.weight for a in subset) / len(subset)
        avg_risk = sum(a.risk_score for a in subset) / len(subset)
        
        if avg_risk == 0:
            return Decimal('0')
        
        return (total_value * Decimal(str(avg_weight))) / Decimal(str(avg_risk))
    
    def _check_early_pruning(self, current_subset: List[Asset], 
                            remaining_assets: List[Asset],
                            constraints: List[PortfolioConstraint]) -> Tuple[bool, str]:
        """Checks if the current branch can be pruned."""
        # Pruning Rule 1: Check if we can still satisfy MIN constraints
        for constraint in constraints:
            if constraint.constraint_type == ConstraintType.MIN_SUM:
                current_sum = sum(getattr(a, constraint.attribute) for a in current_subset)
                max_possible = current_sum + sum(
                    getattr(a, constraint.attribute) for a in remaining_assets
                )
                if max_possible < constraint.min_value:
                    return True, f"Cannot reach min_{constraint.attribute}"
            
            elif constraint.constraint_type == ConstraintType.MIN_COUNT:
                max_possible_count = len(current_subset) + len(remaining_assets)
                if max_possible_count < constraint.min_count:
                    return True, "Cannot reach min_count"
        
        # Pruning Rule 2: Check if we already exceeded MAX constraints
        for constraint in constraints:
            if constraint.constraint_type == ConstraintType.MAX_SUM:
                current_sum = sum(getattr(a, constraint.attribute) for a in current_subset)
                if current_sum > constraint.max_value:
                    return True, f"Exceeded max_{constraint.attribute}"
            
            elif constraint.constraint_type == ConstraintType.MAX_COUNT:
                if len(current_subset) > constraint.max_count:
                    return True, "Exceeded max_count"
        
        # Pruning Rule 3: EXACT constraints - check feasibility
        for constraint in constraints:
            if constraint.constraint_type == ConstraintType.EXACT_SUM:
                current_sum = sum(getattr(a, constraint.attribute) for a in current_subset)
                remaining_sum = sum(getattr(a, constraint.attribute) for a in remaining_assets)
                
                # If current sum already exceeds target, prune
                if current_sum > constraint.target_value:
                    return True, f"Exceeded exact_{constraint.attribute}"
                
                # If current + all remaining still can't reach target, prune
                if current_sum + remaining_sum < constraint.target_value:
                    return True, f"Cannot reach exact_{constraint.attribute}"
        
        return False, "No pruning applicable"
    
    def find_optimal_subsets_dp(
        self,
        assets: List[Asset],
        constraints: List[PortfolioConstraint],
        max_results: int = 10,
        sort_by_score: bool = True
    ) -> SubsetSearchResult:
        """
        OPTIMIZED DP IMPLEMENTATION - Graph + A* Branch & Bound (Decimal Precision)
        
        1. Builds a compressed State Graph (DAG) using Memoization.
        2. Computes heuristic bounds (Max Value, Min Risk) per node using Decimal to prevent float drift.
        3. Uses Priority-Queue (A*) search to find Top K results guaranteed to match exact scoring
           without enumerating the entire solution space.
        """
        start_time = time.time()
        import heapq
        
        # 1. Stats & Setup
        self._global_stats = {
            'nodes_explored': 0,
            'validations_performed': 0,
            'branches_pruned': 0,
            'max_depth_reached': 0
        }
        self.exploration_log = []
        
        # State Attribute Mapping
        # We only track attributes involved in constraints to minimize state space
        state_attributes = set(c.attribute for c in constraints)
        sorted_state_attrs = sorted(list(state_attributes))
        attr_map = [(attr, i) for i, attr in enumerate(sorted_state_attrs)]
        is_count_in_state = 'count' in state_attributes
        count_idx = sorted_state_attrs.index('count') if is_count_in_state else -1

        # Cache: Key -> Node
        # Node Structure: [total_paths_count, transitions, max_suffix_val, max_suffix_weight, min_suffix_risk]
        # All bounds are Decimals to match the 'Exact Equivalence' requirement.
        memo = {}

        def get_initial_state():
            return tuple(0 if attr == 'count' else Decimal('0') for attr in sorted_state_attrs)

        def get_next_state(current_state, asset):
            """Fast state vector update"""
            new_state = list(current_state)
            for attr, i in attr_map:
                if i == count_idx:
                    new_state[i] += 1
                else:
                    val = getattr(asset, attr)
                    if not isinstance(val, Decimal): val = Decimal(str(val))
                    new_state[i] += val
            return tuple(new_state)

        # 2. Phase 1: Build Graph (DFS + Memoization)
        # We build the graph bottom-up to propagate heuristic bounds
        def _build_graph(index, current_subset, current_state):
            self._global_stats['nodes_explored'] += 1
            self._global_stats['max_depth_reached'] = max(
                self._global_stats['max_depth_reached'], index
            )
            
            # --- Base Case ---
            if index >= len(assets):
                if current_subset:
                    is_valid, reason = self._validate_constraints(current_subset, constraints)
                    if is_valid:
                        if self.enable_logging: self._log_exploration(index, tuple(current_subset), "ACCEPT", reason)
                        # Leaf Node bounds: value=0, weight=0, risk=0 (accumulated in path)
                        return [1, [], Decimal('0'), Decimal('0'), Decimal('0')] 
                    else:
                        if self.enable_logging: self._log_exploration(index, tuple(current_subset), "REJECT", reason)
                        return None
                return None

            # --- Pruning ---
            remaining = assets[index:]
            should_prune, reason = self._check_early_pruning(current_subset, remaining, constraints)
            if should_prune:
                self._global_stats['branches_pruned'] += 1
                if self.enable_logging: self._log_exploration(index, tuple(current_subset), "PRUNE", reason)
                return None

            state_key = (index, current_state)
            if state_key in memo:
                return memo[state_key]

            current_asset = assets[index]
            
            # Initialize Node with "Worst Case" bounds
            # [count, transitions, max_v, max_w, min_r]
            node = [0, [], Decimal('0'), Decimal('0'), Decimal('999999999')] 

            # Branch A: INCLUDE
            if self.enable_logging: self._log_exploration(index, tuple(current_subset), "EXPLORE_INCLUDE", f"With {current_asset.symbol}")
            next_state = get_next_state(current_state, current_asset)
            
            # Note: We must maintain the list construction for _check_early_pruning compatibility
            res_include = _build_graph(index + 1, current_subset + [current_asset], next_state)
            
            if res_include:
                node[0] += res_include[0]
                node[1].append((current_asset, res_include))
                
                # Update bounds with this asset's contribution + best child suffix
                v = current_asset.value
                w = current_asset.weight
                r = Decimal(str(current_asset.risk_score)) 
                
                node[2] = max(node[2], res_include[2] + v)
                node[3] = max(node[3], res_include[3] + w)
                node[4] = min(node[4], res_include[4] + r)

            # Branch B: EXCLUDE
            if self.enable_logging: self._log_exploration(index, tuple(current_subset), "EXPLORE_EXCLUDE", f"Without {current_asset.symbol}")
            res_exclude = _build_graph(index + 1, current_subset, current_state)
            
            if res_exclude:
                node[0] += res_exclude[0]
                node[1].append((None, res_exclude))
                
                # Bounds propagate directly from child (no asset contribution)
                node[2] = max(node[2], res_exclude[2])
                node[3] = max(node[3], res_exclude[3])
                node[4] = min(node[4], res_exclude[4])

            # If no valid paths found from here, cache as None
            if node[0] == 0:
                memo[state_key] = None
                return None
            
            memo[state_key] = node
            return node

        # Execute Build
        initial_state = get_initial_state()
        root_node = _build_graph(0, [], initial_state)
        
        valid_subsets = []
        total_valid = 0 if not root_node else root_node[0]

        # 3. Phase 2: Result Extraction
        if root_node and total_valid > 0:
            if not sort_by_score:
                # FAST PATH: DFS (Order doesn't matter)
                # Used when user just wants 'any' valid subsets
                stack = [(root_node, [])] 
                while stack and len(valid_subsets) < max_results:
                    curr, path = stack.pop()
                    if not curr[1]: # Leaf
                        valid_subsets.append(tuple(path))
                        continue
                    
                    for asset, next_node in reversed(curr[1]):
                        new_path = path + [asset] if asset else path
                        stack.append((next_node, new_path))
            else:
                # OPTIMIZED PATH: A* Search
                # Priority Queue stores: (-upper_bound, tie_breaker, current_node, current_accumulators, path)
                
                def calc_upper_bound(curr_v, curr_w, curr_r, node):
                    # Score = (TotalV * TotalW) / TotalR
                    # Bound = (CurrV + MaxSuffixV) * (CurrW + MaxSuffixW) / (CurrR + MinSuffixR)
                    denom = curr_r + node[4]
                    if denom == 0: denom = Decimal('0.000001') # Safety
                    return ((curr_v + node[2]) * (curr_w + node[3])) / denom

                pq = []
                tie_breaker_counter = 0 
                
                # Push Root
                ub = calc_upper_bound(Decimal('0'), Decimal('0'), Decimal('0'), root_node)
                # Store -ub for Max-Heap behavior
                heapq.heappush(pq, (-ub, tie_breaker_counter, root_node, (Decimal('0'), Decimal('0'), Decimal('0')), []))
                
                final_results = []
                
                while pq and len(final_results) < max_results:
                    neg_bound, _, curr_node, acc, path = heapq.heappop(pq)
                    
                    # Leaf Reached: Since we pop best-bounds first, this is the next best subset.
                    if not curr_node[1]:
                        subset = tuple(path)
                        # Calculate exact score just for the return tuple
                        score = self._calculate_subset_score(list(subset))
                        final_results.append((subset, score))
                        continue
                    
                    # Expand Children
                    curr_v, curr_w, curr_r = acc
                    for asset, next_node in curr_node[1]:
                        new_acc_v = curr_v
                        new_acc_w = curr_w
                        new_acc_r = curr_r
                        new_path = path
                        
                        if asset:
                            new_acc_v += asset.value
                            new_acc_w += asset.weight
                            new_acc_r += Decimal(str(asset.risk_score))
                            new_path = path + [asset]
                        
                        child_ub = calc_upper_bound(new_acc_v, new_acc_w, new_acc_r, next_node)
                        
                        tie_breaker_counter += 1
                        heapq.heappush(pq, (-child_ub, tie_breaker_counter, next_node, (new_acc_v, new_acc_w, new_acc_r), new_path))
                
                valid_subsets = [r[0] for r in final_results]

        end_time = time.time()
        
        return SubsetSearchResult(
            valid_subsets=valid_subsets,
            total_explored=self._global_stats['nodes_explored'],
            total_valid=total_valid, # Uses graph count (accurate total)
            exploration_time_ms=(end_time - start_time) * 1000,
            pruned_branches=self._global_stats['branches_pruned'],
            constraint_validations=self._global_stats['validations_performed'],
            max_recursion_depth=self._global_stats['max_depth_reached']
        )