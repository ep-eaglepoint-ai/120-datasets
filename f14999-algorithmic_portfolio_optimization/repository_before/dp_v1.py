from typing import List, Tuple, Dict, Set, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import time
from decimal import Decimal

class ConstraintType(Enum):
    """Regulatory constraint types for portfolio composition"""
    EXACT_SUM = "exact_sum"
    MIN_SUM = "min_sum"
    MAX_SUM = "max_sum"
    RANGE_SUM = "range_sum"
    EXACT_COUNT = "exact_count"
    MIN_COUNT = "min_count"
    MAX_COUNT = "max_count"

@dataclass
class Asset:
    """Represents a financial asset with multiple attributes"""
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
    """Complex multi-dimensional constraint on portfolio subset"""
    constraint_type: ConstraintType
    attribute: str  # Which asset attribute to sum (value/weight/risk_score)
    target_value: Optional[Decimal] = None
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    target_count: Optional[int] = None
    min_count: Optional[int] = None
    max_count: Optional[int] = None
    
    def validate(self, subset: List[Asset]) -> bool:
        """Validate if subset satisfies this constraint"""
        if self.attribute == 'count':
            count = len(subset)
            if self.constraint_type == ConstraintType.EXACT_COUNT:
                return count == self.target_count
            elif self.constraint_type == ConstraintType.MIN_COUNT:
                return count >= self.min_count
            elif self.constraint_type == ConstraintType.MAX_COUNT:
                return count <= self.max_count
        else:
            # Sum numeric attribute
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
    """Result of subset search with detailed metrics"""
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
    """Enterprise portfolio optimization engine"""
    
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
        """Log exploration decision for audit trail"""
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
        """
        Validate all constraints against subset.
        Returns (is_valid, failure_reason)
        """
        self._global_stats['validations_performed'] += 1
        
        if not subset:
            return False, "Empty subset"
        
        for constraint in constraints:
            if not constraint.validate(subset):
                return False, f"Failed constraint: {constraint.constraint_type.value} on {constraint.attribute}"
        
        return True, "All constraints satisfied"
    
    def _calculate_subset_score(self, subset: List[Asset]) -> Decimal:
        """
        Calculate optimization score for subset.
        Higher is better. Used for ranking valid subsets.
        """
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
        """
        Advanced pruning logic: Can we determine early that no valid solution 
        exists in this branch?
        
        Returns (should_prune, reason)
        """
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
    
    def find_optimal_subsets(
        self,
        assets: List[Asset],
        constraints: List[PortfolioConstraint],
        max_results: int = 10,
        sort_by_score: bool = True
    ) -> SubsetSearchResult:
        """
        BRUTE FORCE IMPLEMENTATION - Find all valid subsets satisfying constraints.
        
        WARNING: O(2^n) complexity - exponential explosion for n > 20
        
        Args:
            assets: List of available assets
            constraints: List of portfolio constraints to satisfy
            max_results: Maximum number of results to return (for ranking)
            sort_by_score: Whether to sort results by optimization score
            
        Returns:
            SubsetSearchResult with all valid subsets and exploration metrics
        """
        start_time = time.time()
        
        # Reset stats
        self._global_stats = {
            'nodes_explored': 0,
            'validations_performed': 0,
            'branches_pruned': 0,
            'max_depth_reached': 0
        }
        self.exploration_log = []
        
        valid_subsets: List[Tuple[Asset, ...]] = []
        
        def _recursive_search(
            index: int,
            current_subset: List[Asset],
            remaining_assets: List[Asset],
            depth: int
        ):
            """
            Recursive brute-force search through all 2^n combinations.
            
            At each step, we make binary decision: include or exclude current asset.
            """
            self._global_stats['nodes_explored'] += 1
            self._global_stats['max_depth_reached'] = max(
                self._global_stats['max_depth_reached'], 
                depth
            )
            
            # Base case: examined all assets
            if index >= len(assets):
                if current_subset:  # Don't validate empty subset
                    is_valid, reason = self._validate_constraints(current_subset, constraints)
                    
                    if is_valid:
                        subset_tuple = tuple(current_subset)
                        valid_subsets.append(subset_tuple)
                        self._log_exploration(depth, subset_tuple, "ACCEPT", reason)
                    else:
                        self._log_exploration(
                            depth, 
                            tuple(current_subset), 
                            "REJECT", 
                            reason
                        )
                return
            
            # Early pruning check
            should_prune, prune_reason = self._check_early_pruning(
                current_subset, 
                remaining_assets[1:] if remaining_assets else [],
                constraints
            )
            
            if should_prune:
                self._global_stats['branches_pruned'] += 1
                self._log_exploration(
                    depth,
                    tuple(current_subset),
                    "PRUNE",
                    prune_reason
                )
                return
            
            current_asset = assets[index]
            
            # Decision 1: INCLUDE current asset
            self._log_exploration(
                depth,
                tuple(current_subset),
                "EXPLORE_INCLUDE",
                f"Trying with {current_asset.symbol}"
            )
            
            new_subset = current_subset + [current_asset]
            new_remaining = remaining_assets[1:] if len(remaining_assets) > 1 else []
            
            _recursive_search(
                index + 1,
                new_subset,
                new_remaining,
                depth + 1
            )
            
            # Decision 2: EXCLUDE current asset
            self._log_exploration(
                depth,
                tuple(current_subset),
                "EXPLORE_EXCLUDE",
                f"Trying without {current_asset.symbol}"
            )
            
            _recursive_search(
                index + 1,
                current_subset,
                new_remaining,
                depth + 1
            )
        
        # Start recursive search
        _recursive_search(0, [], assets, 0)
        
        # Sort results by score if requested
        if sort_by_score and valid_subsets:
            scored_subsets = [
                (subset, self._calculate_subset_score(list(subset))) 
                for subset in valid_subsets
            ]
            scored_subsets.sort(key=lambda x: x[1], reverse=True)
            valid_subsets = [subset for subset, _ in scored_subsets[:max_results]]
        
        end_time = time.time()
        
        return SubsetSearchResult(
            valid_subsets=valid_subsets[:max_results],
            total_explored=self._global_stats['nodes_explored'],
            total_valid=len(valid_subsets),
            exploration_time_ms=(end_time - start_time) * 1000,
            pruned_branches=self._global_stats['branches_pruned'],
            constraint_validations=self._global_stats['validations_performed'],
            max_recursion_depth=self._global_stats['max_depth_reached']
        )
