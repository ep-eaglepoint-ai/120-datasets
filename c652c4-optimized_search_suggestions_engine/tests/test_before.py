"""
Performance and Correctness Tests for SearchSuggestionsEngine.

These tests verify:
1. Basic functionality works correctly
2. Performance meets O(n log n) complexity requirements
3. Scaling behavior proves algorithmic improvement

CRITICAL: Performance tests use SCALING ANALYSIS to prove complexity.
- O(n²): Doubling input size → ~4x time increase
- O(n log n): Doubling input size → ~2-2.5x time increase

The performance tests are designed to:
- PASS on O(n log n) implementation (repository_after)
- FAIL on O(n²) implementation (repository_before)
"""

import pytest
import time
import random
import string
import sys
import os

# === IMPORT FROM REPOSITORY_BEFORE ===
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_before'))

from optimized_Search_suggestions_engine_v1 import (
    SearchSuggestionsEngine,
    Product,
    ProductCategory,
    SearchSuggestion,
    SearchSuggestionsResult
)


def generate_product(product_id, title=None, category=None):
    """Generate a product for testing."""
    if title is None:
        title = ''.join(random.choices(string.ascii_lowercase + ' ', k=random.randint(10, 25)))
    if category is None:
        category = random.choice(list(ProductCategory))
    
    return Product(
        product_id=product_id,
        title=title.strip(),
        description=f"Description for {title} with additional searchable content",
        category=category,
        price=round(random.uniform(10.0, 500.0), 2),
        rating=round(random.uniform(3.0, 5.0), 1),
        review_count=random.randint(10, 5000),
        in_stock=random.choice([True, True, True, False]),
        popularity_score=round(random.uniform(0.3, 1.0), 2),
        created_timestamp=time.time() - random.randint(0, 180 * 24 * 3600),
        tags=[f"tag{i}" for i in range(random.randint(1, 4))]
    )


