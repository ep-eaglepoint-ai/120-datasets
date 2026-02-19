"""
Test suite for count_transaction_ranges method in TransactionAnalytics class.

This test file validates:
1. Functional correctness of counting consecutive transaction sequences
2. Edge cases (empty, single transaction, exact matches)
3. Various transaction patterns (positive, negative, mixed amounts)
4. Performance requirements (<2 seconds for 100,000 transactions)

The count_transaction_ranges method should count all consecutive subsequences
of transactions where the sum of amounts falls within [lower_bound, upper_bound].
"""

import pytest
import time
import random
import sys
import os

# Add the repository path to sys.path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from analytics import Transaction, TransactionAnalytics


class TestCountTransactionRangesBasic:
    """Basic functional tests for count_transaction_ranges method."""
    
    def test_empty_transactions(self):
        """Test with no transactions - should return 0."""
        analytics = TransactionAnalytics()
        result = analytics.count_transaction_ranges(0, 100)
        assert result == 0, "Empty transaction list should return 0"
    
    def test_single_transaction_within_bounds(self):
        """Test single transaction that falls within bounds."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 50.0, "sales"))
        
        result = analytics.count_transaction_ranges(0, 100)
        assert result == 1, "Single transaction within bounds should count as 1"
    
    def test_single_transaction_outside_bounds(self):
        """Test single transaction that falls outside bounds."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 150.0, "sales"))
        
        result = analytics.count_transaction_ranges(0, 100)
        assert result == 0, "Single transaction outside bounds should count as 0"
    
    def test_single_transaction_exact_lower_bound(self):
        """Test single transaction exactly at lower bound."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 50.0, "sales"))
        
        result = analytics.count_transaction_ranges(50.0, 100)
        assert result == 1, "Transaction at exact lower bound should be counted"
    
    def test_single_transaction_exact_upper_bound(self):
        """Test single transaction exactly at upper bound."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 100.0, "sales"))
        
        result = analytics.count_transaction_ranges(50.0, 100)
        assert result == 1, "Transaction at exact upper bound should be counted"


class TestCountTransactionRangesMultiple:
    """Tests with multiple transactions."""
    
    def test_two_transactions_all_combinations(self):
        """
        Test with two transactions [10, 20].
        Possible consecutive ranges:
        - [10] = 10 (within 5-25? yes)
        - [20] = 20 (within 5-25? yes)
        - [10, 20] = 30 (within 5-25? no)
        Expected: 2
        """
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 10.0, "sales"))
        analytics.add_transaction(Transaction("cust2", 20.0, "sales"))
        
        result = analytics.count_transaction_ranges(5, 25)
        assert result == 2, f"Expected 2 ranges, got {result}"
    
    def test_three_transactions_various_ranges(self):
        """
        Test with three transactions [10, 20, 30].
        Possible consecutive ranges:
        - [10] = 10
        - [20] = 20
        - [30] = 30
        - [10, 20] = 30
        - [20, 30] = 50
        - [10, 20, 30] = 60
        
        With bounds [10, 30]:
        - 10: yes
        - 20: yes
        - 30: yes
        - 30: yes
        Expected: 4
        """
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 10.0, "sales"))
        analytics.add_transaction(Transaction("cust2", 20.0, "sales"))
        analytics.add_transaction(Transaction("cust3", 30.0, "sales"))
        
        result = analytics.count_transaction_ranges(10, 30)
        assert result == 4, f"Expected 4 ranges, got {result}"
    
    def test_all_same_amounts(self):
        """
        Test with identical amounts [10, 10, 10].
        Ranges and sums:
        - [10] = 10 (3 such ranges: indices 0, 1, 2)
        - [10, 10] = 20 (2 such ranges: 0-1, 1-2)
        - [10, 10, 10] = 30 (1 range: 0-2)
        
        With bounds [10, 20]:
        - 10: 3 times
        - 20: 2 times
        Expected: 5
        """
        analytics = TransactionAnalytics()
        for _ in range(3):
            analytics.add_transaction(Transaction("cust1", 10.0, "sales"))
        
        result = analytics.count_transaction_ranges(10, 20)
        assert result == 5, f"Expected 5 ranges, got {result}"


class TestCountTransactionRangesPositiveAmounts:
    """Tests with all positive transaction amounts (deposits only)."""
    
    def test_positive_amounts_small_dataset(self):
        """Test with small positive amounts dataset."""
        analytics = TransactionAnalytics()
        amounts = [100.0, 200.0, 50.0, 150.0, 75.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "deposit"))
        
        # Count ranges with sum between 100 and 300
        result = analytics.count_transaction_ranges(100, 300)
        
        # Verify by brute force for small dataset
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if 100 <= total <= 300:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"
    
    def test_positive_amounts_increasing(self):
        """Test with increasing positive amounts."""
        analytics = TransactionAnalytics()
        amounts = [10.0, 20.0, 30.0, 40.0, 50.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "deposit"))
        
        result = analytics.count_transaction_ranges(25, 60)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if 25 <= total <= 60:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"


