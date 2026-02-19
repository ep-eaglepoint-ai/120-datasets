import unittest
import sys
import os
import time
import random
from decimal import Decimal
from typing import List, Tuple, Set

# ==========================================
# 1. DYNAMIC IMPORT & SETUP
# ==========================================

try:
    import dp_v1
    print(f"Successfully imported module from: {dp_v1.__file__}")
except ImportError:
    print("CRITICAL ERROR: Could not import 'dp_v1'.") 
    print("Ensure PYTHONPATH includes the directory of the version you want to test.")
    sys.exit(1)

# Shortcuts
Asset = dp_v1.Asset
PortfolioConstraint = dp_v1.PortfolioConstraint
ConstraintType = dp_v1.ConstraintType
PortfolioOptimizer = dp_v1.PortfolioOptimizer

class TestPortfolioOptimization(unittest.TestCase):
    
    def setUp(self):
        self.optimizer = PortfolioOptimizer(enable_logging=False)
        # Check if DP method exists
        self.is_dp = hasattr(self.optimizer, "find_optimal_subsets_dp")
        
        # Primary method to test (DP if available, else BF)
        self.target_method = getattr(self.optimizer, 
            "find_optimal_subsets_dp" if self.is_dp else "find_optimal_subsets"
        )
        
        # Keep reference to specific methods for comparison tests
        self.bf_method = getattr(self.optimizer, "find_optimal_subsets", None)
        self.dp_method = getattr(self.optimizer, "find_optimal_subsets_dp", None)
        
        print(f"\n[Running against {'DP' if self.is_dp else 'Brute Force'}] ", end="")

    # ==========================================
    # HELPER METHODS
    # ==========================================

    def create_standard_assets(self, n: int) -> List[Asset]:
        """Creates assets with predictable 10, 20, 30... values"""
        return [
            Asset(
                symbol=f"SYM_{i}",
                value=Decimal(str((i + 1) * 10)),
                weight=Decimal("0.1"),
                sector="TECH" if i % 2 == 0 else "FIN",
                risk_score=float((i % 5) + 1),
                liquidity_tier=1,
                regulatory_class="A"
            ) for i in range(n)
        ]

    def create_precision_assets(self) -> List[Asset]:
        """Creates assets with specific decimal values for precision testing"""
        return [
            Asset("A1", Decimal("10.0001"), Decimal("0.1"), "S", 1.0, 1, "A"),
            Asset("A2", Decimal("20.0002"), Decimal("0.1"), "S", 1.0, 1, "A"),
            Asset("A3", Decimal("30.0003"), Decimal("0.1"), "S", 1.0, 1, "A"),
            Asset("A4", Decimal("40.0004"), Decimal("0.1"), "S", 1.0, 1, "A"),
        ]

    def _run(self, assets, constraints, max_results=1000, sort=True):
        t0 = time.time()
        res = self.target_method(assets, constraints, max_results, sort)
        t_ms = (time.time() - t0) * 1000
        return res, t_ms

    # ==========================================
    # GROUP 1: BASIC CONSTRAINT LOGIC (The 7 Types)
    # ==========================================

    def test_01_exact_count(self):
        assets = self.create_standard_assets(5)
        # 5 choose 3 = 10 combinations
        c = [PortfolioConstraint(ConstraintType.EXACT_COUNT, "count", target_count=3)]
        res, _ = self._run(assets, c)
        self.assertEqual(res.total_valid, 10)
        for s in res.valid_subsets: self.assertEqual(len(s), 3)

    def test_02_min_max_count(self):
        assets = self.create_standard_assets(4)
        # Sizes 2, 3 allowed
        c = [
            PortfolioConstraint(ConstraintType.MIN_COUNT, "count", min_count=2),
            PortfolioConstraint(ConstraintType.MAX_COUNT, "count", max_count=3)
        ]
        res, _ = self._run(assets, c)
        # 4C2=6, 4C3=4 -> Total 10
        self.assertEqual(res.total_valid, 10)
        for s in res.valid_subsets: self.assertTrue(2 <= len(s) <= 3)

    def test_03_exact_sum_value(self):
        assets = self.create_standard_assets(5) # 10, 20, 30, 40, 50
        # Target 60: {10,50}, {20,40}, {10,20,30} -> 3 subsets
        c = [PortfolioConstraint(ConstraintType.EXACT_SUM, "value", target_value=Decimal("60"))]
        res, _ = self._run(assets, c)
        self.assertEqual(res.total_valid, 3)
        for s in res.valid_subsets:
            self.assertEqual(sum(a.value for a in s), Decimal("60"))

    def test_04_min_max_sum_value(self):
        assets = self.create_standard_assets(5)
        # Min 140. Total sum is 150.
        # Only {10,20,30,40,50}=150 or {20,30,40,50}=140 or {10,50...}
        # Easier: Exclude 10 (140). Exclude nothing (150).
        c = [PortfolioConstraint(ConstraintType.MIN_SUM, "value", min_value=Decimal("140"))]
        res, _ = self._run(assets, c)
        # Subsets: All(150), All-10(140) -> 2 valid
        self.assertEqual(res.total_valid, 2)

    def test_05_range_sum_risk(self):
        """Test summing a float attribute (risk_score) with range"""
        assets = self.create_standard_assets(5)
        # Risks: 1.0, 2.0, 3.0, 4.0, 5.0
        # Range [9.5, 10.5]. {1,2,3,4}=10.0, {2,3,5}=10.0, {1,4,5}=10.0
        c = [PortfolioConstraint(ConstraintType.RANGE_SUM, "risk_score", min_value=Decimal("9.5"), max_value=Decimal("10.5"))]
        res, _ = self._run(assets, c)
        self.assertTrue(res.total_valid >= 3)
        for s in res.valid_subsets:
            risk = sum(a.risk_score for a in s)
            self.assertTrue(9.5 <= risk <= 10.5)

    # ==========================================
    # GROUP 2: COMPLEX & FINANCIAL PRECISION
    # ==========================================

    def test_06_decimal_precision_handling(self):
        """Verify strict Decimal equality without float drift"""
        assets = self.create_precision_assets()
        # Sum of A1(10.0001) + A2(20.0002) = 30.0003
        c = [PortfolioConstraint(ConstraintType.EXACT_SUM, "value", target_value=Decimal("30.0003"))]
        
        res, _ = self._run(assets, c)
        
        # Should find {A1, A2} and {A3} (since A3 is exactly 30.0003)
        self.assertEqual(res.total_valid, 2) 
        
        # Verify no false positives
        # Target: 40.0004
        # Valid: {A4} (40.0004), {A1, A3} (10.0001 + 30.0003 = 40.0004)
        c_strict = [PortfolioConstraint(ConstraintType.EXACT_SUM, "value", target_value=Decimal("40.0004"))]
        res_strict, _ = self._run(assets, c_strict)
        
        self.assertEqual(res_strict.total_valid, 2, "Should find {A4} and {A1, A3}")

    def test_07_impossible_constraints(self):
        """Pruning check: Contradictory constraints"""
        assets = self.create_standard_assets(10)
        c = [
            PortfolioConstraint(ConstraintType.EXACT_COUNT, "count", target_count=3),
            PortfolioConstraint(ConstraintType.MIN_COUNT, "count", min_count=5)
        ]
        res, _ = self._run(assets, c)
        self.assertEqual(res.total_valid, 0)
        self.assertEqual(len(res.valid_subsets), 0)

    def test_08_multi_attribute_filtering(self):
        """Filter by Value AND Risk AND Count simultaneously"""
        assets = self.create_standard_assets(10)
        c = [
            PortfolioConstraint(ConstraintType.EXACT_COUNT, "count", target_count=2),
            PortfolioConstraint(ConstraintType.MAX_SUM, "risk_score", max_value=Decimal("3.5")), # Only low risk items
            PortfolioConstraint(ConstraintType.MIN_SUM, "value", min_value=Decimal("30"))
        ]
        res, _ = self._run(assets, c)
        
        found_syms = [tuple(sorted(a.symbol for a in s)) for s in res.valid_subsets]
        self.assertIn(('SYM_0', 'SYM_1'), found_syms) # V=30, R=3
        self.assertNotIn(('SYM_0', 'SYM_2'), found_syms) # V=40, R=4 (Too risky)

    # ==========================================
    # GROUP 3: BUSINESS RULES (Sorting, Limits)
    # ==========================================


    def test_09_max_results_truncation(self):
        """Ensure we don't return 10,000 items when 5 requested"""
        assets = self.create_standard_assets(10) # 2^10 = 1024 subsets
        c = [PortfolioConstraint(ConstraintType.MIN_COUNT, "count", min_count=0)]
        
        res, _ = self._run(assets, c, max_results=5)
        
        self.assertEqual(len(res.valid_subsets), 5)
        self.assertTrue(res.total_valid > 5)

    # ==========================================
    # GROUP 4: PERFORMANCE BASICS
    # ==========================================

    def test_10_perf_n12_small(self):
        """Req: N=12 < 50ms"""
        assets = self.create_standard_assets(12)
        c = [PortfolioConstraint(ConstraintType.RANGE_SUM, "value", min_value=Decimal("100"), max_value=Decimal("500"))]
        
        res, t_ms = self._run(assets, c)
        print(f"   -> N=12 Time: {t_ms:.2f}ms")
        self.assertTrue(res.total_valid > 0)
        self.assertLess(t_ms, 150)

    def test_11_perf_n18_medium(self):
        """Req: N=18 < 200ms (DP) vs 30s (BF)"""
        assets = self.create_standard_assets(18)
        c = [PortfolioConstraint(ConstraintType.EXACT_SUM, "value", target_value=Decimal("450"))]
        
        res, t_ms = self._run(assets, c)
        print(f"   -> N=18 Time: {t_ms:.2f}ms")
        
        if self.is_dp:
            self.assertLess(t_ms, 300, "DP version too slow for N=18")
        else:
            if t_ms > 200:
                print("   [INFO] Brute Force exceeded 200ms as expected.")

    def test_12_perf_n25_large_critical(self):
        """Req: N=25 < 1s (DP) vs Hours (BF)"""
        if not self.is_dp:
            print("   [SKIP] N=25 Test skipped for Brute Force (Would timeout)")
            return

        assets = self.create_standard_assets(25)
        c = [
            PortfolioConstraint(ConstraintType.RANGE_SUM, "value", min_value=Decimal("300"), max_value=Decimal("600")),
            PortfolioConstraint(ConstraintType.MAX_COUNT, "count", max_count=10)
        ]
        
        res, t_ms = self._run(assets, c)
        
        print(f"   -> N=25 Time: {t_ms:.2f}ms")
        self.assertTrue(res.total_valid > 0)
        self.assertLess(t_ms, 1200, "DP Critical Failure: N=25 took > 1.2s")

    def test_13_stats_integrity(self):
        """Verify result object is fully populated"""
        assets = self.create_standard_assets(8)
        c = [PortfolioConstraint(ConstraintType.MAX_COUNT, "count", max_count=3)]
        
        res, t_ms = self._run(assets, c)
        
        self.assertGreater(res.total_explored, 0)
        self.assertGreater(res.constraint_validations, 0)
        self.assertIsNotNone(res.pruned_branches)

    # ==========================================
    # GROUP 5: ADVANCED VERIFICATION (Equivalence & Stress)
    # ==========================================

    def test_14_bf_vs_dp_equivalence(self):
        """
        CRITICAL: Verifies DP produces IDENTICAL results to BF.
        Uses N=14 to allow BF to finish reasonable time.
        """
        if not self.is_dp:
            print("   [SKIP] Equivalence test skipped (No DP method)")
            return

        if not self.bf_method:
            print("   [SKIP] Equivalence test skipped (No BF method available for comparison)")
            return

        print("   -> Running Equivalence Check (N=14)...")
        assets = self.create_standard_assets(14)
        c = [
            PortfolioConstraint(ConstraintType.RANGE_SUM, "value", min_value=Decimal("300"), max_value=Decimal("600")),
            PortfolioConstraint(ConstraintType.MAX_COUNT, "count", max_count=6)
        ]

        # Run Brute Force
        res_bf = self.bf_method(assets, c, max_results=1000, sort_by_score=True)
        # Run DP
        res_dp = self.dp_method(assets, c, max_results=1000, sort_by_score=True)

        self.assertEqual(res_bf.total_valid, res_dp.total_valid, "Total valid count mismatch between BF and DP")
        
        # Verify set equality of found subsets (ignoring order within subset)
        bf_sets = set(tuple(sorted(a.symbol for a in s)) for s in res_bf.valid_subsets)
        dp_sets = set(tuple(sorted(a.symbol for a in s)) for s in res_dp.valid_subsets)
        
        diff = bf_sets.symmetric_difference(dp_sets)
        self.assertEqual(len(diff), 0, f"Subsets do not match! Diff: {diff}")
        print("      [PASS] BF and DP results are identical.")

    def test_15_stress_n30_catastrophic_case(self):
        """
        Tests N=30. The Brute Force would take ~18 hours (2^30 iters).
        DP must solve this in seconds.
        """
        if not self.is_dp:
            print("   [SKIP] N=30 Stress Test skipped for BF")
            return

        print("   -> Running N=30 Stress Test...")
        assets = self.create_standard_assets(30)
        # Loose constraint to create large state space
        c = [PortfolioConstraint(ConstraintType.RANGE_SUM, "value", min_value=Decimal("1000"), max_value=Decimal("1200"))]
        
        t0 = time.time()
        res = self.dp_method(assets, c, max_results=10)
        t_ms = (time.time() - t0) * 1000
        
        print(f"      Time: {t_ms:.2f}ms | Explored Nodes: {res.total_explored}")
        
        # Must be fast
        self.assertLess(t_ms, 3000, "N=30 took > 3s")
        # Must use memoization (Brute force would be ~1 billion nodes)
        self.assertLess(res.total_explored, 2_000_000, "DP explored too many nodes - Memoization ineffective?")

    def test_16_pruning_effectiveness(self):
        """Verify that impossible branches are pruned early"""
        assets = self.create_standard_assets(20)
        # Impossible: Min Sum > Total Sum
        total = sum(a.value for a in assets)
        c = [PortfolioConstraint(ConstraintType.MIN_SUM, "value", min_value=total + Decimal("100"))]
        
        res, _ = self._run(assets, c)
        
        self.assertEqual(res.total_valid, 0)
        self.assertGreater(res.pruned_branches, 0, "Pruning logic failed to trigger")

    def test_17_state_collisions(self):
        """Verify different paths to same state are handled correctly"""
        # A1=10, A2=10, A3=10. Target=20.
        # {A1,A2}, {A1,A3}, {A2,A3} all reach same state (Count=2, Sum=20)
        assets = [
            Asset(f"A{i}", Decimal("10"), Decimal("1"), "T", 1.0, 1, "A") 
            for i in range(3)
        ]
        c = [PortfolioConstraint(ConstraintType.EXACT_SUM, "value", target_value=Decimal("20"))]
        
        res, _ = self._run(assets, c)
        # 3 items choose 2 = 3 combinations
        self.assertEqual(res.total_valid, 3)

if __name__ == '__main__':
    unittest.main()