def create_catalog(size, seed=42):
    """Create a test catalog with searchable products."""
    random.seed(seed)
    products = []
    
    num_wireless = max(10, size // 10)
    for i in range(num_wireless):
        products.append(Product(
            product_id=f"wireless_{i}",
            title=f"Wireless Device Model {i}",
            description=f"High quality wireless electronic device number {i}",
            category=ProductCategory.ELECTRONICS,
            price=round(random.uniform(20.0, 300.0), 2),
            rating=round(random.uniform(3.5, 5.0), 1),
            review_count=random.randint(50, 3000),
            in_stock=True,
            popularity_score=round(random.uniform(0.5, 1.0), 2),
            created_timestamp=time.time() - random.randint(0, 90 * 24 * 3600),
            tags=["wireless", "electronic", "device"]
        ))
    
    for i in range(size - num_wireless):
        products.append(generate_product(f"random_{i}"))
    
    random.shuffle(products)
    return products


class TestBasicFunctionality:
    """Verify core search functionality works correctly."""
    
    @pytest.fixture
    def engine(self):
        catalog = create_catalog(500)
        return SearchSuggestionsEngine(catalog)
    
    def test_search_returns_results(self, engine):
        result = engine.generate_search_suggestions("wireless")
        assert result.suggestions, "Should find results for 'wireless'"
        assert len(result.suggestions) <= 10
    
    def test_empty_query_returns_empty(self, engine):
        result = engine.generate_search_suggestions("")
        assert len(result.suggestions) == 0
    
    def test_max_results_respected(self, engine):
        result = engine.generate_search_suggestions("wireless", max_results=3)
        assert len(result.suggestions) <= 3
    
    def test_results_sorted_by_score(self, engine):
        result = engine.generate_search_suggestions("wireless")
        if len(result.suggestions) > 1:
            scores = [s.relevance_score for s in result.suggestions]
            assert scores == sorted(scores, reverse=True)
    
    def test_category_filter(self, engine):
        result = engine.generate_search_suggestions("wireless", category_filter="electronics")
        for suggestion in result.suggestions:
            assert suggestion.product.category == ProductCategory.ELECTRONICS


class TestPerformanceScaling:
    """
    CRITICAL: These tests prove algorithmic complexity through scaling analysis.
    - O(n log n): Doubling n → ~2.0-2.5x time
    - O(n²): Doubling n → ~4x time
    """
    
    def _benchmark_query(self, engine, query, runs=5):
        engine.generate_search_suggestions(query, enable_fuzzy=True)
        engine._query_cache.clear()
        
        times = []
        for _ in range(runs):
            engine._query_cache.clear()
            start = time.perf_counter()
            engine.generate_search_suggestions(query, enable_fuzzy=True)
            elapsed_ms = (time.perf_counter() - start) * 1000
            times.append(elapsed_ms)
        
        times.sort()
        return times[len(times) // 2]
    
    def test_scaling_ratio_proves_complexity(self):
        """
        CORE TEST: Measure scaling ratio when doubling input size.
        For O(n log n): ratio ~2.0-2.5x. For O(n²): ratio ~4.0x
        """
        catalog_small = create_catalog(5000, seed=42)
        catalog_large = create_catalog(10000, seed=42)
        
        engine_small = SearchSuggestionsEngine(catalog_small)
        engine_large = SearchSuggestionsEngine(catalog_large)
        
        time_small = self._benchmark_query(engine_small, "wireless", runs=5)
        time_large = self._benchmark_query(engine_large, "wireless", runs=5)
        
        scaling_ratio = time_large / time_small if time_small > 0 else float('inf')
        
        assert scaling_ratio < 3.0, (
            f"Scaling ratio {scaling_ratio:.2f}x too high. "
            f"5k: {time_small:.2f}ms, 10k: {time_large:.2f}ms. "
            f"Expected <3.0x for O(n log n), O(n²) gives ~4x"
        )
    
    def test_large_scaling_ratio(self):
        """Test scaling at larger sizes: 10000 → 20000."""
        catalog_10k = create_catalog(10000, seed=42)
        catalog_20k = create_catalog(20000, seed=42)
        
        engine_10k = SearchSuggestionsEngine(catalog_10k)
        engine_20k = SearchSuggestionsEngine(catalog_20k)
        
        time_10k = self._benchmark_query(engine_10k, "wireless", runs=5)
        time_20k = self._benchmark_query(engine_20k, "wireless", runs=5)
        
        scaling_ratio = time_20k / time_10k if time_10k > 0 else float('inf')
        
        assert scaling_ratio < 3.0, (
            f"Scaling ratio {scaling_ratio:.2f}x indicates O(n²). "
            f"10k: {time_10k:.2f}ms, 20k: {time_20k:.2f}ms"
        )
    
    def test_absolute_time_small_catalog(self):
        """5,000 products should complete in <20ms for O(n log n)."""
        catalog = create_catalog(5000, seed=42)
        engine = SearchSuggestionsEngine(catalog)
        time_ms = self._benchmark_query(engine, "wireless", runs=5)
        assert time_ms < 20, f"Query took {time_ms:.2f}ms for 5k products"
    
    def test_absolute_time_medium_catalog(self):
        """20,000 products should complete in <50ms for O(n log n)."""
        catalog = create_catalog(20000, seed=42)
        engine = SearchSuggestionsEngine(catalog)
        time_ms = self._benchmark_query(engine, "wireless", runs=5)
        assert time_ms < 50, f"Query took {time_ms:.2f}ms for 20k products"
    
    def test_absolute_time_large_catalog(self):
        """50,000 products should complete in <150ms for O(n log n)."""
        catalog = create_catalog(50000, seed=42)
        engine = SearchSuggestionsEngine(catalog)
        time_ms = self._benchmark_query(engine, "wireless", runs=3)
        assert time_ms < 150, f"Query took {time_ms:.2f}ms for 50k products"


class TestCaching:
    """Verify caching works correctly."""
    
    @pytest.fixture
    def engine(self):
        return SearchSuggestionsEngine(create_catalog(1000))
    
    def test_cache_hit_on_repeat_query(self, engine):
        result1 = engine.generate_search_suggestions("wireless")
        assert not result1.cache_hit
        result2 = engine.generate_search_suggestions("wireless")
        assert result2.cache_hit


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    @pytest.fixture
    def engine(self):
        return SearchSuggestionsEngine(create_catalog(500))
    
    def test_special_characters_handled(self, engine):
        result = engine.generate_search_suggestions("test!@#$%")
        assert isinstance(result, SearchSuggestionsResult)
    
    def test_no_matches_returns_empty(self, engine):
        result = engine.generate_search_suggestions("xyznonexistent123")
        assert len(result.suggestions) == 0
    
    def test_empty_catalog(self):
        engine = SearchSuggestionsEngine([])
        result = engine.generate_search_suggestions("test")
        assert len(result.suggestions) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