class TestCountTransactionRangesNegativeAmounts:
    """Tests with all negative transaction amounts (withdrawals only)."""
    
    def test_negative_amounts_only(self):
        """Test with only negative amounts (withdrawals)."""
        analytics = TransactionAnalytics()
        amounts = [-50.0, -30.0, -20.0, -10.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "withdrawal"))
        
        # Count ranges with sum between -100 and -40
        result = analytics.count_transaction_ranges(-100, -40)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if -100 <= total <= -40:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"
    
    def test_negative_amounts_decreasing(self):
        """Test with decreasing negative amounts."""
        analytics = TransactionAnalytics()
        amounts = [-10.0, -20.0, -30.0, -40.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "withdrawal"))
        
        result = analytics.count_transaction_ranges(-60, -25)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if -60 <= total <= -25:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"


class TestCountTransactionRangesMixedAmounts:
    """Tests with mixed positive and negative transaction amounts."""
    
    def test_mixed_amounts_simple(self):
        """Test with simple mixed amounts."""
        analytics = TransactionAnalytics()
        amounts = [100.0, -50.0, 75.0, -25.0, 50.0]
        for i, amount in enumerate(amounts):
            category = "deposit" if amount > 0 else "withdrawal"
            analytics.add_transaction(Transaction(f"cust{i}", amount, category))
        
        result = analytics.count_transaction_ranges(0, 150)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if 0 <= total <= 150:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"
    
    def test_mixed_amounts_zero_sum_ranges(self):
        """Test finding ranges that sum to approximately zero."""
        analytics = TransactionAnalytics()
        amounts = [50.0, -50.0, 30.0, -30.0]
        for i, amount in enumerate(amounts):
            category = "deposit" if amount > 0 else "withdrawal"
            analytics.add_transaction(Transaction(f"cust{i}", amount, category))
        
        # Count ranges summing to exactly 0
        result = analytics.count_transaction_ranges(0, 0)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if total == 0:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"
    
    def test_mixed_alternating_amounts(self):
        """Test with alternating positive and negative amounts."""
        analytics = TransactionAnalytics()
        amounts = [100.0, -20.0, 100.0, -20.0, 100.0]
        for i, amount in enumerate(amounts):
            category = "deposit" if amount > 0 else "withdrawal"
            analytics.add_transaction(Transaction(f"cust{i}", amount, category))
        
        result = analytics.count_transaction_ranges(50, 200)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if 50 <= total <= 200:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"


class TestCountTransactionRangesExactMatch:
    """Tests for exact match queries where lower_bound == upper_bound."""
    
    def test_exact_match_single_value(self):
        """Test exact match for a single specific value."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 100.0, "sales"))
        
        result = analytics.count_transaction_ranges(100.0, 100.0)
        assert result == 1, "Exact match should find the single transaction"
    
    def test_exact_match_no_match(self):
        """Test exact match with no matching sum."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 100.0, "sales"))
        analytics.add_transaction(Transaction("cust2", 50.0, "sales"))
        
        # Looking for exact sum of 75 (doesn't exist)
        result = analytics.count_transaction_ranges(75.0, 75.0)
        assert result == 0, "No ranges should match exact value of 75"
    
    def test_exact_match_sum_of_two(self):
        """Test exact match for sum of consecutive transactions."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 30.0, "sales"))
        analytics.add_transaction(Transaction("cust2", 70.0, "sales"))
        
        # Looking for exact sum of 100 (30 + 70)
        result = analytics.count_transaction_ranges(100.0, 100.0)
        assert result == 1, "Should find exactly one range summing to 100"
    
    def test_exact_match_multiple_occurrences(self):
        """Test exact match with multiple ranges having same sum."""
        analytics = TransactionAnalytics()
        amounts = [50.0, 50.0, 50.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "sales"))
        
        # Looking for exact sum of 50
        result = analytics.count_transaction_ranges(50.0, 50.0)
        assert result == 3, "Should find 3 individual transactions of 50"
        
        # Looking for exact sum of 100
        result = analytics.count_transaction_ranges(100.0, 100.0)
        assert result == 2, "Should find 2 consecutive pairs summing to 100"


class TestCountTransactionRangesEdgeCases:
    """Edge case tests."""
    
    def test_very_small_bounds(self):
        """Test with very small bound range."""
        analytics = TransactionAnalytics()
        analytics.add_transaction(Transaction("cust1", 0.001, "sales"))
        
        result = analytics.count_transaction_ranges(0.0001, 0.01)
        assert result == 1, "Should find transaction with very small amount"
    
    def test_large_bounds_all_included(self):
        """Test where all possible ranges are within bounds."""
        analytics = TransactionAnalytics()
        amounts = [10.0, 20.0, 30.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "sales"))
        
        # Bounds that include all possible sums (10 to 60)
        result = analytics.count_transaction_ranges(0, 1000)
        
        # For 3 transactions: 3 single + 2 pairs + 1 triple = 6 ranges
        assert result == 6, f"All 6 ranges should be counted, got {result}"
    
    def test_bounds_exclude_all(self):
        """Test where no ranges are within bounds."""
        analytics = TransactionAnalytics()
        amounts = [100.0, 200.0, 300.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "sales"))
        
        # Bounds that exclude all possible sums
        result = analytics.count_transaction_ranges(1, 50)
        assert result == 0, "No ranges should match these bounds"
    
    def test_negative_bounds(self):
        """Test with negative bounds."""
        analytics = TransactionAnalytics()
        amounts = [-100.0, -50.0, 25.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "mixed"))
        
        result = analytics.count_transaction_ranges(-200, -50)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if -200 <= total <= -50:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"
    
    def test_zero_amount_transactions(self):
        """Test with zero amount transactions."""
        analytics = TransactionAnalytics()
        amounts = [0.0, 100.0, 0.0, -50.0, 0.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "mixed"))
        
        result = analytics.count_transaction_ranges(-10, 110)
        
        # Brute force verification
        expected = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if -10 <= total <= 110:
                    expected += 1
        
        assert result == expected, f"Expected {expected}, got {result}"


class TestCountTransactionRangesPerformance:
    """Performance tests to verify O(n log n) complexity requirement."""
    
    @pytest.mark.timeout(10)
    def test_performance_1000_transactions(self):
        """Test performance with 1,000 transactions - should complete quickly."""
        analytics = TransactionAnalytics()
        random.seed(42)
        
        # Directly set transactions to bypass slow add_transaction (which has O(n) deepcopy)
        transactions = [
            Transaction(f"cust{i}", random.uniform(-1000, 1000), "test")
            for i in range(1000)
        ]
        analytics.transactions = transactions
        
        start_time = time.time()
        result = analytics.count_transaction_ranges(-500, 500)
        elapsed_time = time.time() - start_time
        
        assert elapsed_time < 1.0, f"1000 transactions took {elapsed_time:.2f}s (should be <1s)"
        assert isinstance(result, int), "Result should be an integer"
        assert result >= 0, "Count should be non-negative"
    
    @pytest.mark.timeout(10)
    def test_performance_10000_transactions(self):
        """Test performance with 10,000 transactions - should complete in reasonable time."""
        analytics = TransactionAnalytics()
        random.seed(42)
        
        # Directly set transactions to bypass slow add_transaction
        transactions = [
            Transaction(f"cust{i}", random.uniform(-1000, 1000), "test")
            for i in range(10000)
        ]
        analytics.transactions = transactions
        
        start_time = time.time()
        result = analytics.count_transaction_ranges(-500, 500)
        elapsed_time = time.time() - start_time
        
        # For O(n log n), 10k should still be fast
        assert elapsed_time < 2.0, f"10000 transactions took {elapsed_time:.2f}s (should be <2s)"
        assert isinstance(result, int), "Result should be an integer"
    
    @pytest.mark.timeout(10)
    def test_performance_100000_transactions_sla(self):
        """
        CRITICAL PERFORMANCE TEST: 100,000 transactions must complete in <2 seconds.
        This is the primary SLA requirement from the problem statement.
        """
        analytics = TransactionAnalytics()
        random.seed(42)
        
        # Directly set transactions to bypass slow add_transaction
        print("\nBuilding 100,000 transaction dataset...")
        transactions = [
            Transaction(f"cust{i % 1000}", random.uniform(-1000, 1000), "test")
            for i in range(100000)
        ]
        analytics.transactions = transactions
        
        print("Running count_transaction_ranges...")
        start_time = time.time()
        result = analytics.count_transaction_ranges(-500, 500)
        elapsed_time = time.time() - start_time
        
        print(f"Completed in {elapsed_time:.2f} seconds")
        print(f"Found {result} valid ranges")
        
        # THE CRITICAL SLA: Must complete in under 2 seconds
        assert elapsed_time < 2.0, (
            f"PERFORMANCE SLA VIOLATION: 100,000 transactions took {elapsed_time:.2f}s "
            f"(required: <2s). Current implementation likely has O(n²) or O(n³) complexity."
        )
        assert isinstance(result, int), "Result should be an integer"
        assert result >= 0, "Count should be non-negative"
    
    @pytest.mark.timeout(10)
    def test_performance_positive_only_100000(self):
        """Test 100,000 positive-only transactions - common real-world scenario."""
        analytics = TransactionAnalytics()
        random.seed(123)
        
        # Directly set transactions to bypass slow add_transaction
        transactions = [
            Transaction(f"cust{i % 1000}", random.uniform(1, 1000), "deposit")
            for i in range(100000)
        ]
        analytics.transactions = transactions
        
        start_time = time.time()
        result = analytics.count_transaction_ranges(100, 500)
        elapsed_time = time.time() - start_time
        
        assert elapsed_time < 2.0, (
            f"100,000 positive transactions took {elapsed_time:.2f}s (required: <2s)"
        )
    
    @pytest.mark.timeout(10)
    def test_performance_scaling_verification(self):
        """
        Verify O(n log n) scaling by comparing time ratios.
        If complexity is O(n log n), doubling n should roughly double time (plus log factor).
        If complexity is O(n²) or worse, doubling n would quadruple+ time.
        """
        random.seed(42)
        
        # Test with 5000 transactions - directly set to bypass slow add_transaction
        analytics_small = TransactionAnalytics()
        analytics_small.transactions = [
            Transaction(f"cust{i}", random.uniform(-100, 100), "test")
            for i in range(5000)
        ]
        
        start_time = time.time()
        analytics_small.count_transaction_ranges(-50, 50)
        time_small = time.time() - start_time
        
        # Test with 10000 transactions (2x)
        random.seed(42)
        analytics_large = TransactionAnalytics()
        analytics_large.transactions = [
            Transaction(f"cust{i}", random.uniform(-100, 100), "test")
            for i in range(10000)
        ]
        
        start_time = time.time()
        analytics_large.count_transaction_ranges(-50, 50)
        time_large = time.time() - start_time
        
        # For O(n log n), ratio should be roughly 2-3x, not 4x+
        if time_small > 0.001:  # Avoid division issues with very fast times
            ratio = time_large / time_small
            print(f"\nScaling test: 5k={time_small:.3f}s, 10k={time_large:.3f}s, ratio={ratio:.2f}x")
            
            # O(n²) would give ratio ~4, O(n³) would give ratio ~8
            # O(n log n) should give ratio ~2.2-2.5
            assert ratio < 5, (
                f"Scaling ratio of {ratio:.2f}x suggests worse than O(n log n) complexity. "
                f"Expected ratio ~2-3x for O(n log n), got {ratio:.2f}x"
            )


class TestCountTransactionRangesCorrectness:
    """Correctness verification tests comparing against brute force."""
    
    def _brute_force_count(self, amounts, lower_bound, upper_bound):
        """Reference brute force implementation for verification."""
        count = 0
        n = len(amounts)
        for i in range(n):
            total = 0
            for j in range(i, n):
                total += amounts[j]
                if lower_bound <= total <= upper_bound:
                    count += 1
        return count
    
    def test_correctness_random_small(self):
        """Verify correctness against brute force with random small dataset."""
        random.seed(42)
        
        for trial in range(10):
            analytics = TransactionAnalytics()
            n = random.randint(5, 20)
            amounts = [random.uniform(-100, 100) for _ in range(n)]
            
            for i, amount in enumerate(amounts):
                analytics.add_transaction(Transaction(f"cust{i}", amount, "test"))
            
            lower = random.uniform(-200, 0)
            upper = random.uniform(0, 200)
            
            result = analytics.count_transaction_ranges(lower, upper)
            expected = self._brute_force_count(amounts, lower, upper)
            
            assert result == expected, (
                f"Trial {trial}: Expected {expected}, got {result} "
                f"with bounds [{lower:.2f}, {upper:.2f}]"
            )
    
    def test_correctness_specific_case(self):
        """Test a specific case with known answer."""
        analytics = TransactionAnalytics()
        # Transactions: [5, 3, 7, 2]
        # All consecutive sums:
        # [5]=5, [3]=3, [7]=7, [2]=2
        # [5,3]=8, [3,7]=10, [7,2]=9
        # [5,3,7]=15, [3,7,2]=12
        # [5,3,7,2]=17
        amounts = [5.0, 3.0, 7.0, 2.0]
        for i, amount in enumerate(amounts):
            analytics.add_transaction(Transaction(f"cust{i}", amount, "sales"))
        
        # Bounds [5, 10]: should match 5, 7, 8, 10, 9 = 5 ranges
        result = analytics.count_transaction_ranges(5, 10)
        expected = self._brute_force_count(amounts, 5, 10)
        
        assert result == expected, f"Expected {expected}, got {result}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
